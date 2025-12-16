// SupervisorDashboard.js
import React, { useState, useEffect } from "react";
import { useRef } from "react";
import MarketingEventsCalendar from "./MarketingEventsCalendar";
import ReservarTerminalesParaEventos from "./ReservarTerminalesParaEventos";
import MetricasEjecutivos from "./MetricasEjecutivos";
import CargaInventarioMetricas from "./CargaInventarioMetricas";
import CargaInventarioUpload from "./CargaInventarioUpload";
import CargarEsim from "./CargarEsim";
import AnalisisEsim from "./AnalisisEsim";
import "./SupervisorDashboard.css";

import EjecutivoDashboard from "./EjecutivoDashboard";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getFirestore,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { generarBoletaPDF } from "../services/boletaPdfGenerator";
import { getAuth, signOut } from "firebase/auth";
import { detectarTipo } from "../utils/helpers";

/*
  Nota sobre estilos:
  - Usas CSS normal (no module). Para mantener las referencias estilo `styles.xxx`
    definimos un proxy que mapea a nombres kebab-case / aliases.
*/
const styleMap = {
  dashboardContainer: "dashboard-container",
  dashboardHeader: "dashboard-header",
  headerLeft: "header-left",
  headerUser: "supervisor-user",
  dashboardBody: "supervisor-main",
  sidebar: "supervisor-sidebar",
  btnKolbi: "btn-kolbi",
  btnKolbiAlt: "btn-kolbi",
  mainContent: "supervisor-content",
  panel: "supervisor-content",
  list: "list",
  card: "card-kolbi",
  cardKolbi: "card-kolbi",
  formGrid: "form-grid",
  dashboardFooter: "supervisor-footer",
  logo: "logo",
  loading: "loading",
  formActions: "form-actions",
};
const styles = new Proxy(styleMap, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    const s = String(prop).replace(/([A-Z])/g, (m) => "-" + m.toLowerCase());
    return s;
  },
});

