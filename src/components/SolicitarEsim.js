import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  getFirestore,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export default function SolicitarEsim() {
  const db = getFirestore();
  const auth = getAuth();
  const [usuario, setUsuario] = useState(null);
  const [disponibles, setDisponibles] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [formulario, setFormulario] = useState({
    cedula: "",
    cliente: "",
    pedido: "",
  });
  const [solicitando, setSolicitando] = useState(false);
  const [resultadoSolicitud, setResultadoSolicitud] = useState(null);
  const [error, setError] = useState(null);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [filtroFechaSolicitudes, setFiltroFechaSolicitudes] = useState("");

  // Obtener usuario autenticado y cargar datos
  useEffect(() => {
    setCargando(true);

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUsuario(user);

        // Escuchar disponibles en tiempo real
        const unsubscribeDisponibles = onSnapshot(
          query(collection(db, "esims"), where("estado", "==", "disponible")),
          (snapshot) => {
            setDisponibles(snapshot.docs.length);
          }
        );

        // Escuchar mis solicitudes
        const unsubscribeSolicitudes = onSnapshot(
          query(collection(db, "solicitudes_esim"), where("ejecutivoUid", "==", user.uid)),
          (snapshot) => {
            setMisSolicitudes(
              snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.solicitadoEn - a.solicitadoEn)
            );
          }
        );

        setCargando(false);

        return () => {
          unsubscribeDisponibles();
          unsubscribeSolicitudes();
        };
      }
    });

    return () => unsubscribeAuth();
  }, [db, auth]);

  // Validar que sea máximo 1 eSIM por pedido
  const puedeSolicitar = () => {
    if (!formulario.pedido) return true; // Si no hay pedido, permite avanzar
    
    const yaAsignado = misSolicitudes.some(
      (sol) => sol.pedido === formulario.pedido && sol.estado === "completada"
    );
    return !yaAsignado; // Retorna true si NO hay eSIM asignada a este pedido
  };

  // Solicitar eSIM
  const handleSolicitar = async () => {
    if (!formulario.cedula || !formulario.cliente || !formulario.pedido) {
      setError("Por favor completa todos los campos");
      return;
    }

    if (!puedeSolicitar()) {
      setError("Ya solicitaste una eSIM hoy. Máximo 1 por turno");
      return;
    }

    setSolicitando(true);
    setError(null);
    setResultadoSolicitud(null);

    try {
      // Obtener una serie disponible
      const q = query(collection(db, "esims"), where("estado", "==", "disponible"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setError("No hay eSIMs disponibles en este momento");
        setSolicitando(false);
        return;
      }

      // Tomar la primera disponible
      const docEsim = snapshot.docs[0];
      const esimData = docEsim.data();

      // Actualizar eSIM a estado "usada"
      await updateDoc(doc(db, "esims", docEsim.id), {
        estado: "usada",
        cedula: formulario.cedula,
        cliente: formulario.cliente,
        pedido: formulario.pedido,
        asignadoA: usuario?.displayName || usuario?.email || "Desconocido",
        usadaEn: new Date(),
      });

      // Crear solicitud en auditoría
      const solicitudRef = await addDoc(collection(db, "solicitudes_esim"), {
        ejecutivoUid: usuario.uid,
        ejecutivoNombre: usuario.displayName || usuario.email,
        ejecutivoCorreo: usuario.email,
        serieAsignada: esimData.serie,
        solicitadoEn: new Date(),
        estado: "completada",
        cedula: formulario.cedula,
        pedido: formulario.pedido,
        cliente: formulario.cliente,
        completadoEn: new Date(),
      });

      // última serie guardada en resultadoSolicitud
      setResultadoSolicitud({
        serie: esimData.serie,
        solicitudId: solicitudRef.id,
      });

      // Limpiar formulario
      setFormulario({
        cedula: "",
        cliente: "",
        pedido: "",
      });
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSolicitando(false);
    }
  };

  if (cargando)
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        ⏳ Cargando...
      </div>
    );

  if (!usuario)
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
        ⚠️ Por favor inicia sesión primero
      </div>
    );

  return (
    <div style={{ padding: 20 }}>
      <h2>📲 Solicitar eSIM</h2>

      {/* Estado de disponibilidad */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
            eSIMs Disponibles en Almacén:
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "32px", fontWeight: "bold", color: "#10b981" }}>
            {disponibles}
          </p>
        </div>
        <div style={{ fontSize: "48px" }}>📦</div>
      </div>

      {/* Verificar si puede solicitar */}
      {formulario.pedido && !puedeSolicitar() && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
            color: "#92400e",
            fontSize: "14px",
          }}
        >
          ⚠️ Ya existe una eSIM asignada al pedido <strong>{formulario.pedido}</strong>. Solo puedes asignar 1 eSIM por pedido.
        </div>
      )}

      {/* Formulario */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0e7ff",
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Datos del Cliente</h3>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>
            Cédula del Cliente:
          </label>
          <input
            type="text"
            placeholder="1-1234-5678"
            value={formulario.cedula}
            onChange={(e) =>
              setFormulario({ ...formulario, cedula: e.target.value })
            }
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 4,
              border: "1px solid #ddd",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>
            Nombre del Cliente:
          </label>
          <input
            type="text"
            placeholder="Juan Pérez"
            value={formulario.cliente}
            onChange={(e) =>
              setFormulario({ ...formulario, cliente: e.target.value })
            }
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 4,
              border: "1px solid #ddd",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>
            Número de Pedido:
          </label>
          <input
            type="text"
            placeholder="KO-123456"
            value={formulario.pedido}
            onChange={(e) =>
              setFormulario({ ...formulario, pedido: e.target.value })
            }
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 4,
              border: "1px solid #ddd",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleSolicitar}
          disabled={
            solicitando ||
            !formulario.cedula ||
            !formulario.cliente ||
            !formulario.pedido ||
            !puedeSolicitar() ||
            disponibles === 0
          }
          style={{
            width: "100%",
            padding: "12px",
            background:
              solicitando ||
              !formulario.cedula ||
              !formulario.cliente ||
              !formulario.pedido ||
              !puedeSolicitar() ||
              disponibles === 0
                ? "#ccc"
                : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor:
              solicitando ||
              !formulario.cedula ||
              !formulario.cliente ||
              !formulario.pedido ||
              !puedeSolicitar() ||
              disponibles === 0
                ? "not-allowed"
                : "pointer",
            fontWeight: "bold",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
          title={
            !puedeSolicitar()
              ? "Este pedido ya tiene una eSIM asignada"
              : !formulario.pedido
              ? "Ingresa el número de pedido"
              : disponibles === 0
              ? "No hay eSIMs disponibles"
              : "Solicitar eSIM"
          }
        >
          {solicitando && (
            <span
              style={{
                display: "inline-block",
                animation: "spin 1s linear infinite",
                fontSize: "18px",
              }}
            >
              ⚙️
            </span>
          )}
          {solicitando ? "Solicitando..." : "✉️ Solicitar eSIM"}
        </button>
      </div>

      {/* Errores */}
      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 4,
            color: "#991b1b",
            marginBottom: 20,
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Resultado */}
      {resultadoSolicitud && (
        <div
          style={{
            padding: 16,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <h3 style={{ marginTop: 0, color: "#15803d" }}>✅ eSIM Asignada</h3>
          <p style={{ margin: "12px 0", fontSize: "14px" }}>
            <strong>Serie eSIM:</strong>
          </p>
          <p
            style={{
              margin: 0,
              padding: 12,
              background: "#fff",
              border: "1px solid #bbf7d0",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: "16px",
              fontWeight: "bold",
              color: "#10b981",
              textAlign: "center",
            }}
          >
            {resultadoSolicitud.serie}
          </p>
          <p
            style={{
              marginTop: 12,
              fontSize: "12px",
              color: "#666",
              textAlign: "center",
            }}
          >
            Copia esta serie para usar con el cliente
          </p>
        </div>
      )}

      {/* Mis solicitudes recientes */}
      {misSolicitudes.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e0e7ff",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h3 style={{ marginTop: 0 }}>📋 Mis Solicitudes Recientes</h3>
          
          {/* Filtro por fecha */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontWeight: 500, fontSize: "13px" }}>Filtrar por fecha:</label>
              <input
                type="date"
                value={filtroFechaSolicitudes}
                onChange={(e) => setFiltroFechaSolicitudes(e.target.value)}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  fontSize: "13px",
                }}
              />
            </div>
            {filtroFechaSolicitudes && (
              <button
                onClick={() => setFiltroFechaSolicitudes("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#6366f1",
                  cursor: "pointer",
                  fontSize: "12px",
                  textDecoration: "underline",
                }}
              >
                🔄 Limpiar filtro
              </button>
            )}
          </div>

          {/* Conteo de registros */}
          <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
            Mostrando{" "}
            {misSolicitudes
              .filter((sol) => {
                if (!filtroFechaSolicitudes) return true;
                const solFecha = sol.solicitadoEn?.toDate?.()?.toLocaleDateString("es-CR");
                const filterFecha = new Date(filtroFechaSolicitudes + "T00:00:00")
                  .toLocaleDateString("es-CR");
                return solFecha === filterFecha;
              })
              .slice(0, 5).length}{" "}
            de{" "}
            {misSolicitudes.filter((sol) => {
              if (!filtroFechaSolicitudes) return true;
              const solFecha = sol.solicitadoEn?.toDate?.()?.toLocaleDateString("es-CR");
              const filterFecha = new Date(filtroFechaSolicitudes + "T00:00:00")
                .toLocaleDateString("es-CR");
              return solFecha === filterFecha;
            }).length}{" "}
            solicitudes
            {filtroFechaSolicitudes && ` (filtradas por ${new Date(filtroFechaSolicitudes + "T00:00:00").toLocaleDateString("es-CR")})`}
          </div>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>Serie</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Cliente</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Cédula</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Pedido</th>
                  <th style={{ padding: 10, textAlign: "left" }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {misSolicitudes
                  .filter((sol) => {
                    if (!filtroFechaSolicitudes) return true;
                    const solFecha = sol.solicitadoEn?.toDate?.()?.toLocaleDateString("es-CR");
                    const filterFecha = new Date(filtroFechaSolicitudes + "T00:00:00")
                      .toLocaleDateString("es-CR");
                    return solFecha === filterFecha;
                  })
                  .slice(0, 5)
                  .map((sol, idx) => (
                    <tr
                      key={sol.id}
                      style={{
                        borderBottom: "1px solid #e0e7ff",
                        background: idx % 2 === 0 ? "#f9fafb" : "#fff",
                      }}
                    >
                      <td style={{ padding: 10, fontFamily: "monospace" }}>
                        {sol.serieAsignada}
                      </td>
                      <td style={{ padding: 10 }}>{sol.cliente}</td>
                      <td style={{ padding: 10 }}>{sol.cedula}</td>
                      <td style={{ padding: 10 }}>{sol.pedido}</td>
                      <td style={{ padding: 10 }}>
                        {sol.solicitadoEn?.toDate?.()?.toLocaleDateString("es-CR")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Animación CSS */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
