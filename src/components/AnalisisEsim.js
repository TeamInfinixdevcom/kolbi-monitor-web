import React, { useState, useEffect } from "react";
import { collection, getFirestore, onSnapshot } from "firebase/firestore";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);


export default function AnalisisEsim({ user }) {
  const db = getFirestore();
  const [esims, setEsims] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroEjecutivo, setFiltroEjecutivo] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const REGISTROS_POR_PAGINA = 10;

  // Cargar datos en tiempo real solo si el usuario está autenticado
  useEffect(() => {
    if (!user) {
      setCargando(false);
      return;
    }
    setCargando(true);

    // Escuchar cambios en esims
    const unsubscribeEsims = onSnapshot(collection(db, "esims"), (snapshot) => {
      setEsims(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    // Escuchar cambios en solicitudes
    const unsubscribeSolicitudes = onSnapshot(
      collection(db, "solicitudes_esim"),
      (snapshot) => {
        setSolicitudes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );

    setCargando(false);

    return () => {
      unsubscribeEsims();
      unsubscribeSolicitudes();
    };
  }, [db, user]);

  // Resetear página cuando cambien los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroEstado, filtroFecha, filtroEjecutivo, filtroCliente]);

  // Calcular métricas
  const calcularMetricas = () => {
    const disponibles = esims.filter((e) => e.estado === "disponible").length;
    const usadas = esims.filter((e) => e.estado === "usada").length;
    const total = esims.length;
    const tasaUso = total > 0 ? Math.round((usadas / total) * 100) : 0;

    return { disponibles, usadas, total, tasaUso };
  };

  // Calcular solicitudes por ejecutivo
  const solicitudesPorEjecutivo = () => {
    const mapa = {};
    solicitudes.forEach((sol) => {
      const nombre = sol.ejecutivoNombre || "Desconocido";
      mapa[nombre] = (mapa[nombre] || 0) + 1;
    });
    return Object.entries(mapa).map(([nombre, count]) => ({ nombre, count }));
  };

  // Filtrar esims según múltiples criterios (estado, fecha, ejecutivo, cliente)
  const esimsFiltradas = () => {
    let filtradas = esims;

    // Filtro por estado
    if (filtroEstado !== "todos") {
      filtradas = filtradas.filter((e) => e.estado === filtroEstado);
    }

    // Filtro por fecha
    if (filtroFecha) {
      filtradas = filtradas.filter((e) => {
        const fechaDoc = e.creadoEn?.toDate?.()?.toLocaleDateString("es-CR");
        return fechaDoc === filtroFecha;
      });
    }

    // Filtro por ejecutivo
    if (filtroEjecutivo) {
      filtradas = filtradas.filter((e) =>
        e.asignadoA?.toLowerCase?.()?.includes(filtroEjecutivo.toLowerCase())
      );
    }

    // Filtro por cliente
    if (filtroCliente) {
      filtradas = filtradas.filter((e) =>
        e.cliente?.toLowerCase?.()?.includes(filtroCliente.toLowerCase())
      );
    }

    return filtradas;
  };

  const metricas = calcularMetricas();
  const solicPorEj = solicitudesPorEjecutivo();
  const esimsMostradas = esimsFiltradas();

  if (cargando)
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        ⏳ Cargando análisis...
      </div>
    );

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 Análisis eSIM</h2>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#f0fdf4",
            padding: 16,
            borderRadius: 8,
            textAlign: "center",
            border: "1px solid #bbf7d0",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
            Disponibles
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#10b981" }}>
            {metricas.disponibles}
          </p>
        </div>

        <div
          style={{
            background: "#fee2e2",
            padding: 16,
            borderRadius: 8,
            textAlign: "center",
            border: "1px solid #fecaca",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
            Usadas
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#ef4444" }}>
            {metricas.usadas}
          </p>
        </div>

        <div
          style={{
            background: "#f0f9ff",
            padding: 16,
            borderRadius: 8,
            textAlign: "center",
            border: "1px solid #bfdbfe",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
            Total
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#3b82f6" }}>
            {metricas.total}
          </p>
        </div>

        <div
          style={{
            background: "#fef3c7",
            padding: 16,
            borderRadius: 8,
            textAlign: "center",
            border: "1px solid #fde68a",
          }}
        >
          <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
            Tasa de Uso
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#f59e0b" }}>
            {metricas.tasaUso}%
          </p>
        </div>
      </div>

      {/* Gráficas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Doughnut - Estado */}
        <div
          style={{
            background: "#fff",
            border: "1px solid #e0e7ff",
            borderRadius: 8,
            padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Distribución de Estados</h3>
          <Doughnut
            data={{
              labels: ["Disponibles", "Usadas"],
              datasets: [
                {
                  data: [metricas.disponibles, metricas.usadas],
                  backgroundColor: ["#10b981", "#ef4444"],
                  borderColor: ["#059669", "#dc2626"],
                  borderWidth: 2,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: true,
            }}
          />
        </div>

        {/* Bar - Solicitudes por ejecutivo */}
        {solicPorEj.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e7ff",
              borderRadius: 8,
              padding: 16,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Solicitudes por Ejecutivo</h3>
            <Bar
              data={{
                labels: solicPorEj.map((s) => s.nombre),
                datasets: [
                  {
                    label: "Solicitudes",
                    data: solicPorEj.map((s) => s.count),
                    backgroundColor: "#3b82f6",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        )}
      </div>

      {/* Tabla de eSIMs */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0e7ff",
          borderRadius: 8,
          padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>📋 Histórico eSIM (Auditoría)</h3>

        {/* Filtros */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 16,
            padding: 12,
            background: "#f9fafb",
            borderRadius: 6,
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: 4 }}>
              Estado:
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: "12px",
              }}
            >
              <option value="todos">Todos</option>
              <option value="disponible">Disponibles</option>
              <option value="usada">Usadas</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: 4 }}>
              Fecha:
            </label>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: "12px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: 4 }}>
              Ejecutivo:
            </label>
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={filtroEjecutivo}
              onChange={(e) => setFiltroEjecutivo(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: "12px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: 4 }}>
              Cliente:
            </label>
            <input
              type="text"
              placeholder="Buscar por cliente..."
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                fontSize: "12px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: 4 }}>
              &nbsp;
            </label>
            <button
              onClick={() => {
                setFiltroEstado("todos");
                setFiltroFecha("");
                setFiltroEjecutivo("");
                setFiltroCliente("");
                setPaginaActual(1);
              }}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #ddd",
                background: "#f3f4f6",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              🔄 Limpiar Filtros
            </button>
          </div>
        </div>

        <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#666" }}>
          📊 Mostrando: <strong>{Math.min(REGISTROS_POR_PAGINA, esimsMostradas.length)}</strong> de <strong>{esimsMostradas.length}</strong> registros | Página <strong>{paginaActual}</strong> de <strong>{Math.max(1, Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA))}</strong>
        </p>        <div
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
                <th style={{ padding: 12, textAlign: "left" }}>Serie</th>
                <th style={{ padding: 12, textAlign: "left" }}>Estado</th>
                <th style={{ padding: 12, textAlign: "left" }}>Cliente</th>
                <th style={{ padding: 12, textAlign: "left" }}>Cédula</th>
                <th style={{ padding: 12, textAlign: "left" }}>Pedido</th>
                <th style={{ padding: 12, textAlign: "left" }}>Solicitado por</th>
                <th style={{ padding: 12, textAlign: "left" }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {esimsMostradas
                .slice(
                  (paginaActual - 1) * REGISTROS_POR_PAGINA,
                  paginaActual * REGISTROS_POR_PAGINA
                )
                .map((esim, idx) => (
                <tr
                  key={esim.id}
                  style={{
                    borderBottom: "1px solid #e0e7ff",
                    background: idx % 2 === 0 ? "#f9fafb" : "#fff",
                  }}
                >
                  <td style={{ padding: 12, fontFamily: "monospace" }}>{esim.serie}</td>
                  <td style={{ padding: 12 }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: esim.estado === "disponible" ? "#d1fae5" : "#fee2e2",
                        color: esim.estado === "disponible" ? "#065f46" : "#991b1b",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      {esim.estado}
                    </span>
                  </td>
                  <td style={{ padding: 12 }}>{esim.cliente || "-"}</td>
                  <td style={{ padding: 12 }}>{esim.cedula || "-"}</td>
                  <td style={{ padding: 12 }}>{esim.pedido || "-"}</td>
                  <td style={{ padding: 12 }}>{esim.asignadoA || "-"}</td>
                  <td style={{ padding: 12 }}>
                    {esim.creadoEn?.toDate?.()?.toLocaleDateString("es-CR") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {esimsMostradas.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
              No hay eSIMs para mostrar
            </div>
          )}
        </div>

        {/* Controles de paginación */}
        {esimsMostradas.length > REGISTROS_POR_PAGINA && (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 8,
              justifyContent: "center",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setPaginaActual(Math.max(1, paginaActual - 1))}
              disabled={paginaActual === 1}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #ddd",
                background: paginaActual === 1 ? "#f3f4f6" : "#fff",
                cursor: paginaActual === 1 ? "not-allowed" : "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                color: paginaActual === 1 ? "#ccc" : "#333",
              }}
            >
              ◀ Anterior
            </button>

            {Array.from(
              { length: Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA) },
              (_, i) => i + 1
            ).map((pagina) => (
              <button
                key={pagina}
                onClick={() => setPaginaActual(pagina)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 4,
                  border: pagina === paginaActual ? "2px solid #3b82f6" : "1px solid #ddd",
                  background: pagina === paginaActual ? "#3b82f6" : "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: pagina === paginaActual ? "#fff" : "#333",
                }}
              >
                {pagina}
              </button>
            ))}

            <button
              onClick={() =>
                setPaginaActual(
                  Math.min(
                    Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA),
                    paginaActual + 1
                  )
                )
              }
              disabled={
                paginaActual === Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA)
              }
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #ddd",
                background:
                  paginaActual === Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA)
                    ? "#f3f4f6"
                    : "#fff",
                cursor:
                  paginaActual === Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA)
                    ? "not-allowed"
                    : "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                color:
                  paginaActual === Math.ceil(esimsMostradas.length / REGISTROS_POR_PAGINA)
                    ? "#ccc"
                    : "#333",
              }}
            >
              Siguiente ▶
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: "12px", color: "#666", textAlign: "center" }}>
        Total de eSIMs cargadas: <strong>{metricas.total}</strong>
      </div>
    </div>
  );
}
