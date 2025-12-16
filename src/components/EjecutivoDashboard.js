// EjecutivoDashboard.js
import React, { useState, useEffect, useMemo } from "react";
import MarketingEventsCalendar from "./MarketingEventsCalendar";
import MetricasEjecutivoPersonal from "./MetricasEjecutivoPersonal";
import SolicitarEsim from "./SolicitarEsim";
import "./EjecutivoDashboard.css";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { query, where, getDocs } from "firebase/firestore";
import { runTransaction } from "firebase/firestore";
import { generarBoletaPDF } from "../services/boletaPdfGenerator";

/* usuarios hook removed (unused) */

/* ==========================
   Función global para errores
   ========================== */
export function logError(error, showSnackbar) {
  console.error("[CRITICAL ERROR]", error);
  if (showSnackbar) {
    showSnackbar(
      typeof error === "string" ? error : error?.message || "Error crítico",
      "error",
      7000
    );
  }
}

/* ==========================
   Snackbar componente
   ========================== */
function Snackbar({ message, type = "info", onClose }) {
  if (!message) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        background:
          type === "error"
            ? "#ef4444"
            : type === "success"
            ? "#22c55e"
            : "#2563eb",
        color: "#fff",
        padding: "12px 32px",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 9999,
        fontWeight: 500,
        fontSize: 16,
      }}
    >
      {message}
      <button
        style={{
          marginLeft: 24,
          background: "transparent",
          color: "#fff",
          border: "none",
          fontWeight: 700,
          cursor: "pointer",
        }}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

/* ==========================
   Componente principal
   ========================== */