function VerMasSolicitud({ datos }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        style={{
          marginTop: 8,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "6px 16px",
          cursor: "pointer",
        }}
        onClick={() => setOpen(true)}
      >
        Ver más
      </button>
      {open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.3)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 12,
              minWidth: 340,
              maxWidth: 700,
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <h3>Detalles de la Solicitud</h3>
            <div style={{ marginTop: 8 }}>
              <div>
                <b>Ejecutivo:</b>{" "}
                {datos.ejecutivoNombre || datos.ejecutivo || datos.usuario || "-"}
              </div>
              <div>
                <b>Usuario:</b> {datos.usuario || "-"}
              </div>
              <div>
                <b>Cliente:</b> {datos.cliente || "-"}
              </div>
              <div>
                <b>Pedido:</b> {datos.pedido || "-"}
              </div>
              <div>
                <b>Entrega:</b> {datos.entrega || "-"}
              </div>
              <div>
                <b>Incluye SIM:</b> {datos.incluirSim ? "Sí" : "No"}
              </div>
              <div>
                <b>Envío correo:</b> {datos.envioCorreo ? "Sí" : "No"}
              </div>
              <div>
                <b>Dirección:</b> {datos.direccion || "-"}
              </div>
              <div>
                <b>Número SIM:</b> {datos.numeroSim || "-"}
              </div>
              <div>
                <b>IMEIs:</b>{" "}
                {Array.isArray(datos.imeis) ? datos.imeis.join(", ") : datos.imei || "-"}
              </div>
              <div>
                <b>Observaciones:</b> {datos.observaciones || datos.notas || "-"}
              </div>
              <div>
                <b>Estado:</b> {datos.estado || "-"}
              </div>
              <div>
                <b>Fecha:</b>{" "}
                {datos.createdAt && typeof datos.createdAt.toDate === "function"
                  ? datos.createdAt.toDate().toLocaleString()
                  : datos.createdAt || datos.fecha || "-"}
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 20px",
                  cursor: "pointer",
                }}
                onClick={() => setOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


export default function SupervisorDashboard({ user, inventario: inventarioProp }) {
  // ========== Estados ==========
  const [inventarioState, setInventarioState] = useState([]);
  const inventario = inventarioProp || inventarioState;
  const [filteredInventario, setFilteredInventario] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unsubscribeInv, setUnsubscribeInv] = useState(null);

  const [filtroEjecutivo, setFiltroEjecutivo] = useState("");
  const [paginaEjecutivos, setPaginaEjecutivos] = useState(1);
  const itemsPorPaginaEjecutivos = 10;
  const [ejecutivos, setEjecutivos] = useState([]);
  const ejecutivosFiltrados = ejecutivos.filter((ej) => {
    const filtro = filtroEjecutivo.trim().toLowerCase();
    if (!filtro) return true;
    return (
      (ej.nombre && ej.nombre.toLowerCase().includes(filtro)) ||
      (ej.correo && ej.correo.toLowerCase().includes(filtro)) ||
      (ej.departamento && ej.departamento.toLowerCase().includes(filtro))
    );
  });
  const totalPaginasEjecutivos = Math.max(
    1,
    Math.ceil(ejecutivosFiltrados.length / itemsPorPaginaEjecutivos)
  );
  const ejecutivosPaginados = ejecutivosFiltrados.slice(
    (paginaEjecutivos - 1) * itemsPorPaginaEjecutivos,
    paginaEjecutivos * itemsPorPaginaEjecutivos
  );

  // filtros inventario
  const [imeiSearch, setImeiSearch] = useState("");
  const [marcaSearch, setMarcaSearch] = useState("");
  const [estadoSearch, setEstadoSearch] = useState("");
  const [tipoSearch, setTipoSearch] = useState("");

  // paginación inventario
  const [paginaInv, setPaginaInv] = useState(1);
  const itemsPorPaginaInv = 20;

  // solicitudes y ejecutivos
  const [solicitudes, setSolicitudes] = useState([]);

  // filtros solicitudes
  const [filtroPedido, setFiltroPedido] = useState("");
  const [filtroCedulaCliente, setFiltroCedulaCliente] = useState("");
  const [filtroImeiSerie, setFiltroImeiSerie] = useState("");
  const [filtroPedidoPendiente, setFiltroPedidoPendiente] = useState("");
  const [filtroCedulaClientePendiente, setFiltroCedulaClientePendiente] = useState("");
  const [filtroImeiSeriePendiente, setFiltroImeiSeriePendiente] = useState("");
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroFechaInicioPendiente, setFiltroFechaInicioPendiente] = useState("");
  const [filtroFechaFinPendiente, setFiltroFechaFinPendiente] = useState("");

  // paginación solicitudes
  const [paginaSol, setPaginaSol] = useState(1);
  const itemsPorPaginaSol = 10;

  // UI y navegación
  const [tab, setTab] = useState("consulta");
  const [logoutLoading, setLogoutLoading] = useState(false);

  // ejecutivos form
  const [nuevoEjecutivoNombre, setNuevoEjecutivoNombre] = useState("");
  const [nuevoEjecutivoCorreo, setNuevoEjecutivoCorreo] = useState("");
  const [nuevoEjecutivoDepartamento, setNuevoEjecutivoDepartamento] = useState("");
  const [nuevoEjecutivoUsuarioRed, setNuevoEjecutivoUsuarioRed] = useState("");
  const [nuevoEjecutivoCedula, setNuevoEjecutivoCedula] = useState("");
  const [nuevoEjecutivoRol, setNuevoEjecutivoRol] = useState("ejecutivo");
  const [datosEditEjecutivo, setDatosEditEjecutivo] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);

  // logger helper
  const logCriticalErrorBackend = (err) => console.error(err);

  // ========== fetchData ==========
  async function fetchData() {
    setLoading(true);
    try {
      const dbf = getFirestore();
      const snapEj = await getDocs(collection(dbf, "usuarios"));
      setEjecutivos(snapEj.docs.map((d) => ({ id: d.id, ...d.data() })));

      const snapSol = await getDocs(collection(dbf, "solicitudes"));
      setSolicitudes(snapSol.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      logCriticalErrorBackend(err);
    } finally {
      setLoading(false);
    }
  }

  // ========== Real-time inventory sync ==========
  useEffect(() => {
    if (!inventarioProp) {
      const dbf = getFirestore();
      const unsub = onSnapshot(collection(dbf, "inventario"), (snapshot) => {
        setInventarioState(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      setUnsubscribeInv(() => unsub);
      return () => {
        try {
          if (unsubscribeInv) unsubscribeInv();
        } catch (e) {
          // ignore
        }
        try {
          unsub();
        } catch (e) {
          // ignore
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventarioProp]);

  // carga inicial
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========== CORRECCIÓN AUTOMÁTICA AL CARGAR ==========
  useEffect(() => {
    // Ejecutar solo una vez cuando tengamos solicitudes e inventario
    if (solicitudes.length > 0 && inventario.length > 0 && !skipAutoCorrection.current) {
      corregirAprobacionesAutomaticamente();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudes.length, inventario.length]);

  async function corregirAprobacionesAutomaticamente() {
    try {
      const dbf = getFirestore();
      
      // Buscar solicitudes aprobadas
      const solicitudesAprobadas = solicitudes.filter(
        sol => (sol.estado || "").toLowerCase() === "aprobada"
      );
      
      if (solicitudesAprobadas.length === 0) return;
      
      console.log(`🔧 Corrección automática: ${solicitudesAprobadas.length} solicitudes aprobadas encontradas`);
      
      for (const sol of solicitudesAprobadas) {
        const imeisSol = Array.isArray(sol.imeis) ? sol.imeis : (sol.imei ? [sol.imei] : []);
        
        for (const imei of imeisSol) {
          // Buscar el IMEI en inventario local
          const itemLocal = inventario.find(item => item.imei === imei);
          
          if (!itemLocal) continue;
          
          const estadoActual = (itemLocal.estado || "").toLowerCase();
          
          // Si NO está en vendido, corregir
          if (estadoActual !== "vendido") {
            console.log(`🔄 Auto-corrección: ${imei} de "${estadoActual}" a "vendido"`);
            
            try {
              const q = query(collection(dbf, "inventario"), where("imei", "==", imei));
              const snap = await getDocs(q);
              
              if (!snap.empty) {
                const docRef = doc(dbf, "inventario", snap.docs[0].id);
                await updateDoc(docRef, {
                  estado: "vendido",
                  lockedBy: null,
                  lockedByName: null,
                  lockedAt: null
                });
                
                // Verificar si ya existe en vendidos
                const vendidosQ = query(collection(dbf, "vendidos"), where("imei", "==", imei));
                const vendidosSnap = await getDocs(vendidosQ);
                
                if (vendidosSnap.empty) {
                  await addDoc(collection(dbf, "vendidos"), {
                    ...itemLocal,
                    estado: "vendido",
                    ejecutivo: sol.ejecutivo || sol.createdBy || "",
                    pedido: sol.pedido || "",
                    cliente: sol.cliente || "",
                    fechaVenta: sol.createdAt || new Date().toISOString(),
                    corregidoAutomaticamente: true,
                    corregidoEn: new Date().toISOString()
                  });
                }
                
                console.log(`✅ Auto-corregido: ${imei}`);
              }
            } catch (err) {
              console.error(`❌ Error auto-corrigiendo ${imei}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Error en corrección automática:", err);
    }
  }

  // bandera para evitar que la corrección automática intervenga durante operaciones masivas
  const skipAutoCorrection = useRef(false);

  // ========== Filtrado inventario ==========
  useEffect(() => {
    const searchImei = (imeiSearch || "").toString().toLowerCase().replace(/\s+/g, "");
    const searchMarca = (marcaSearch || "").toString().toLowerCase().replace(/\s+/g, "");
    const searchEstado = (estadoSearch || "").toString().toLowerCase().replace(/\s+/g, "");
    const searchTipo = (tipoSearch || "").toString();

    const filtrados = inventario.filter((item) => {
      const imei = (item.imei || "").toString().toLowerCase().replace(/\s+/g, "");
      const marca = (item.marca || "").toString().toLowerCase().replace(/\s+/g, "");
      const terminal = (item.terminal || "").toString().toLowerCase().replace(/\s+/g, "");
      const agencia = (item.agencia || "").toString().toLowerCase().replace(/\s+/g, "");
      const estado = (item.estado || "").toString().toLowerCase().replace(/\s+/g, "");

      const matchImei =
        !searchImei || imei.includes(searchImei) || terminal.includes(searchImei) || agencia.includes(searchImei);
      const matchMarca = !searchMarca || marca === searchMarca;
      
      // ✅ FILTRO CORREGIDO: Cada estado es único, sin agrupaciones
      const matchEstado = !searchEstado || estado === searchEstado;
      
      const matchTipo = !searchTipo || detectarTipo(item) === searchTipo;

      return matchImei && matchMarca && matchEstado && matchTipo;
    });

    setFilteredInventario(filtrados);
  }, [inventario, imeiSearch, marcaSearch, estadoSearch, tipoSearch]);

  // ========== Helpers ==========
  async function handleLogout() {
    setLogoutLoading(true);
    try {
      const auth = getAuth();
      await signOut(auth);
      window.location.href = "/";
    } catch (err) {
      alert("Error al cerrar sesión: " + err.message);
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleEliminarSolicitudes() {
    if (!window.confirm("¿Seguro que quieres eliminar TODAS las solicitudes? Esta acción no se puede deshacer.")) return;
    skipAutoCorrection.current = true;
    try {
      const dbf = getFirestore();
      const snap1 = await getDocs(collection(dbf, "solicitudes"));
      const docs = snap1.docs.map(d => d.id);
      // Borrar en paralelo por lotes pequeños para evitar timeouts
      const chunkSize = 50;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const results = await Promise.allSettled(chunk.map(id => deleteDoc(doc(dbf, "solicitudes", id))));
        const rejections = results.filter(r => r.status === 'rejected');
        if (rejections.length > 0) console.warn('Errores borrando solicitudes en chunk:', rejections);
      }

      try {
        const snap2 = await getDocs(collection(dbf, "solicitudes_multi_imei"));
        const docs2 = snap2.docs.map(d => d.id);
        for (let i = 0; i < docs2.length; i += chunkSize) {
          const chunk = docs2.slice(i, i + chunkSize);
          await Promise.allSettled(chunk.map(id => deleteDoc(doc(dbf, "solicitudes_multi_imei", id))));
        }
      } catch (err) {
        console.warn('Error borrando solicitudes_multi_imei (se ignorará):', err);
      }

      await fetchData();
      alert("Todas las solicitudes han sido eliminadas.");
    } catch (err) {
      console.error('Error eliminando solicitudes:', err);
      alert("Error eliminando solicitudes: " + (err.message || err));
    } finally {
      skipAutoCorrection.current = false;
    }
  }

  async function handleEliminarInventario() {
    if (!window.confirm("¿Seguro que quieres eliminar TODO el inventario excepto los bloqueados? Esta acción no se puede deshacer.")) return;
    skipAutoCorrection.current = true;
    try {
      const dbf = getFirestore();
      const snap = await getDocs(collection(dbf, "inventario"));
      const chunkSize = 50;
      const toDelete = snap.docs.filter(d => {
        const estado = d.data().estado;
        return estado !== "solicitado" && estado !== "pendiente";
      }).map(d => d.id);

      let eliminados = 0;
      for (let i = 0; i < toDelete.length; i += chunkSize) {
        const chunk = toDelete.slice(i, i + chunkSize);
        const results = await Promise.allSettled(chunk.map(id => deleteDoc(doc(dbf, "inventario", id))));
        eliminados += results.filter(r => r.status === 'fulfilled').length;
        const rejections = results.filter(r => r.status === 'rejected');
        if (rejections.length > 0) console.warn('Errores borrando inventario en chunk:', rejections);
      }

      await fetchData();
      alert(`Inventario eliminado (${eliminados} dispositivos, bloqueados conservados).`);
    } catch (err) {
      console.error('Error eliminando inventario:', err);
      alert("Error eliminando inventario: " + (err.message || err));
    } finally {
      skipAutoCorrection.current = false;
    }
  }

  async function handleBorrarImei(imeiABorrar) {
    if (!window.confirm(`¿Seguro que quieres borrar el IMEI ${imeiABorrar} de la base de datos? Esta acción no se puede deshacer.`)) return;
    try {
      const dbf = getFirestore();
      const snap = await getDocs(query(collection(dbf, "inventario"), where("imei", "==", imeiABorrar)));
      if (snap.empty) {
        alert(`No se encontró el IMEI ${imeiABorrar}`);
        return;
      }
      for (const d of snap.docs) {
        await deleteDoc(doc(dbf, "inventario", d.id));
      }
      await fetchData();
      alert(`✅ IMEI ${imeiABorrar} eliminado exitosamente.`);
    } catch (err) {
      alert("Error eliminando IMEI: " + (err.message || err));
    }
  }

  // ========== Ejecutivos ==========
  function handleEditarEjecutivo(identificador) {
    let ej = null;
    if (typeof identificador === "string") {
      ej = ejecutivos.find((x) => x.correo === identificador);
      if (!ej) {
        setDatosEditEjecutivo({
          _id: null,
          nombre: "",
          correo: identificador,
          cedula: "",
          usuario_red: "",
          telefono: "",
          departamento: "",
          estado: "activo",
          rol: "ejecutivo",
        });
        setEditModalVisible(true);
        return;
      }
    } else if (typeof identificador === "object" && identificador !== null) {
      ej = identificador;
    }
    if (!ej) {
      setDatosEditEjecutivo({
        _id: null,
        nombre: "",
        correo: "",
        cedula: "",
        usuario_red: "",
        telefono: "",
        departamento: "",
        estado: "activo",
        rol: "ejecutivo",
      });
    } else {
      setDatosEditEjecutivo({
        _id: ej.id || ej._id || null,
        nombre: ej.nombre || "",
        correo: ej.correo || "",
        cedula: ej.cedula || "",
        usuario_red: ej.usuario_red || "",
        telefono: ej.telefono || "",
        departamento: ej.departamento || "",
        estado: ej.estado || "activo",
        rol: ej.rol || "ejecutivo",
      });
    }
    setEditModalVisible(true);
  }

  async function handleGuardarEjecutivoEditado(e) {
    e && e.preventDefault && e.preventDefault();
    try {
      const dbf = getFirestore();
      console.log("🔍 Guardando ejecutivo con datos:", datosEditEjecutivo);
      console.log("📋 Rol a guardar:", datosEditEjecutivo.rol);
      
      if (datosEditEjecutivo._id) {
        const ref = doc(dbf, "usuarios", datosEditEjecutivo._id);
        await updateDoc(ref, {
          nombre: datosEditEjecutivo.nombre,
          correo: datosEditEjecutivo.correo,
          cedula: datosEditEjecutivo.cedula,
          usuario_red: datosEditEjecutivo.usuario_red,
          telefono: datosEditEjecutivo.telefono,
          departamento: datosEditEjecutivo.departamento,
          estado: datosEditEjecutivo.estado,
          rol: datosEditEjecutivo.rol || "ejecutivo",
        });
        console.log("✅ Documento actualizado:", datosEditEjecutivo._id);
      } else {
        await addDoc(collection(dbf, "usuarios"), {
          nombre: datosEditEjecutivo.nombre,
          correo: datosEditEjecutivo.correo,
          cedula: datosEditEjecutivo.cedula,
          usuario_red: datosEditEjecutivo.usuario_red,
          telefono: datosEditEjecutivo.telefono,
          departamento: datosEditEjecutivo.departamento,
          estado: datosEditEjecutivo.estado || "activo",
          rol: datosEditEjecutivo.rol || "ejecutivo",
        });
      }
      await fetchData();
      setEditModalVisible(false);
      alert("Ejecutivo guardado correctamente.");
    } catch (err) {
      console.error("Error guardando ejecutivo:", err);
      alert("Error guardando ejecutivo. Revise la consola.");
    }
  }

  // ========== Inventario registrar / limpiar ==========

  async function handleAprobarSolicitud(sol) {
    console.log("DEBUG: handleAprobarSolicitud ejecutada", sol);
    console.log("INVENTARIO COMPLETO:", inventario);
    if (sol.tipo === "multi" && Array.isArray(sol.imeis) && sol.imeis.length > 0) {
      sol.imeis.forEach((imei) => {
        const invItem = inventario.find((item) => (item.imei || "").replace(/\s+/g, "") === (imei || "").replace(/\s+/g, ""));
        console.log(`[APROBAR] IMEI: ${imei} | Estado actual: ${invItem?.estado} | Inventario encontrado:`, invItem);
      });
    } else if (sol.imei) {
      const invItem = inventario.find((item) => (item.imei || "").replace(/\s+/g, "") === (sol.imei || "").replace(/\s+/g, ""));
      console.log(`[APROBAR] IMEI: ${sol.imei} | Estado actual: ${invItem?.estado} | Inventario encontrado:`, invItem);
    }
    try {
      const dbf = getFirestore();
      const normalizarEstado = (v) => (v ? String(v).toLowerCase().replace(/\s+/g, "") : "");
      let errores = [];
      let exitos = [];
      if (sol.tipo === "multi" && Array.isArray(sol.imeis) && sol.imeis.length > 0) {
        for (const imei of sol.imeis) {
          const q = query(collection(dbf, "inventario"), where("imei", "==", imei));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const docRef = doc(dbf, "inventario", snap.docs[0].id);
            const docData = snap.docs[0].data();
            const estadoActual = normalizarEstado(docData.estado);
            console.log(`✅ [ACTUALIZAR] IMEI ${imei} | Estado antes: '${docData.estado}' (normalizado: '${estadoActual}')`);
            
            // ✅ PERMITIR APROBAR cualquier estado excepto "vendido" y "disponible"
            if (estadoActual === "vendido") {
              let motivo = `IMEI ${imei} ya está VENDIDO. No se puede aprobar nuevamente.`;
              console.error(motivo);
              alert(motivo);
              errores.push(imei);
            } else {
              // Actualizar a vendido sin importar el estado actual
              console.log(`🔄 [PRE-UPDATE] IMEI ${imei} | Estado actual en Firestore: "${docData.estado}"`);
              
              await updateDoc(docRef, { 
                estado: "vendido", 
                lockedBy: null, 
                lockedByName: null,
                lockedAt: null 
              });
              
              console.log(`✅ [POST-UPDATE] IMEI ${imei} → estado actualizado a 'vendido' en Firestore`);
              
              // Verificar inmediatamente después de actualizar
              const verificarSnap = await getDocs(q);
              const verificarData = verificarSnap.docs[0].data();
              console.log(`🔍 [VERIFICACIÓN] IMEI ${imei} | Estado después de update: "${verificarData.estado}"`);
              
              // ✅ ACTUALIZAR ESTADO LOCAL INMEDIATAMENTE
              setInventarioState(prevInv => 
                prevInv.map(item => 
                  item.imei === imei 
                    ? { ...item, estado: "vendido", lockedBy: null, lockedByName: null, lockedAt: null }
                    : item
                )
              );
              
              await addDoc(collection(dbf, "vendidos"), {
                ...docData,
                estado: "vendido",
                vendidoAt: new Date().toISOString(),
                ejecutivo: sol.ejecutivo || sol.ejecutivoNombre || sol.usuario || sol.correo || "",
                ejecutivoNombre: sol.ejecutivoNombre || sol.ejecutivo || "",
                ejecutivoUid: sol.ejecutivoUid || sol.uid || ""
              });
              exitos.push(imei);
            }
          } else {
            let motivo = `IMEI ${imei} no encontrado en Firestore.`;
            console.error(motivo);
            alert(motivo);
            errores.push(imei);
          }
        }
      } else if (sol.imei) {
        const q = query(collection(dbf, "inventario"), where("imei", "==", sol.imei));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docRef = doc(dbf, "inventario", snap.docs[0].id);
          const docData = snap.docs[0].data();
          const estadoActual = normalizarEstado(docData.estado);
          console.log(`✅ [ACTUALIZAR] IMEI ${sol.imei} | Estado antes: '${docData.estado}' (normalizado: '${estadoActual}')`);
          
          // ✅ PERMITIR APROBAR cualquier estado excepto "vendido" y "disponible"
          if (estadoActual === "vendido") {
            let motivo = `IMEI ${sol.imei} ya está VENDIDO. No se puede aprobar nuevamente.`;
            console.error(motivo);
            alert(motivo);
            errores.push(sol.imei);
          } else {
            // Actualizar a vendido sin importar el estado actual
            console.log(`🔄 [PRE-UPDATE] IMEI ${sol.imei} | Estado actual en Firestore: "${docData.estado}"`);
            
            await updateDoc(docRef, { 
              estado: "vendido", 
              lockedBy: null, 
              lockedByName: null,
              lockedAt: null 
            });
            
            console.log(`✅ [POST-UPDATE] IMEI ${sol.imei} → estado actualizado a 'vendido' en Firestore`);
            
            // Verificar inmediatamente después de actualizar
            const verificarSnap = await getDocs(q);
            const verificarData = verificarSnap.docs[0].data();
            console.log(`🔍 [VERIFICACIÓN] IMEI ${sol.imei} | Estado después de update: "${verificarData.estado}"`);
            
            // ✅ ACTUALIZAR ESTADO LOCAL INMEDIATAMENTE
            setInventarioState(prevInv => 
              prevInv.map(item => 
                item.imei === sol.imei 
                  ? { ...item, estado: "vendido", lockedBy: null, lockedByName: null, lockedAt: null }
                  : item
              )
            );
            
            await addDoc(collection(dbf, "vendidos"), {
              ...docData,
              estado: "vendido",
              vendidoAt: new Date().toISOString(),
              ejecutivo: sol.ejecutivo || sol.ejecutivoNombre || sol.usuario || sol.correo || "",
              ejecutivoNombre: sol.ejecutivoNombre || sol.ejecutivo || "",
              ejecutivoUid: sol.ejecutivoUid || sol.uid || ""
            });
            exitos.push(sol.imei);
          }
        } else {
          let motivo = `IMEI ${sol.imei} no encontrado en Firestore.`;
          console.error(motivo);
          alert(motivo);
          errores.push(sol.imei);
        }
      }
      if (sol.id) {
        await updateDoc(doc(dbf, "solicitudes", sol.id), { estado: "aprobada" });
        
        // ✅ ACTUALIZAR ESTADO LOCAL DE LA SOLICITUD INMEDIATAMENTE
        setSolicitudes(prevSol => 
          prevSol.map(s => 
            s.id === sol.id 
              ? { ...s, estado: "aprobada" }
              : s
          )
        );
      }
      
      // ✅ Limpiar filtros y forzar refresh completo
      setEstadoSearch("");
      
      // ✅ Esperar a que Firestore procese todas las actualizaciones
      await new Promise(resolve => setTimeout(resolve, 800));
      
      let msg = "✅ Solicitud aprobada y dispositivo(s) pasados a VENDIDO.\n";
      if (exitos.length > 0) msg += `IMEIs actualizados a 'vendido': ${exitos.join(", ")}.\n`;
      if (errores.length > 0) msg += `⚠️ Errores: ${errores.join(", ")}`;
      alert(msg);
    } catch (err) {
      console.error("❌ ERROR al aprobar solicitud:", err);
      alert("Error al aprobar solicitud: " + (err.message || err));
    }
  }

  async function handleRechazarSolicitud(sol) {
    if (!window.confirm("¿Seguro que quieres rechazar esta solicitud?")) return;
    try {
      const dbf = getFirestore();
      if (sol.id) {
        // 1. Marcar solicitud como rechazada
        await updateDoc(doc(dbf, "solicitudes", sol.id), { estado: "rechazada" });
        
        // 2. Liberar todos los IMEIs de esta solicitud
        if (sol.imeis && Array.isArray(sol.imeis)) {
          for (const imei of sol.imeis) {
            // Buscar el documento del inventario por IMEI
            const inventarioQuery = query(
              collection(dbf, "inventario"),
              where("imei", "==", imei)
            );
            const snapshots = await getDocs(inventarioQuery);
            
            // Usar for...of para esperar cada actualización
            for (const docSnap of snapshots.docs) {
              await updateDoc(doc(dbf, "inventario", docSnap.id), {
                estado: "disponible",
                lockedBy: null,
                lockedAt: null
              });
              console.log(`✅ IMEI ${imei} liberado a disponible`);
            }
          }
        }
      }
      await fetchData();
      alert("Solicitud rechazada y IMEIs liberados.");
    } catch (err) {
      console.error("Error en rechazar solicitud:", err);
      alert("Error al rechazar solicitud: " + (err.message || err));
    }
  }

  const marcasUnicas = Array.from(new Set(inventario.map((item) => item.marca).filter(Boolean))).sort();
  const estadosUnicos = Array.from(new Set(inventario.map((item) => (item.estado || "").toLowerCase().trim()).filter(Boolean))).sort();

  async function handleEliminarEjecutivo(uid) {
    if (!window.confirm("¿Seguro que quieres eliminar este ejecutivo? Esta acción no se puede deshacer.")) return;
    try {
      const response = await fetch("/deleteEjecutivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      await fetchData();
      alert("Ejecutivo eliminado correctamente.");
    } catch (err) {
      console.error("Error eliminando ejecutivo:", err);
      alert("Error eliminando ejecutivo. Revise la consola. " + (err.message || err));
    }
  }

  // ========== RENDER ==========
  if (user && user.rol === "ejecutivo") {
    return (
      <EjecutivoDashboard
        user={user}
        inventario={inventario}
        loading={loading}
        filteredInventario={filteredInventario}
        tab={tab}
        setTab={setTab}
      />
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.dashboardHeader} style={{ position: "relative" }}>
        <div className={styles.headerLeft}>
          <img src="/logo192.png" alt="Logo" className={styles.logo} style={{ height: 40 }} />
          <h1>Kolbi Monitor Sells</h1>
        </div>
        <div className={styles.headerUser}>&copy; Derechos reservados Infinix</div>
      </header>

      <div className={styles.dashboardBody} style={{ display: "flex" }}>
        <aside className={styles.sidebar} aria-label="Menú principal" style={{ padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <h2 style={{ textAlign: "center", color: "#000000" }}>Panel</h2>
            <ul style={{ paddingLeft: 0, flex: "0 0 auto" }}>
              <li onClick={() => setTab("consulta")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px" }}>🔍 Consulta</li>
              <li onClick={() => setTab("solicitudes")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "solicitudes" ? "#2563eb" : undefined, fontWeight: tab === "solicitudes" ? "bold" : undefined }}>📋 Solicitudes</li>
              <li onClick={() => setTab("ejecutivos")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px" }}>👥 Ejecutivos</li>
              <li onClick={() => setTab("agregar_ejecutivo")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px" }}>➕ Agregar Ejecutivo</li>
              <li onClick={() => setTab("metricas")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "metricas" ? "#2563eb" : undefined, fontWeight: tab === "metricas" ? "bold" : undefined }}>📊 Métricas Ejecutivos</li>
              <li onClick={() => setTab("carga_inventario")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "carga_inventario" ? "#2563eb" : undefined, fontWeight: tab === "carga_inventario" ? "bold" : undefined }}>📦 Carga Inventario</li>
              <li onClick={() => setTab("analisis_inventario")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "analisis_inventario" ? "#2563eb" : undefined, fontWeight: tab === "analisis_inventario" ? "bold" : undefined }}>📊 Análisis Inventario</li>
              <li onClick={() => setTab("cargar_esim")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "cargar_esim" ? "#2563eb" : undefined, fontWeight: tab === "cargar_esim" ? "bold" : undefined }}>📲 Cargar eSIM</li>
              <li onClick={() => setTab("analisis_esim")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "analisis_esim" ? "#2563eb" : undefined, fontWeight: tab === "analisis_esim" ? "bold" : undefined }}>📊 Análisis eSIM</li>
              <li onClick={() => setTab("eventos")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "eventos" ? "#2563eb" : undefined, fontWeight: tab === "eventos" ? "bold" : undefined }}>📅 Eventos</li>
              <li onClick={() => setTab("reservar_terminales")} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px", color: tab === "reservar_terminales" ? "#2563eb" : undefined, fontWeight: tab === "reservar_terminales" ? "bold" : undefined }}>📲 Reservar terminales</li>
              <li onClick={() => { fetchData(); alert("Actualizando datos..."); }} style={{ listStyle: "none", cursor: "pointer", padding: "8px 12px" }}>🔄 Refrescar</li>
            </ul>

            <div style={{ flex: "1 1 auto" }}></div>

            <div style={{ flex: "0 0 auto", marginBottom: 16 }}>
              <button className={styles.btnKolbi} style={{ width: "100%", background: "#ef4444", color: "#fff", marginBottom: 8 }} onClick={handleEliminarSolicitudes}>Eliminar TODAS las solicitudes</button>
              <button className={styles.btnKolbi} style={{ width: "100%", background: "#f59e42", color: "#fff" }} onClick={handleEliminarInventario}>Eliminar inventario (excepto bloqueados)</button>
            </div>

            <div style={{ flex: "0 0 auto", marginBottom: 8 }}>
              <button className={styles.btnKolbi} style={{ width: "100%" }} onClick={handleLogout} disabled={logoutLoading}>{logoutLoading ? "Cerrando..." : "Cerrar sesión"}</button>
            </div>
          </div>
        </aside>

        <main className={styles.mainContent} style={{ flex: 1, padding: 20 }}>
          {loading ? <div className={styles.loading}>Cargando datos...</div> : null}

          {/* RESERVAR TERMINALES PARA EVENTOS */}
          {tab === "reservar_terminales" && (
            <section className="panel" style={{ padding: 16, display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: 400 }}>
              <div style={{ width: "100%", maxWidth: 600 }}>
                <ReservarTerminalesParaEventos />
              </div>
            </section>
          )}

          {/* SOLICITUDES (placeholder: agrega UI si la tienes) */}
          {tab === "solicitudes" && (
            <section className="panel" style={{ padding: 16 }}>
              <h2>📋 Solicitudes</h2>
              
              {/* Solicitudes Pendientes */}
              <h3 style={{ marginTop: 24, marginBottom: 12 }}>Pendientes</h3>
              
              {/* Filtros de búsqueda para pendientes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                <input 
                  type="text" 
                  placeholder="Filtrar por Pedido..." 
                  value={filtroPedidoPendiente}
                  onChange={(e) => {
                    setFiltroPedidoPendiente(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
                <input 
                  type="text" 
                  placeholder="Filtrar por Cédula Cliente..." 
                  value={filtroCedulaClientePendiente}
                  onChange={(e) => {
                    setFiltroCedulaClientePendiente(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
                <input 
                  type="text" 
                  placeholder="Filtrar por IMEI o Serie..." 
                  value={filtroImeiSeriePendiente}
                  onChange={(e) => {
                    setFiltroImeiSeriePendiente(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
              </div>
              
              {/* Filtro de fechas para pendientes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", marginBottom: 4, fontWeight: "bold" }}>Fecha Inicio:</label>
                  <input 
                    type="date" 
                    value={filtroFechaInicioPendiente}
                    onChange={(e) => {
                      setFiltroFechaInicioPendiente(e.target.value);
                      setPaginaSol(1);
                    }}
                    style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", marginBottom: 4, fontWeight: "bold" }}>Fecha Fin:</label>
                  <input 
                    type="date" 
                    value={filtroFechaFinPendiente}
                    onChange={(e) => {
                      setFiltroFechaFinPendiente(e.target.value);
                      setPaginaSol(1);
                    }}
                    style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, width: "100%" }}
                  />
                </div>
              </div>

              {(() => {
                let solicitudesPendientes = solicitudes.filter(s => !["aprobada", "rechazada"].includes((s.estado || "").toLowerCase()));
                
                // Aplicar filtros
                if (filtroPedidoPendiente.trim()) {
                  solicitudesPendientes = solicitudesPendientes.filter(s => 
                    (s.pedido || "").toLowerCase().includes(filtroPedidoPendiente.toLowerCase())
                  );
                }
                
                if (filtroCedulaClientePendiente.trim()) {
                  solicitudesPendientes = solicitudesPendientes.filter(s => 
                    (s.cedulaCliente || "").toLowerCase().includes(filtroCedulaClientePendiente.toLowerCase())
                  );
                }
                
                if (filtroImeiSeriePendiente.trim()) {
                  solicitudesPendientes = solicitudesPendientes.filter(s => {
                    const imeis = Array.isArray(s.imeis) ? s.imeis : (s.imei ? [s.imei] : []);
                    const searchText = filtroImeiSeriePendiente.toLowerCase();
                    return imeis.some(imei => imei.toLowerCase().includes(searchText)) || 
                           (s.serie && s.serie.toLowerCase().includes(searchText));
                  });
                }
                
                // Filtro por fecha
                if (filtroFechaInicioPendiente || filtroFechaFinPendiente) {
                  solicitudesPendientes = solicitudesPendientes.filter(s => {
                    const fechaCreacion = s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt)) : null;
                    if (!fechaCreacion) return true;
                    
                    const fechaCreacionStr = fechaCreacion.toISOString().split('T')[0];
                    
                    if (filtroFechaInicioPendiente && fechaCreacionStr < filtroFechaInicioPendiente) {
                      return false;
                    }
                    if (filtroFechaFinPendiente && fechaCreacionStr > filtroFechaFinPendiente) {
                      return false;
                    }
                    return true;
                  });
                }
                
                if (solicitudesPendientes.length === 0) {
                  return <div>No hay solicitudes pendientes que coincidan con los filtros.</div>;
                }
                
                const totalPaginas = Math.ceil(solicitudesPendientes.length / itemsPorPaginaSol);
                const solicitudesMostradas = solicitudesPendientes.slice(
                  (paginaSol - 1) * itemsPorPaginaSol, 
                  paginaSol * itemsPorPaginaSol
                );
                
                return (
                  <div>
                    <div style={{ fontSize: "0.9em", color: "#666", marginBottom: 12 }}>
                      Mostrando {solicitudesMostradas.length} de {solicitudesPendientes.length} solicitudes
                    </div>
                    <div className={styles.list}>
                      {solicitudesMostradas.map((s, idx) => (
                        <div key={s.id || idx} className={styles.card} style={{ padding: 12 }}>
                          <div><b>{s.cliente || s.usuario || "Solicitud"}</b></div>
                          <div style={{ fontSize: "0.95em", color: "#555" }}><b>Pedido:</b> {s.pedido || s.detalle || ""}</div>
                          {s.cedulaCliente && <div style={{ fontSize: "0.95em", color: "#555" }}><b>Cédula:</b> {s.cedulaCliente}</div>}
                          <div style={{ fontSize: "0.85em", color: "#666" }}><b>IMEIs:</b> {Array.isArray(s.imeis) && s.imeis.length > 0 ? s.imeis.join(", ") : (s.imei || "-")}</div>
                          <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                            <button 
                              onClick={() => handleAprobarSolicitud(s)}
                              style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
                            >
                              Aprobar
                            </button>
                            <button 
                              onClick={() => handleRechazarSolicitud(s)} 
                              style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
                            >
                              Rechazar
                            </button>
                            <VerMasSolicitud datos={s} />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Paginación */}
                    {totalPaginas > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                        <button 
                          onClick={() => setPaginaSol((p) => Math.max(1, p - 1))} 
                          disabled={paginaSol === 1}
                          style={{ padding: "6px 12px", cursor: paginaSol === 1 ? "not-allowed" : "pointer" }}
                        >
                          Anterior
                        </button>
                        <span>Página {paginaSol} de {totalPaginas}</span>
                        <button 
                          onClick={() => setPaginaSol((p) => Math.min(totalPaginas, p + 1))} 
                          disabled={paginaSol === totalPaginas}
                          style={{ padding: "6px 12px", cursor: paginaSol === totalPaginas ? "not-allowed" : "pointer" }}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Solicitudes Aprobadas */}
              <h3 style={{ marginTop: 24, marginBottom: 12, color: '#059669' }}>✅ Aprobadas</h3>
              
              {/* Filtros de búsqueda */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                <input 
                  type="text" 
                  placeholder="Filtrar por Pedido..." 
                  value={filtroPedido}
                  onChange={(e) => {
                    setFiltroPedido(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
                <input 
                  type="text" 
                  placeholder="Filtrar por Cédula Cliente..." 
                  value={filtroCedulaCliente}
                  onChange={(e) => {
                    setFiltroCedulaCliente(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
                <input 
                  type="text" 
                  placeholder="Filtrar por IMEI o Serie..." 
                  value={filtroImeiSerie}
                  onChange={(e) => {
                    setFiltroImeiSerie(e.target.value);
                    setPaginaSol(1);
                  }}
                  style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4 }}
                />
              </div>
              
              {/* Filtro de fechas */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", marginBottom: 4, fontWeight: "bold" }}>Fecha Inicio:</label>
                  <input 
                    type="date" 
                    value={filtroFechaInicio}
                    onChange={(e) => {
                      setFiltroFechaInicio(e.target.value);
                      setPaginaSol(1);
                    }}
                    style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.9em", marginBottom: 4, fontWeight: "bold" }}>Fecha Fin:</label>
                  <input 
                    type="date" 
                    value={filtroFechaFin}
                    onChange={(e) => {
                      setFiltroFechaFin(e.target.value);
                      setPaginaSol(1);
                    }}
                    style={{ padding: 8, border: "1px solid #ddd", borderRadius: 4, width: "100%" }}
                  />
                </div>
              </div>

              {(() => {
                let solicitudesAprobadas = solicitudes.filter(s => (s.estado || "").toLowerCase() === "aprobada");
                
                // Aplicar filtros
                if (filtroPedido.trim()) {
                  solicitudesAprobadas = solicitudesAprobadas.filter(s => 
                    (s.pedido || "").toLowerCase().includes(filtroPedido.toLowerCase())
                  );
                }
                
                if (filtroCedulaCliente.trim()) {
                  solicitudesAprobadas = solicitudesAprobadas.filter(s => 
                    (s.cedulaCliente || "").toLowerCase().includes(filtroCedulaCliente.toLowerCase())
                  );
                }
                
                if (filtroImeiSerie.trim()) {
                  solicitudesAprobadas = solicitudesAprobadas.filter(s => {
                    const imeis = Array.isArray(s.imeis) ? s.imeis : (s.imei ? [s.imei] : []);
                    const searchText = filtroImeiSerie.toLowerCase();
                    return imeis.some(imei => imei.toLowerCase().includes(searchText)) || 
                           (s.serie && s.serie.toLowerCase().includes(searchText));
                  });
                }
                
                // Filtro por fecha
                if (filtroFechaInicio || filtroFechaFin) {
                  solicitudesAprobadas = solicitudesAprobadas.filter(s => {
                    const fechaCreacion = s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt)) : null;
                    if (!fechaCreacion) return true;
                    
                    const fechaCreacionStr = fechaCreacion.toISOString().split('T')[0];
                    
                    if (filtroFechaInicio && fechaCreacionStr < filtroFechaInicio) {
                      return false;
                    }
                    if (filtroFechaFin && fechaCreacionStr > filtroFechaFin) {
                      return false;
                    }
                    return true;
                  });
                }
                
                if (solicitudesAprobadas.length === 0) {
                  return <div>No hay solicitudes aprobadas que coincidan con los filtros.</div>;
                }
                
                const totalPaginas = Math.ceil(solicitudesAprobadas.length / itemsPorPaginaSol);
                const solicitudesMostradas = solicitudesAprobadas.slice(
                  (paginaSol - 1) * itemsPorPaginaSol, 
                  paginaSol * itemsPorPaginaSol
                );
                
                return (
                  <div>
                    <div style={{ fontSize: "0.9em", color: "#666", marginBottom: 12 }}>
                      Mostrando {solicitudesMostradas.length} de {solicitudesAprobadas.length} solicitudes
                    </div>
                    <div className={styles.list}>
                      {solicitudesMostradas.map((s, idx) => (
                        <div key={s.id || idx} className={styles.card} style={{ padding: 12, background: '#e6fff6', borderLeft: '4px solid #059669' }}>
                          <div><b>{s.cliente || s.usuario || "Solicitud"}</b></div>
                          <div style={{ fontSize: "0.95em", color: "#555" }}><b>Pedido:</b> {s.pedido || s.detalle || ""}</div>
                          {s.cedulaCliente && <div style={{ fontSize: "0.95em", color: "#555" }}><b>Cédula:</b> {s.cedulaCliente}</div>}
                          <div style={{ fontSize: "0.85em", color: "#666" }}><b>IMEIs:</b> {Array.isArray(s.imeis) && s.imeis.length > 0 ? s.imeis.join(", ") : (s.imei || "-")}</div>
                          <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                            <button
                              onClick={() => generarBoletaPDF(s)}
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
                            <VerMasSolicitud datos={s} />
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Paginación */}
                    {totalPaginas > 1 && (
                      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                        <button 
                          onClick={() => setPaginaSol((p) => Math.max(1, p - 1))} 
                          disabled={paginaSol === 1}
                          style={{ padding: "6px 12px", cursor: paginaSol === 1 ? "not-allowed" : "pointer" }}
                        >
                          Anterior
                        </button>
                        <span>Página {paginaSol} de {totalPaginas}</span>
                        <button 
                          onClick={() => setPaginaSol((p) => Math.min(totalPaginas, p + 1))} 
                          disabled={paginaSol === totalPaginas}
                          style={{ padding: "6px 12px", cursor: paginaSol === totalPaginas ? "not-allowed" : "pointer" }}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {/* EJECUTIVOS */}
          {tab === "ejecutivos" && (
            <section className="panel" style={{ padding: 16 }}>
              <h2>👥 Ejecutivos</h2>
              
              {/* Input de búsqueda de ejecutivos */}
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Buscar por nombre, correo o departamento..."
                  value={filtroEjecutivo}
                  onChange={(e) => {
                    setFiltroEjecutivo(e.target.value);
                    setPaginaEjecutivos(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #ddd',
                    fontSize: '1em'
                  }}
                />
              </div>

              <div>
                {ejecutivosPaginados.map((ej, idx) => (
                  <div key={ej.id || ej.correo || idx} className={styles.card} style={{ padding: 12 }}>
                    <div><b>{ej.nombre}</b> — {ej.correo}</div>
                    {ej.departamento ? <div style={{ fontSize: "0.95em", color: "#555" }}>{ej.departamento}</div> : null}
                    <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                      <button onClick={() => handleEditarEjecutivo(ej)}>Editar</button>
                      <button style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }} onClick={() => handleEliminarEjecutivo(ej.id || ej.uid)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="paginacion-ejecutivos" style={{ marginTop: 12 }}>
                <button onClick={() => setPaginaEjecutivos((p) => Math.max(1, p - 1))} disabled={paginaEjecutivos === 1}>Anterior</button>
                <span style={{ margin: "0 8px" }}>Página {paginaEjecutivos} de {totalPaginasEjecutivos}</span>
                <button onClick={() => setPaginaEjecutivos((p) => Math.min(totalPaginasEjecutivos, p + 1))} disabled={paginaEjecutivos === totalPaginasEjecutivos}>Siguiente</button>
              </div>

              {editModalVisible && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
                  <div style={{ background: "#fff", padding: 20, borderRadius: 8, minWidth: 320, maxWidth: 720 }}>
                    <h3>Editar ejecutivo</h3>
                    <form onSubmit={handleGuardarEjecutivoEditado} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input type="text" placeholder="Nombre" value={datosEditEjecutivo.nombre || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, nombre: e.target.value })} required />
                      <input type="email" placeholder="Correo" value={datosEditEjecutivo.correo || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, correo: e.target.value })} required />
                      <input type="text" placeholder="Cédula" value={datosEditEjecutivo.cedula || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, cedula: e.target.value })} />
                      <input type="text" placeholder="Usuario de Red" value={datosEditEjecutivo.usuario_red || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, usuario_red: e.target.value })} />
                      <input type="text" placeholder="Teléfono" value={datosEditEjecutivo.telefono || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, telefono: e.target.value })} />
                      <input type="text" placeholder="Departamento" value={datosEditEjecutivo.departamento || ""} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, departamento: e.target.value })} />
                      <select value={datosEditEjecutivo.estado || "activo"} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, estado: e.target.value })}>
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                      </select>
                      <select value={datosEditEjecutivo.rol || "ejecutivo"} onChange={(e) => setDatosEditEjecutivo({ ...datosEditEjecutivo, rol: e.target.value })}>
                        <option value="ejecutivo">Ejecutivo</option>
                        <option value="supervisor">Supervisor</option>
                      </select>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                        <button type="submit" className={styles.btnKolbi}>Guardar</button>
                        <button type="button" onClick={() => setEditModalVisible(false)}>Cancelar</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* AGREGAR EJECUTIVO */}
          {tab === "agregar_ejecutivo" && (
            <section className="panel" style={{ padding: 16, marginTop: 16, background: "#f6f8fa", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ color: "#22c55e" }}>➕ Agregar Ejecutivo Nuevo</h2>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!nuevoEjecutivoNombre.trim() || !nuevoEjecutivoCorreo.trim()) {
                    alert("Complete nombre y correo");
                    return;
                  }
                  try {
                    const response = await fetch("https://us-central1-kolbimonitorsells-infinix.cloudfunctions.net/createEjecutivo", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        nombre: nuevoEjecutivoNombre,
                        correo: nuevoEjecutivoCorreo,
                        departamento: nuevoEjecutivoDepartamento,
                        usuario_red: nuevoEjecutivoUsuarioRed,
                        cedula: nuevoEjecutivoCedula,
                        rol: nuevoEjecutivoRol,
                      }),
                    });
                    if (!response.ok) throw new Error("Error creando ejecutivo");
                    const sendReset = await fetch("https://us-central1-kolbimonitorsells-infinix.cloudfunctions.net/sendPasswordReset", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ correo: nuevoEjecutivoCorreo }),
                    });
                    if (!sendReset.ok) throw new Error("Error enviando correo de restablecimiento");
                    alert("Ejecutivo creado y correo de acceso enviado");
                    setNuevoEjecutivoNombre("");
                    setNuevoEjecutivoCorreo("");
                    setNuevoEjecutivoDepartamento("");
                    setNuevoEjecutivoUsuarioRed("");
                    setNuevoEjecutivoCedula("");
                    setNuevoEjecutivoRol("ejecutivo");
                    await fetchData();
                    setTab("ejecutivos");  // Navegar a la pestaña de ejecutivos
                  } catch (err) {
                    alert("Error: " + (err.message || err));
                  }
                }}
                className={styles.formGrid}
                style={{ maxWidth: 600, marginBottom: 24 }}
              >
                <input type="text" placeholder="Nombre completo" value={nuevoEjecutivoNombre} onChange={(e) => setNuevoEjecutivoNombre(e.target.value)} required />
                <input type="email" placeholder="Correo institucional" value={nuevoEjecutivoCorreo} onChange={(e) => setNuevoEjecutivoCorreo(e.target.value)} required />
                <input type="text" placeholder="Cédula" value={nuevoEjecutivoCedula} onChange={(e) => setNuevoEjecutivoCedula(e.target.value)} required />
                <input type="text" placeholder="Usuario de Red" value={nuevoEjecutivoUsuarioRed} onChange={(e) => setNuevoEjecutivoUsuarioRed(e.target.value)} required />
                <input type="text" placeholder="Departamento" value={nuevoEjecutivoDepartamento} onChange={(e) => setNuevoEjecutivoDepartamento(e.target.value)} />
                <select value={nuevoEjecutivoRol} onChange={(e) => setNuevoEjecutivoRol(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}>
                  <option value="ejecutivo">Ejecutivo</option>
                  <option value="supervisor">Supervisor</option>
                </select>
                <button type="submit" className={styles.btnKolbi} style={{ marginTop: 8, background: "#22c55e", color: "#fff" }}>Agregar Ejecutivo</button>
              </form>
              <div style={{ fontSize: "0.95em", color: "#888" }}>Al crear el ejecutivo, se enviará un correo para que pueda establecer su contraseña y acceder al sistema.</div>
            </section>
          )}

          {/* EVENTOS */}
          {tab === "eventos" && (
            <section className="panel" style={{ padding: 16 }}>
              <MarketingEventsCalendar ejecutivos={ejecutivos} isSupervisor={String(user?.rol || "").toLowerCase() === "supervisor"} />
            </section>
          )}

          {/* CONSULTA INVENTARIO */}
          {tab === "consulta" && (
            <section className="panel" style={{ padding: 16 }}>
              <h2>🔍 Consulta de Inventario</h2>
              <div className={styles.formGrid} style={{ gap: 8, marginBottom: 12 }}>
                <input type="text" placeholder="Buscar IMEI o Serie" value={imeiSearch} onChange={(e) => setImeiSearch(e.target.value)} />
                <select value={marcaSearch} onChange={(e) => setMarcaSearch(e.target.value)}>
                  <option value="">Todas las marcas</option>
                  {marcasUnicas.map((m, i) => (<option key={i} value={m}>{m}</option>))}
                </select>
                <select value={estadoSearch} onChange={(e) => setEstadoSearch(e.target.value)}>
                  <option value="">Todos los estados</option>
                  {[...new Set([...estadosUnicos, "vendido"])].map((es, i) => (
                    <option key={i} value={es === "solicitado" ? "bloqueado" : es}>
                      {es === "solicitado" ? "BLOQUEADO" : (es === "vendido" ? "VENDIDO" : es.toUpperCase())}
                    </option>
                  ))}
                </select>
                <select value={tipoSearch} onChange={(e) => setTipoSearch(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="Teléfono">Teléfono</option>
                  <option value="Accesorio">Accesorio</option>
                </select>
              </div>

              <div id="inventory-list" className={styles.list} style={{ maxHeight: 480, overflowY: "auto", border: "1px solid #eee", borderRadius: 8, background: "#fafbfc", padding: 8 }}>
                {filteredInventario.length === 0 ? (
                  <div>No se encontraron dispositivos.</div>
                ) : (
                  filteredInventario.slice((paginaInv - 1) * itemsPorPaginaInv, paginaInv * itemsPorPaginaInv).map((item, i) => {
                    let estadoActual = (item.estado || "").toLowerCase();
                    
                    // ✅ DETECTAR SI ES UN "SOLICITADO" QUE DEBERÍA SER "VENDIDO"
                    // Si está en "solicitado", verificar si tiene una solicitud aprobada
                    let esVendidoReal = estadoActual === "vendido";
                    let advertenciaEstado = null;
                    
                    if (estadoActual === "solicitado") {
                      const solicitudAprobada = solicitudes.find(sol => {
                        const imeisSol = Array.isArray(sol.imeis) ? sol.imeis : (sol.imei ? [sol.imei] : []);
                        return imeisSol.includes(item.imei) && 
                               (sol.estado || "").toLowerCase() === "aprobada";
                      });
                      
                      if (solicitudAprobada) {
                        // Este IMEI debería estar en "vendido" pero está mal en la BD
                        esVendidoReal = true;
                        advertenciaEstado = "⚠️ Estado incorrecto en BD - debería ser VENDIDO";
                      }
                    }
                    
                    // Determinar el estado visual (puede ser diferente al real si hay error)
                    const estadoVisual = esVendidoReal ? "vendido" : estadoActual;
                    
                    // ✅ Colores mejorados por estado VISUAL
                    let bgColor = "#fff";
                    let borderColor = "#ddd";
                    
                    if (estadoVisual === "vendido") {
                      bgColor = "#f3e8ff"; // Morado claro
                      borderColor = "#9333ea"; // Morado
                    } else if (estadoVisual === "disponible") {
                      bgColor = "#d1fae5"; // Verde claro
                      borderColor = "#10b981"; // Verde
                    } else if (estadoVisual === "bloqueado") {
                      bgColor = "#fee2e2"; // Rojo claro
                      borderColor = "#ef4444"; // Rojo
                    } else if (estadoVisual === "solicitado") {
                      bgColor = "#fef3c7"; // Amarillo claro
                      borderColor = "#f59e0b"; // Amarillo/Naranja
                    } else if (estadoVisual === "reservado") {
                      bgColor = "#dbeafe"; // Azul claro
                      borderColor = "#3b82f6"; // Azul
                    }
                    
                    return (
                      <div 
                        key={i} 
                        className={styles.card} 
                        data-estado={estadoVisual} 
                        style={{ 
                          marginBottom: 8, 
                          padding: 8, 
                          background: bgColor,
                          border: `2px solid ${borderColor}`,
                          borderRadius: 8
                        }}
                      >
                        <div><b>{item.imei}</b> — {item.marca} / {item.terminal}</div>
                        <div style={{ fontSize: "0.95em", color: "#555" }}>
                          Agencia: {item.agencia || "-"} | Estado: <b style={{ color: borderColor, textTransform: 'uppercase' }}>
                            {esVendidoReal ? "VENDIDO" : item.estado}
                          </b> | Tipo: <b>{detectarTipo(item)}</b>
                        </div>
                        {advertenciaEstado && (
                          <div style={{ fontSize: "0.85em", color: "#f59e0b", fontWeight: "bold", marginTop: 4, background: "#fffbeb", padding: "4px 8px", borderRadius: 4 }}>
                            {advertenciaEstado}
                          </div>
                        )}
                        {estadoActual === "bloqueado" && !esVendidoReal && (item.lockedByName || item.lockedBy) && (
                          <div style={{ fontSize: "0.95em", color: "#222" }}>Bloqueado por: <b>{item.lockedByName || item.lockedBy}</b></div>
                        )}
                        {estadoActual === "vendido" && (
                          <div style={{ fontSize: "0.95em", color: "#9333ea", fontWeight: "bold", marginTop: 4 }}>✅ VENDIDO</div>
                        )}
                        {item.solicitado_por && <div style={{ fontSize: "0.95em", color: "#888" }}>Solicitado por: <b>{item.solicitado_por}</b></div>}
                        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleBorrarImei(item.imei)}
                            title="Borrar este IMEI de la base de datos"
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              padding: "4px 8px",
                              cursor: "pointer",
                              fontSize: "0.85em"
                            }}
                          >
                            🗑️ Borrar IMEI
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {filteredInventario.length > itemsPorPaginaInv && (
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                  <button onClick={() => setPaginaInv((p) => Math.max(1, p - 1))} disabled={paginaInv === 1}>Anterior</button>
                  <span>Página {paginaInv} de {Math.ceil(filteredInventario.length / itemsPorPaginaInv)}</span>
                  <button onClick={() => setPaginaInv((p) => Math.min(Math.ceil(filteredInventario.length / itemsPorPaginaInv), p + 1))} disabled={paginaInv === Math.ceil(filteredInventario.length / itemsPorPaginaInv)}>Siguiente</button>
                </div>
              )}

              <div style={{ marginTop: 8, fontSize: "0.95em", color: "#888" }}>Total en inventario: <b>{inventario.length}</b></div>
            </section>
          )}

          {/* CARGA INVENTARIO */}
          {tab === "carga_inventario" && (
            <CargaInventarioUpload onInventarioCargado={() => {}} />
          )}

          {/* MÉTRICAS EJECUTIVOS */}
          {tab === "metricas" && (
            <section className="panel" style={{ padding: 0 }}>
              <MetricasEjecutivos ejecutivos={ejecutivos} />
            </section>
          )}

          {/* ANÁLISIS DE INVENTARIO */}
          {tab === "analisis_inventario" && (
            <CargaInventarioMetricas />
          )}

          {/* CARGAR eSIM */}
          {tab === "cargar_esim" && (
            <main className={styles.mainContent}>
              <CargarEsim />
            </main>
          )}

          {/* ANÁLISIS eSIM */}
          {tab === "analisis_esim" && (
            <main className={styles.mainContent}>
              <AnalisisEsim user={user} />
            </main>
          )}

          <footer className={styles.dashboardFooter} style={{ marginTop: 24, textAlign: "center", color: "#888", fontSize: "1em" }}>
            Derechos reservados 2025 Infinix DEV
          </footer>
        </main>
      </div>
    </div>
  );
}