function EjecutivoDashboard({ user, tabsEjecutivo, tab, setTab, ...props }) {
  // Campos de formulario / solicitud
  const [cliente, setCliente] = useState("");
  const [cedulaCliente, setCedulaCliente] = useState("");
  const [pedido, setPedido] = useState("");
  const [direccion, setDireccion] = useState("");
  const [numeroSim, setNumeroSim] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [incluirSim, setIncluirSim] = useState(false);
  const [envioCorreo, setEnvioCorreo] = useState(false);
  const [imeisSolicitud, setImeisSolicitud] = useState([]);
  // Devolución de eSIM
  const [serieDevolver, setSerieDevolver] = useState("");
  const [devolviendo, setDevolviendo] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ message: "", type: "info" });
  const showSnackbar = (msg, type = "info", timeout = 3000) => {
    setSnackbar({ message: msg, type });
    if (timeout > 0) {
      setTimeout(() => setSnackbar({ message: "", type: "info" }), timeout);
    }
  };

  // Tabs por defecto y control
  const defaultTabs = [
    { key: "consulta", label: "Consulta Inventario" },
    { key: "bloqueados", label: "Bloqueados" },
    { key: "mis_solicitudes", label: "Mis Solicitudes" },
    { key: "solicitar_venta", label: "Realizar Venta" },
    { key: "solicitar_esim", label: "Solicitar eSIM" },
    { key: "eventos", label: "Eventos" },
    { key: "imeis_eventos", label: "IMEIs de Eventos" },
    { key: "mis_metricas", label: "Mis Métricas" },
    { key: "devolucion_esims", label: "Devolución eSIMs" },
  ];

  const effectiveTabs = Array.isArray(tabsEjecutivo) ? tabsEjecutivo : defaultTabs;
  const [internalTab, setInternalTab] = useState(effectiveTabs[0]?.key || "consulta");
  const effectiveTab = typeof tab !== "undefined" ? tab : internalTab;
  const effectiveSetTab = typeof setTab === "function" ? setTab : setInternalTab;

  // Logout
  const [logoutLoading, setLogoutLoading] = useState(false);
  async function handleLogout() {
    setLogoutLoading(true);
    try {
      const { getAuth, signOut } = await import("firebase/auth");
      const auth = getAuth();
      await signOut(auth);
      window.location.href = "/";
    } catch (err) {
      logError(err, showSnackbar);
    }
    setLogoutLoading(false);
  }

  // Eventos asignados (para pestaña imeis_eventos)
  const [eventosAsignados, setEventosAsignados] = useState([]);
  // eSIMs asignadas al usuario (para devolución)
  const [misEsimsAsignadas, setMisEsimsAsignadas] = useState([]);
  const [cargandoEsimsAsignadas, setCargandoEsimsAsignadas] = useState(true);

  // Solicitudes
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [pedidoFiltro, setPedidoFiltro] = useState("");
  const [imeiFiltroSolic, setImeiFiltroSolic] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [serieFiltro, setSerieFiltro] = useState("");
  const [paginaSolicitudes, setPaginaSolicitudes] = useState(1);
  const itemsPorPaginaSolicitudes = 10;
  const [editSolicitud, setEditSolicitud] = useState(null);
  const [editForm, setEditForm] = useState({
    cliente: "",
    pedido: "",
    imeis: [],
    direccion: "",
    numeroSim: "",
    observaciones: "",
    entrega: "",
    incluirSim: false,
    envioCorreo: false,
  });

  // Inventario
  const [inventarioRealtime, setInventarioRealtime] = useState([]);
  const [paginaInv, setPaginaInv] = useState(1);
  // Usamos una constante (no setter) para evitar warnings por setter no usado
  const itemsPorPaginaInv = 20;
  const [imeiFiltro, setImeiFiltro] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState("");
  const [estadoFiltroInv, setEstadoFiltroInv] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [terminalFiltro, setTerminalFiltro] = useState("");

  /* ==========================
     Helpers / Utilidades
     ========================== */
  function handleLimpiarSolicitud() {
    setCliente("");
    setCedulaCliente("");
    setPedido("");
    setDireccion("");
    setNumeroSim("");
    setObservaciones("");
    setIncluirSim(false);
    setEnvioCorreo(false);
    setImeisSolicitud([]);
  }

  function detectarTipo(item = {}) {
    const term = (item.terminal || "").toLowerCase();
    const serie = item.serie || "";
    const marca = (item.marca || "").toLowerCase();
    const keywords = ["cargador", "cable", "charger", "accesorio", "buds", "cubos", "watch", "audifono", "auricular", "band", "tablet", "case", "funda", "powerbank", "bateria", "estuche"];
    if (
      keywords.some(k => term.includes(k) || marca.includes(k)) ||
      (serie && !item.imei) ||
      (!item.imei && term)
    ) {
      return "Accesorio";
    }
    if (item.imei && item.imei.length > 6) return "Teléfono";
    return "Desconocido";
  }

  /* ==========================
     Subscriptions Firestore
     ========================== */

  // Inventario realtime
  useEffect(() => {
    const db = getFirestore();
    const q = collection(db, "inventario");
    const unsub = onSnapshot(q, (snapshot) => {
      const invData = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const isBlocked = data.lockedBy && data.lockedBy !== user.uid;
        return { id: docSnap.id, ...data, isBlocked };
      });
      setInventarioRealtime(invData);
    });
    return () => unsub();
  }, [user?.uid]);

  // Solicitudes del ejecutivo (propias o asignadas por correo)
  useEffect(() => {
    const db = getFirestore();
    const q = collection(db, "solicitudes");
    const unsub = onSnapshot(q, (snapshot) => {
      const solicitudesData = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(
          (sol) =>
            sol.createdBy === user.uid ||
            (sol.ejecutivo && (sol.ejecutivo === user.correo || sol.ejecutivo === user.email))
        );
      setMisSolicitudes(solicitudesData);
    });
    return () => unsub();
  }, [user?.uid, user?.correo, user?.email]);

  // Eventos asignados (para la pestaña imeis_eventos)
  useEffect(() => {
    const db = getFirestore();
    // Buscar en la colección marketing_events
    const q = collection(db, "marketing_events");
    const unsub = onSnapshot(q, (snapshot) => {
      const eventos = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      // Filtrar eventos que tengan asignado al usuario (en el array convocados)
      const correoUser = (user?.correo || user?.email || "").toLowerCase().trim();
      const uidUser = (user?.uid || "").toLowerCase().trim();
      const eventosUser = eventos.filter(ev => {
        // Verificar si el evento tiene IMEIs asignados
        if (!ev.imeisAsignados || ev.imeisAsignados.length === 0) return false;
        // Verificar si el usuario está en la lista de convocados
        const convocados = Array.isArray(ev.convocados) ? ev.convocados : [];
        return convocados.some(c => {
          const convocadoLower = (c || "").toLowerCase().trim();
          return convocadoLower === correoUser || convocadoLower === uidUser;
        });
      });
      setEventosAsignados(eventosUser);
    });
    return () => unsub();
  }, [user?.correo, user?.email, user?.uid]);

  // Subscribirse a eSIMs con estado usada/asignada y filtrar las asignadas al usuario
  useEffect(() => {
    const db = getFirestore();
    setCargandoEsimsAsignadas(true);
    const q = collection(db, "esims");
    const unsub = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const possibleOwners = [String(user?.email || '').toLowerCase(), String(user?.correo || '').toLowerCase(), String(user?.displayName || '').toLowerCase(), String(user?.uid || '').toLowerCase()];
      const mine = all.filter(e => {
        const estado = String(e.estado || '').toLowerCase();
        if (!['usada','asignada','asignado'].includes(estado)) return false;
        const asign = String(e.asignadoA || '').toLowerCase();
        return possibleOwners.some(po => po && asign === po);
      });
      setMisEsimsAsignadas(mine);
      setCargandoEsimsAsignadas(false);
    });
    return () => unsub();
  }, [user?.email, user?.correo, user?.displayName, user?.uid]);

  // Devolver por documento (obj con id y serie)
  async function handleDevolverEsimByDoc(esimDoc) {
    if (!esimDoc || !esimDoc.id) return;
    setDevolviendo(true);
    try {
      const db = getFirestore();
      const docRef = doc(db, 'esims', esimDoc.id);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) throw new Error('eSIM no encontrada');
        const data = snap.data();
        const estado = String(data.estado || '').toLowerCase();
        const asign = String(data.asignadoA || '').toLowerCase();
        const possibleOwners = [String(user?.email || '').toLowerCase(), String(user?.correo || '').toLowerCase(), String(user?.displayName || '').toLowerCase(), String(user?.uid || '').toLowerCase()];
        const isOwner = possibleOwners.some(po => po && asign === po);
        if (estado === 'disponible') throw new Error('La eSIM ya está disponible');
        if (!isOwner && String(user?.rol || '').toLowerCase() !== 'supervisor') {
          throw new Error('No tienes permiso para devolver esta eSIM');
        }
        tx.update(docRef, { estado: 'disponible', asignadoA: null, actualizadoEn: serverTimestamp() });
      });
      // Registrar movimiento
      const db2 = getFirestore();
      await addDoc(collection(db2, 'esims_movimientos'), {
        esimId: esimDoc.id,
        serie: esimDoc.serie || null,
        action: 'devolucion',
        byUid: user?.uid || null,
        byEmail: user?.email || user?.correo || null,
        byName: user?.displayName || user?.nombre || null,
        createdAt: serverTimestamp(),
      });
      // Intentar actualizar solicitudes_esim relacionadas (si existen)
      try {
        const serie = esimDoc.serie || '';
        // Buscar por campo serieAsignada
        const qSol = query(collection(db2, 'solicitudes_esim'), where('serieAsignada', '==', serie));
        let snapSol = await getDocs(qSol);
        if (snapSol.empty) {
          // Intentar con campo alternativo 'serie'
          const qSol2 = query(collection(db2, 'solicitudes_esim'), where('serie', '==', serie));
          snapSol = await getDocs(qSol2);
        }
        if (!snapSol.empty) {
          for (const sdoc of snapSol.docs) {
            const sRef = doc(db2, 'solicitudes_esim', sdoc.id);
            await updateDoc(sRef, {
              estado: 'devuelta',
              fechaDevolucion: serverTimestamp(),
              devueltoPorUid: user?.uid || null,
              devueltoPorEmail: user?.email || user?.correo || null,
            });
          }
        }
      } catch (err2) {
        console.warn('No se pudo actualizar solicitudes_esim:', err2);
      }

      showSnackbar('eSIM devuelta correctamente', 'success');
    } catch (err) {
      logError(err, showSnackbar);
    }
    setDevolviendo(false);
  }

  // Devolver por serie (buscar doc primero)
  async function handleDevolverEsimBySerie(serie) {
    setDevolviendo(true);
    try {
      const db = getFirestore();
      const q = query(collection(db, 'esims'), where('serie', '==', serie));
      const snap = await getDocs(q);
      if (snap.empty) {
        showSnackbar('No se encontró una eSIM con esa serie', 'error');
        setDevolviendo(false);
        return;
      }
      const esimDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
      await handleDevolverEsimByDoc(esimDoc);
      setSerieDevolver('');
    } catch (err) {
      logError(err, showSnackbar);
      setDevolviendo(false);
    }
  }

  /* ==========================
     Acciones sobre inventario / solicitudes
     ========================== */

  // Agregar IMEI a la solicitud y bloquear (en Firestore)
  async function handleAgregarYIrASolicitar(imei) {
    const db = getFirestore();
    try {
      const item = inventarioRealtime.find((it) => it.imei === imei);
      if (!item) {
        showSnackbar(`No se encontró el IMEI ${imei} en inventario`, "error", 3000);
        return;
      }
      const itemRef = doc(db, "inventario", item.id);
      await setDoc(itemRef, {
        lockedBy: user.uid,
        lockedByName: user.displayName || user.nombre || user.email || user.uid,
        lockedAt: serverTimestamp(),
        estado: "bloqueado",
      }, { merge: true });

      setImeisSolicitud((prev) => (prev.includes(imei) ? prev : [...prev, imei]));

      // Actualiza el inventario localmente para reflejar el bloqueo inmediato
      setInventarioRealtime((prevInv) =>
        prevInv.map((it) =>
          it.id === item.id ? { ...it, lockedBy: user.uid, lockedAt: new Date(), estado: "bloqueado" } : it
        )
      );
      showSnackbar(`IMEI ${imei} bloqueado temporalmente`, "success", 2000);
      effectiveSetTab("solicitar_venta");
    } catch (err) {
      logError(err, showSnackbar);
    }
  }

  // Liberar IMEI (poner disponible)
  async function handleLiberarImei(imei) {
    if (!imei) return;
    const solicitudConImei = misSolicitudes.find(sol => (sol.imeis || []).includes(imei) && (!sol.estado || sol.estado.toLowerCase() === 'solicitada'));
    if (solicitudConImei) {
      showSnackbar(`No puedes liberar el IMEI porque está en una solicitud activa. Elimina la solicitud primero.`, "error", 5000);
      return;
    }
    const db = getFirestore();
    const item = inventarioRealtime.find((it) => it.imei === imei);
    if (!item) {
      showSnackbar(`No se encontró el IMEI ${imei} en inventario`, "error", 3000);
      return;
    }
    const itemRef = doc(db, "inventario", item.id);
    try {
      await updateDoc(itemRef, { lockedBy: null, lockedAt: null, estado: "disponible" });
      setImeisSolicitud((prev) => prev.filter((v) => v !== imei));
      setInventarioRealtime((prevInv) =>
        prevInv.map((it) =>
          it.id === item.id ? { ...it, lockedBy: null, lockedAt: null, estado: "disponible" } : it
        )
      );
      showSnackbar(`IMEI ${imei} liberado`, "success", 2000);
    } catch (err) {
      logError(err, showSnackbar);
    }
  }

  // Crear solicitud y actualizar inventario
  async function handleCrearSolicitud(e) {
    e.preventDefault();
    if (!cliente || !cliente.trim()) {
      showSnackbar("El campo Cliente es obligatorio.", "error");
      return;
    }
    if (!cedulaCliente || !cedulaCliente.trim()) {
      showSnackbar("El campo Cédula del Cliente es obligatorio.", "error");
      return;
    }
    if (!pedido || !pedido.trim()) {
      showSnackbar("El campo Pedido es obligatorio.", "error");
      return;
    }
    if (!imeisSolicitud || imeisSolicitud.length === 0) {
      showSnackbar("Debe seleccionar al menos un IMEI para la solicitud.", "error");
      return;
    }
    try {
      const db = getFirestore();
      let marcaSolicitud = "-";
      let terminalSolicitud = "-";
      if (imeisSolicitud.length > 0) {
        const item = inventarioRealtime.find((it) => it.imei === imeisSolicitud[0]);
        if (item) {
          marcaSolicitud = item.marca || "-";
          terminalSolicitud = item.terminal || "-";
        }
      }
      const docRef = await addDoc(collection(db, "solicitudes"), {
        cliente,
        cedulaCliente,
        pedido,
        entrega: "",
        incluirSim,
        envioCorreo,
        observaciones,
        direccion,
        numeroSim,
        imeis: imeisSolicitud,
        marca: marcaSolicitud,
        terminal: terminalSolicitud,
        createdBy: user.uid,
        ejecutivo: user.correo || user.email || '-',
        ejecutivoNombre: user.displayName || user.nombre || '-',
        usuario: user.email || user.correo || user.usuario_red || '-',
        correo: user.email || user.correo || '-',
        nombreEjecutivo: user.displayName || user.nombre || '-',
        createdAt: serverTimestamp(),
        estado: "pendiente"
      });
      await updateDoc(doc(db, "solicitudes", docRef.id), { id: docRef.id });

      for (const imei of imeisSolicitud) {
        const item = inventarioRealtime.find((it) => it.imei === imei);
        if (!item) {
          showSnackbar(`No se encontró el IMEI ${imei} en inventario.`, "error");
          continue;
        }
        const itemRef = doc(db, "inventario", item.id);
        await updateDoc(itemRef, { lockedBy: null, lockedAt: null, estado: "solicitado" });
      }

      showSnackbar("Solicitud enviada correctamente", "success");
      handleLimpiarSolicitud();
      setImeisSolicitud([]);
      effectiveSetTab("consulta");
    } catch (err) {
      logError(err, showSnackbar);
    }
  }

  // Cuando hay IMEIs seleccionados, navegar a solicitar_venta
  useEffect(() => {
    if (imeisSolicitud && imeisSolicitud.length > 0) {
      effectiveSetTab("solicitar_venta");
    }
  }, [imeisSolicitud, effectiveSetTab]);

  /* ==========================
     Filtros memorizados
     ========================== */
  const inventarioBase = Array.isArray(props.inventario) ? props.inventario : inventarioRealtime;

  const marcasUnicas = useMemo(
    () => Array.from(new Set(inventarioBase.map((i) => i.marca).filter(Boolean))).sort(),
    [inventarioBase]
  );

  const estadosUnicos = useMemo(() => {
    const estados = inventarioBase.map((i) => i.estado).filter(Boolean);
    const estadosSinDuplicados = [];
    estados.forEach(e => {
      if (!estadosSinDuplicados.some(x => x && x.toLowerCase() === (e || '').toLowerCase())) {
        estadosSinDuplicados.push(e);
      }
    });
    if (!estadosSinDuplicados.some(x => x && x.toLowerCase() === 'bloqueado')) {
      estadosSinDuplicados.unshift('bloqueado');
    }
    if (!estadosSinDuplicados.some(x => x && x.toLowerCase() === 'vendido')) {
      estadosSinDuplicados.push('vendido');
    }
    return estadosSinDuplicados;
  }, [inventarioBase]);

  const terminalesFiltrados = useMemo(() => {
    let base = inventarioBase;
    if (tipoFiltro === "Accesorio") base = base.filter((i) => detectarTipo(i) === "Accesorio");
    else if (tipoFiltro === "Teléfono") base = base.filter((i) => detectarTipo(i) === "Teléfono");
    return Array.from(new Set(base.map((i) => i.terminal).filter(Boolean))).sort();
  }, [inventarioBase, tipoFiltro]);

  const inventarioFiltrado = useMemo(() => {
    return inventarioBase.filter((item) => {
      const matchImei = imeiFiltro ? (item.imei || "").toLowerCase().includes(imeiFiltro.toLowerCase()) : true;
      const matchMarca = marcaFiltro ? item.marca === marcaFiltro : true;
      const matchEstado = estadoFiltroInv === "" ? true : (item.estado || "") === estadoFiltroInv;
      const matchTipo = tipoFiltro === "" ? true : detectarTipo(item) === tipoFiltro;
      const matchTerminal = terminalFiltro ? item.terminal === terminalFiltro : true;
      return matchImei && matchMarca && matchEstado && matchTipo && matchTerminal;
    });
  }, [inventarioBase, imeiFiltro, marcaFiltro, estadoFiltroInv, tipoFiltro, terminalFiltro]);

  /* ==========================
     Render
     ========================== */
  return (
    <div className="exec-dashboard-container">
      {/* Header */}
      <header className="exec-dashboard-header">
        <div className="user-info">
          <span className="logo">Kolbi</span>
          <div>
            <div className="card-title">{user?.nombre || "Ejecutivo"}</div>
            <div className="card-value">{user?.correo || "-"}</div>
          </div>
        </div>
        <div className="card-title">{user?.rol ? user.rol.toUpperCase() : "EJECUTIVO"}</div>
        <button className="exec-btn" style={{ marginLeft: 24 }} onClick={handleLogout} disabled={logoutLoading}>
          {logoutLoading ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </header>

      {/* Tabs */}
      <div className="exec-cards-container">
        {effectiveTabs.map((t) => (
          <button key={t.key} className={effectiveTab === t.key ? "exec-btn active" : "exec-btn"} onClick={() => effectiveSetTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido principal */}
      <main className="exec-dashboard-footer">
        {/* Solicitar eSIM */}
        {effectiveTab === "solicitar_esim" && (
          <section>
            <SolicitarEsim />
          </section>
        )}

        {/* Mis Métricas */}
        {effectiveTab === "mis_metricas" && (
          <section>
            <MetricasEjecutivoPersonal user={user} />
          </section>
        )}

        {/* Devolución eSIMs */}
        {effectiveTab === "devolucion_esims" && (
          <section>
            <h2>Devolución eSIMs</h2>
            <div style={{ marginBottom: 12 }}>
              <h4>Tus eSIMs asignadas</h4>
              {cargandoEsimsAsignadas ? (
                <div>Cargando eSIMs asignadas...</div>
              ) : misEsimsAsignadas.length === 0 ? (
                <div>No tienes eSIMs asignadas actualmente.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {misEsimsAsignadas.map(esim => (
                    <div key={esim.id} className="exec-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div><b>Serie:</b> {esim.serie || '-'} <span style={{ marginLeft: 8 }}><b>Estado:</b> {esim.estado || '-'}</span></div>
                        <div style={{ fontSize: '0.9em', color: '#666' }}>Asignado a: {esim.asignadoA || '-'}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="exec-btn" onClick={() => { if (window.confirm('Confirma devolución de la eSIM ' + (esim.serie || '')) ) handleDevolverEsimByDoc(esim); }} disabled={devolviendo}>
                          {devolviendo ? 'Procesando...' : 'Devolver'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>Devolver por Serie</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Ingrese serie" value={serieDevolver} onChange={e => setSerieDevolver(e.target.value)} />
                <button className="exec-btn" onClick={() => { if (!serieDevolver) return showSnackbar('Ingrese una serie', 'error'); if (window.confirm('Confirma devolución de la serie ' + serieDevolver)) handleDevolverEsimBySerie(serieDevolver); }} disabled={devolviendo}>{devolviendo ? 'Procesando...' : 'Devolver por Serie'}</button>
              </div>
            </div>
          </section>
        )}

        {/* Eventos */}
        {effectiveTab === "eventos" && (
          <section>
            <MarketingEventsCalendar isSupervisor={String(user?.rol || '').toLowerCase() === 'supervisor'} />
          </section>
        )}

        {/* IMEIs de eventos */}
        {effectiveTab === "imeis_eventos" && (
          <section>
            <h2>IMEIs asignados a tus eventos</h2>
            {eventosAsignados.length === 0 ? (
              <div>No tienes eventos con IMEIs asignados.</div>
            ) : (
              <div className="exec-table">
                {eventosAsignados.map(ev => (
                  <div key={ev.id} className="exec-card" style={{ marginBottom: 12, padding: 10, background: '#f7f7f7' }}>
                    <div><b>Evento:</b> {ev.title || '-'} <span style={{ color: '#2563eb', marginLeft: 8 }}>{ev.date && ev.date.toDate ? ev.date.toDate().toLocaleDateString() : ''}</span></div>
                    <div><b>Lugar:</b> {ev.lugar || '-'}</div>
                    <div>
                      <b>IMEIs asignados:</b>{' '}
                      {Array.isArray(ev.imeisAsignados) && ev.imeisAsignados.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                          {ev.imeisAsignados.map((invId, idx) => {
                            const item = inventarioRealtime.find(it => it.id === invId);
                            const imeiLabel = item ? (item.imei || item.serie || invId) : invId;
                            const modeloLabel = item ? (item.terminal ? ` (${item.terminal})` : "") : "";
                            const yaSeleccionado = item && imeisSolicitud.includes(item.imei);
                            const bloqueadoPorOtro = item && item.lockedBy && item.lockedBy !== user.uid;
                            return (
                              <button
                                key={invId + idx}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #2563eb",
                                  background: yaSeleccionado ? "#22c55e" : bloqueadoPorOtro ? "#bdbdbd" : "#2563eb",
                                  color: "#fff",
                                  cursor: bloqueadoPorOtro ? "not-allowed" : "pointer",
                                  opacity: bloqueadoPorOtro ? 0.6 : 1,
                                }}
                                disabled={bloqueadoPorOtro}
                                onClick={async () => {
                                  if (!item) {
                                    showSnackbar(`No se encontró el inventario para el ID ${invId}`, "error");
                                    return;
                                  }
                                  await handleAgregarYIrASolicitar(item.imei);
                                }}
                              >
                                {imeiLabel}{modeloLabel}
                                {yaSeleccionado && " ✓"}
                                {bloqueadoPorOtro && " (bloqueado)"}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: '#888' }}>Ninguno</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mis Solicitudes */}
        {effectiveTab === "mis_solicitudes" && (
          <section>
            <h2>Mis Solicitudes</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input placeholder="Filtrar por Pedido" value={pedidoFiltro || ''} onChange={e => { setPaginaSolicitudes(1); setPedidoFiltro(e.target.value); }} />
              <input placeholder="Filtrar por IMEI o Serie" value={imeiFiltroSolic || ''} onChange={e => { setPaginaSolicitudes(1); setImeiFiltroSolic(e.target.value); }} />
              <input type="date" placeholder="Filtrar por Fecha" value={fechaFiltro || ''} onChange={e => { setPaginaSolicitudes(1); setFechaFiltro(e.target.value); }} />
              <input placeholder="Filtrar por Serie" value={serieFiltro || ''} onChange={e => { setPaginaSolicitudes(1); setSerieFiltro(e.target.value); }} />
            </div>

            <div>
              {(() => {
                let solicitudesFiltradas = misSolicitudes
                  .filter(s => {
                    if (pedidoFiltro && !(s.pedido || "").toLowerCase().includes(pedidoFiltro.toLowerCase())) return false;
                    if (imeiFiltroSolic && !((s.imeis && s.imeis.join(",").toLowerCase().includes(imeiFiltroSolic.toLowerCase())) || (s.imei && s.imei.toLowerCase().includes(imeiFiltroSolic.toLowerCase()))) ) return false;
                    if (fechaFiltro && s.createdAt && s.createdAt.toDate) {
                      const fechaStr = s.createdAt.toDate().toISOString().slice(0,10);
                      if (fechaStr !== fechaFiltro) return false;
                    }
                    if (serieFiltro && !(s.serie || "").toLowerCase().includes(serieFiltro.toLowerCase())) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    const fa = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
                    const fb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
                    return fb - fa;
                  });

                const seenPedidoImei = new Set();
                solicitudesFiltradas = solicitudesFiltradas.filter(s => {
                  const imeis = Array.isArray(s.imeis) && s.imeis.length > 0 ? s.imeis : [s.imei];
                  let isDuplicate = false;
                  imeis.forEach(imei => {
                    const key = (s.pedido || "") + "_" + (imei || "");
                    if (seenPedidoImei.has(key)) isDuplicate = true;
                  });
                  if (isDuplicate) return false;
                  imeis.forEach(imei => {
                    const key = (s.pedido || "") + "_" + (imei || "");
                    seenPedidoImei.add(key);
                  });
                  return true;
                });

                const totalPaginas = Math.max(1, Math.ceil(solicitudesFiltradas.length / itemsPorPaginaSolicitudes));
                const solicitudesPagina = solicitudesFiltradas.slice((paginaSolicitudes - 1) * itemsPorPaginaSolicitudes, paginaSolicitudes * itemsPorPaginaSolicitudes);
                return <>
                  {solicitudesPagina.map((s, idx) => {
                    const estadoLower = (s.estado || '').toLowerCase();
                    const esAprobada = estadoLower === 'aprobada';
                    
                    return (
                      <div key={s.id || idx} className="exec-card" style={{ marginBottom: 8, padding: 8, background: esAprobada ? '#e6fff6' : '#f7f7f7' }}>
                        <div><b>Pedido:</b> {s.pedido || '-'}</div>
                        <div><b>IMEIs:</b> {Array.isArray(s.imeis) && s.imeis.length > 0 ? s.imeis.join(", ") : (s.imei || "-")}</div>
                        <div><b>Cliente:</b> {s.cliente || '-'}</div>
                        <div><b>Estado:</b> <span style={{ 
                          color: esAprobada ? '#059669' : '#6b7280',
                          fontWeight: esAprobada ? 'bold' : 'normal'
                        }}>{s.estado ? s.estado.charAt(0).toUpperCase() + s.estado.slice(1) : '-'}</span></div>
                        <div><b>Fecha:</b> {s.createdAt && s.createdAt.toDate ? s.createdAt.toDate().toLocaleDateString() : '-'}</div>
                        <div><b>Observaciones:</b> {s.observaciones || '-'}</div>
                        
                        {esAprobada && (
                          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => generarBoletaPDF(s, user)}
                              style={{
                                background: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '8px 16px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                              }}
                            >
                              📄 Descargar Boleta PDF
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {totalPaginas > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                      <button onClick={() => setPaginaSolicitudes(p => Math.max(1, p - 1))} disabled={paginaSolicitudes === 1}>Anterior</button>
                      <span>Página {paginaSolicitudes} de {totalPaginas}</span>
                      <button onClick={() => setPaginaSolicitudes(p => Math.min(totalPaginas, p + 1))} disabled={paginaSolicitudes === totalPaginas}>Siguiente</button>
                    </div>
                  )}
                </>;
              })()}
            </div>

            {/* Modal de edición */}
            {editSolicitud && (
              <div className="exec-dashboard-header" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.25)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 320, boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}>
                  <h3>Editar Solicitud</h3>
                  <form onSubmit={e => { e.preventDefault(); /* Guardar cambios (implementa según tu lógica) */ }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input placeholder="Cliente" value={editForm.cliente} onChange={e => setEditForm(f => ({ ...f, cliente: e.target.value }))} required />
                    <input placeholder="Pedido" value={editForm.pedido} onChange={e => setEditForm(f => ({ ...f, pedido: e.target.value }))} required />
                    <input placeholder="Dirección" value={editForm.direccion} onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))} />
                    <input placeholder="Número SIM" value={editForm.numeroSim} onChange={e => setEditForm(f => ({ ...f, numeroSim: e.target.value }))} />
                    <textarea placeholder="Observaciones" value={editForm.observaciones} onChange={e => setEditForm(f => ({ ...f, observaciones: e.target.value }))} />
                    <input placeholder="IMEIs (separados por coma)" value={Array.isArray(editForm.imeis) ? editForm.imeis.join(', ') : editForm.imeis} onChange={e => setEditForm(f => ({ ...f, imeis: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} />
                    <label><input type="checkbox" checked={editForm.incluirSim} onChange={e => setEditForm(f => ({ ...f, incluirSim: e.target.checked }))} /> Incluir SIM</label>
                    <label><input type="checkbox" checked={editForm.envioCorreo} onChange={e => setEditForm(f => ({ ...f, envioCorreo: e.target.checked }))} /> Enviar correo</label>
                    <input placeholder="Entrega" value={editForm.entrega} onChange={e => setEditForm(f => ({ ...f, entrega: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="submit" style={{ padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }}>Guardar</button>
                      <button type="button" style={{ padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setEditSolicitud(null)}>Cancelar</button>
                      {(!editSolicitud.estado || editSolicitud.estado.toLowerCase() === 'solicitada') && (
                        <button
                          type="button"
                          style={{ padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer', background: '#ef4444', color: '#fff', borderRadius: 6, border: 'none' }}
                          onClick={async () => {
                            const imeis = Array.isArray(editSolicitud.imeis) ? editSolicitud.imeis : [];
                            const mensaje = `¿Seguro que deseas eliminar esta solicitud?\n\nLos siguientes IMEIs pasarán a estado DISPONIBLE:\n${imeis.join(', ')}`;
                            if (window.confirm(mensaje)) {
                              try {
                                const db = getFirestore();
                                await Promise.all(
                                  imeis.map(async (imei) => {
                                    const item = inventarioRealtime.find((it) => it.imei === imei);
                                    if (item) {
                                      const itemRef = doc(db, 'inventario', item.id);
                                      await updateDoc(itemRef, { lockedBy: null, lockedAt: null, estado: 'disponible' });
                                    }
                                  })
                                );
                                const docRef = doc(db, 'solicitudes', editSolicitud.id);
                                await deleteDoc(docRef);
                                setEditSolicitud(null);
                                showSnackbar('Solicitud eliminada y IMEIs liberados correctamente', 'success');
                              } catch (err) {
                                logError(err, showSnackbar);
                              }
                            }
                          }}
                        >Eliminar</button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Consulta inventario */}
        {effectiveTab === "consulta" && (
          <section>
            <h2>Consulta de Inventario</h2>
            <div className="exec-table" style={{ gap: 8, marginBottom: 12, display: "flex", flexWrap: "wrap" }}>
              <input placeholder="Buscar IMEI o Serie" value={imeiFiltro} onChange={(e) => setImeiFiltro(e.target.value)} />
              <select value={marcaFiltro} onChange={(e) => setMarcaFiltro(e.target.value)}>
                <option value="">Todas las marcas</option>
                {marcasUnicas.map((marca, i) => (
                  <option key={i} value={marca}>{marca}</option>
                ))}
              </select>
              <select value={estadoFiltroInv} onChange={(e) => setEstadoFiltroInv(e.target.value)}>
                <option value="">Todos los estados</option>
                {estadosUnicos.map((estado, i) => (
                  <option key={i} value={estado}>{estado.toUpperCase()}</option>
                ))}
              </select>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
                <option value="">Todos</option>
                <option value="Teléfono">Teléfono</option>
                <option value="Accesorio">Accesorio</option>
              </select>
              <select value={terminalFiltro} onChange={(e) => setTerminalFiltro(e.target.value)}>
                <option value="">Todos los terminales</option>
                {terminalesFiltrados.map((term, i) => (
                  <option key={i} value={term}>{term}</option>
                ))}
              </select>
            </div>

            <div className="exec-table">
              {inventarioFiltrado.length === 0 ? (
                <div>No se encontraron dispositivos.</div>
              ) : (
                inventarioFiltrado
                  .slice((paginaInv - 1) * itemsPorPaginaInv, paginaInv * itemsPorPaginaInv)
                  .map((item, i) => {
                    let bgColor = "#fff";
                    const estado = (item.estado || "").toLowerCase();
                    if (estado === "disponible") bgColor = "#22c55e";
                    else if (estado === "reservado") bgColor = "#ffe066";
                    else if (estado === "bloqueado") bgColor = "#ef4444";
                    else if (estado === "vendido") bgColor = "#e6d6ff";
                    const estadoMostrar = (item.estado || "").toLowerCase();
                    // usar lockedByName que se guardó al bloquear
                    const bloqueoPor = item.lockedByName || item.lockedBy || "Usuario desconocido";
                    return (
                      <div
                        className="exec-card"
                        key={item.id || i}
                        style={{
                          marginBottom: 8,
                          padding: 8,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: bgColor,
                        }}
                      >
                        <div>
                          <b>{item.imei}</b> — {item.marca} / {item.terminal}
                          <div style={{ fontSize: "0.95em", color: "#555" }}>
                            Agencia: {item.agencia || "-"} | Estado: <b>{estadoMostrar || "-"}</b> | Tipo: <b>{detectarTipo(item)}</b>
                          </div>
                          {(estado === 'bloqueado' && item.estado.toLowerCase() !== 'vendido') && (
                            <div style={{ fontSize: "0.95em", color: "#222", marginTop: 2 }}>
                              Bloqueado por: <b>{bloqueoPor}</b>
                            </div>
                          )}
                        </div>
                        {estado === "disponible" ? (
                          <button
                            className="exec-btn"
                            style={{
                              background: "linear-gradient(90deg, #00e676 0%, #00bfae 100%)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "8px",
                              padding: "8px 16px",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                            onClick={() => handleAgregarYIrASolicitar(item.imei)}
                          >
                            Solicitar venta
                          </button>
                        ) : (
                          <button disabled style={{ background: "#bdbdbd", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: "bold" }}>
                            Solicitar venta
                          </button>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {inventarioFiltrado.length > itemsPorPaginaInv && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setPaginaInv((p) => Math.max(1, p - 1))} disabled={paginaInv === 1}>Anterior</button>
                <span> Página {paginaInv} de {Math.ceil(inventarioFiltrado.length / itemsPorPaginaInv)} </span>
                <button onClick={() => setPaginaInv((p) => Math.min(Math.ceil(inventarioFiltrado.length / itemsPorPaginaInv), p + 1))} disabled={paginaInv === Math.ceil(inventarioFiltrado.length / itemsPorPaginaInv)}>Siguiente</button>
              </div>
            )}
          </section>
        )}

        {/* Solicitar Venta */}
        {effectiveTab === "solicitar_venta" && (
          <section>
            <h2>Solicitar Venta</h2>
            {imeisSolicitud.length === 0 ? (
              <div>No has seleccionado ningún IMEI o Serie para solicitar.</div>
            ) : (
              <div className="exec-dashboard-footer">
                <form onSubmit={handleCrearSolicitud} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} required />
                  <input placeholder="Cédula del Cliente" value={cedulaCliente} onChange={(e) => setCedulaCliente(e.target.value)} required />
                  <input placeholder="Pedido" value={pedido} onChange={(e) => setPedido(e.target.value)} required />
                  <input placeholder="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                  <input placeholder="Número SIM" value={numeroSim} onChange={(e) => setNumeroSim(e.target.value)} />
                  <textarea placeholder="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                  <label>
                    <input type="checkbox" checked={incluirSim} onChange={(e) => setIncluirSim(e.target.checked)} /> Incluir SIM
                  </label>
                  <label>
                    <input type="checkbox" checked={envioCorreo} onChange={(e) => setEnvioCorreo(e.target.checked)} /> Enviar correo
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" style={{ padding: "8px 16px", fontWeight: "bold", cursor: "pointer" }}>Enviar Solicitud</button>
                    <button type="button" style={{ padding: "8px 16px", fontWeight: "bold", cursor: "pointer" }} onClick={handleLimpiarSolicitud}>Limpiar</button>
                  </div>
                </form>

                <div style={{ marginTop: 12 }}>
                  <h4>IMEIs Seleccionados:</h4>
                  {imeisSolicitud.map((imei) => (
                    <div key={imei} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span>{imei}</span>
                      <button type="button" onClick={() => handleLiberarImei(imei)} style={{ background: "#ef4444", color: "#fff", borderRadius: 6, border: "none", padding: "4px 8px" }}>Liberar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Bloqueados */}
        {effectiveTab === "bloqueados" && (
          <section>
            <h2>🔒 IMEIs Bloqueados por Ti</h2>
            {inventarioBase.filter((item) => item.lockedBy === user.uid).length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#666" }}>No tienes IMEIs bloqueados por ti.</div>
            ) : (
              inventarioBase
                .filter((item) => item.lockedBy === user.uid && item.imei && item.marca && item.terminal)
                .map((item) => {
                  // Verificar si hay solicitud PENDIENTE o APROBADA para este IMEI
                  const solicitudActiva = misSolicitudes.some(sol =>
                    (sol.estado === "aprobada" || sol.estado === "pendiente") && 
                    (sol.imeis || []).includes(item.imei)
                  );
                  
                  
                  const puedeLiberar = !solicitudActiva;
                  
                  return (
                    <div key={item.id} className="card card-kolbi bloqueado-por-mi" style={{ 
                      padding: 12, 
                      marginBottom: 12, 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      background: solicitudActiva ? "#fff3cd" : "#f0f4f8",
                      borderRadius: 8,
                      border: solicitudActiva ? "1px solid #ffc107" : "1px solid #ddd"
                    }}>
                      <div>
                        <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                          {item.imei} — {item.marca} | {item.terminal}
                        </div>
                        <div style={{ fontSize: "0.85em", color: "#666" }}>
                          {solicitudActiva ? "⏳ Tiene solicitud " + (misSolicitudes.find(sol => (sol.imeis || []).includes(item.imei))?.estado || "") : "✅ Disponible para liberar"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLiberarImei(item.imei)}
                        disabled={!puedeLiberar}
                        title={solicitudActiva ? "No puedes liberar: hay una solicitud activa" : "Liberar este IMEI"}
                        style={{ 
                          background: puedeLiberar ? "#00e676" : "#bdbdbd", 
                          color: "#fff", 
                          borderRadius: 6, 
                          border: "none", 
                          padding: "8px 16px", 
                          fontWeight: "bold", 
                          cursor: puedeLiberar ? "pointer" : "not-allowed", 
                          marginLeft: 12,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {puedeLiberar ? "🔓 Liberar" : "🔒 Bloqueado"}
                      </button>
                    </div>
                  );
                })
            )}
          </section>
        )}
      </main>

      <Snackbar message={snackbar.message} type={snackbar.type} onClose={() => setSnackbar({ message: "", type: "info" })} />
    </div>
  );
}

export default EjecutivoDashboard;
