import React, { useState } from "react";
import { collection, addDoc, getFirestore, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function CargarEsim() {
  const db = getFirestore();
  const [seriesText, setSeriesText] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [ultimasCargas, setUltimasCargas] = useState([]);
  const [eliminando, setEliminando] = useState(false);

  // Validar y extraer series del texto
  const extraerSeries = (texto) => {
    // 1️⃣ Extraer solo números de EXACTAMENTE 20 dígitos (formato eSIM estándar)
    const regex = /\b\d{20}\b/g;
    const series = texto.match(regex) || [];
    
    // 2️⃣ Remover duplicados
    const seriesUnicas = [...new Set(series)];
    
    return seriesUnicas;
  };

  // Contar caracteres descartados (para info al usuario)
  const contarCaracteresDescartados = (texto) => {
    const regex = /\b\d{20}\b/g;
    const seriesEncontradas = texto.match(regex) || [];
    const caracteresValidos = seriesEncontradas.join("").length;
    const caracteresTotales = texto.replace(/\s/g, "").length;
    
    return {
      validos: caracteresValidos,
      descartados: caracteresTotales - caracteresValidos,
      totalCaracteres: caracteresTotales,
    };
  };

  // Validar si una serie ya existe
  const serieExiste = async (serie) => {
    const q = query(collection(db, "esims"), where("serie", "==", serie));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  // Obtener y mostrar últimas cargas por fecha
  const cargarUltimasCargas = async () => {
    try {
      const snapshot = await getDocs(collection(db, "esims"));
      const cargas = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Agrupar por fecha de creación
      const cargasAgrupadas = {};
      cargas.forEach((carga) => {
        const fecha = carga.creadoEn?.toDate?.()?.toLocaleDateString("es-CR") || "Desconocida";
        if (!cargasAgrupadas[fecha]) {
          cargasAgrupadas[fecha] = [];
        }
        cargasAgrupadas[fecha].push(carga);
      });
      
      setUltimasCargas(
        Object.entries(cargasAgrupadas)
          .map(([fecha, items]) => ({ fecha, items, cantidad: items.length }))
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      );
    } catch (err) {
      console.error("Error cargando historial:", err);
    }
  };

  // Eliminar una carga completa por fecha
  const eliminarCargaPorFecha = async (fecha) => {
    if (!window.confirm(`⚠️ ¿Eliminar todas las eSIMs cargadas el ${fecha}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminando(true);
    try {
      const snapshot = await getDocs(collection(db, "esims"));
      const aEliminar = snapshot.docs.filter((doc) => {
        const docFecha = doc.data().creadoEn?.toDate?.()?.toLocaleDateString("es-CR");
        return docFecha === fecha;
      });

      let eliminadas = 0;
      for (const docSnap of aEliminar) {
        await deleteDoc(doc(db, "esims", docSnap.id));
        eliminadas++;
      }

      alert(`✅ Se eliminaron ${eliminadas} eSIMs de la fecha ${fecha}`);
      setUltimasCargas([]);
      cargarUltimasCargas();
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setEliminando(false);
    }
  };

  // Cargar series
  const handleCargar = async () => {
    if (!seriesText.trim()) {
      setError("Por favor pega las series eSIM");
      return;
    }

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const series = extraerSeries(seriesText);
      const descartados = contarCaracteresDescartados(seriesText);

      if (series.length === 0) {
        setError(
          `❌ No se encontraron series válidas.\n` +
          `Formato esperado: exactamente 20 dígitos consecutivos\n` +
          `Ejemplo válido: 89506010325111624994\n` +
          `Caracteres detectados: ${descartados.totalCaracteres} (omitidos: ${descartados.descartados})`
        );
        setCargando(false);
        return;
      }

      if (series.length > 500) {
        setError(`❌ Máximo 500 series por carga. Detectadas: ${series.length}`);
        setCargando(false);
        return;
      }

      let cargadas = 0;
      let duplicadas = 0;
      const errores = [];

      for (const serie of series) {
        try {
          const existe = await serieExiste(serie);
          if (existe) {
            duplicadas++;
          } else {
            await addDoc(collection(db, "esims"), {
              serie,
              estado: "disponible",
              creadoEn: new Date(),
              asignadoA: null,
              cedula: null,
              pedido: null,
              cliente: null,
              usadaEn: null,
              notas: "",
            });
            cargadas++;
          }
        } catch (err) {
          errores.push({ serie, error: err.message });
        }
      }

      setResultado({
        cargadas,
        duplicadas,
        total: series.length,
        errores,
        caracteresDescartados: descartados.descartados,
        caracteresTotales: descartados.totalCaracteres,
      });

      setSeriesText("");
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>📲 Cargar eSIM</h2>

      {/* Instrucciones */}
      <div
        style={{
          background: "#f0f9ff",
          border: "1px solid #bfdbfe",
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <h4 style={{ marginTop: 0, color: "#0369a1" }}>📋 Instrucciones:</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: "14px" }}>
          <li>Copia todo el contenido del documento (con letras y símbolos incluidos)</li>
          <li>Pégalo en el campo de texto abajo</li>
          <li>Sistema omitirá automáticamente: letras, símbolos, espacios y caracteres inválidos</li>
          <li>Extrae solo números consecutivos de 19-20 dígitos (series válidas)</li>
          <li>Máximo 500 series por carga</li>
          <li>Duplicados serán ignorados automáticamente</li>
          <li>Verás un reporte detallado de lo cargado y lo omitido</li>
        </ul>
      </div>

      {/* Área de entrada */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: "bold", marginBottom: 8 }}>
          Pega las series eSIM:
        </label>
        <textarea
          value={seriesText}
          onChange={(e) => setSeriesText(e.target.value)}
          placeholder="Pega aquí el documento completo con todas las eSIMs
Sistema extraerá automáticamente solo los números de 20 dígitos:
89506010325111624705
89506010325111624713
89506010325111624721
..."
          style={{
            width: "100%",
            height: 200,
            padding: 12,
            borderRadius: 4,
            border: "1px solid #ddd",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        />
      </div>

      {/* Botón cargar */}
      <button
        onClick={handleCargar}
        disabled={cargando || !seriesText.trim()}
        style={{
          padding: "12px 24px",
          background: cargando || !seriesText.trim() ? "#ccc" : "#10b981",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: cargando || !seriesText.trim() ? "not-allowed" : "pointer",
          fontWeight: "bold",
          fontSize: "16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {cargando && (
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
        {cargando ? "Cargando..." : "📤 Cargar Series"}
      </button>

      {/* Animación CSS */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        .loading-skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Errores */}
      {error && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "#fee2e2",
            border: "1px solid #fecaca",
            borderRadius: 4,
            color: "#991b1b",
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
          }}
        >
          <h3 style={{ marginTop: 0, color: "#15803d" }}>✅ Reporte de Carga</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Cargadas
              </p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
                {resultado.cargadas}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Duplicadas
              </p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#f59e0b" }}>
                {resultado.duplicadas}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Total Procesadas
              </p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}>
                {resultado.total}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Caracteres Omitidos
              </p>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#8b5cf6" }}>
                {resultado.caracteresDescartados || 0}
              </p>
            </div>
          </div>

          {/* Info de limpieza */}
          {resultado.caracteresDescartados > 0 && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#fef3c7",
                borderRadius: 4,
                border: "1px solid #fde68a",
                fontSize: "12px",
                color: "#92400e",
              }}
            >
              ℹ️ <strong>Limpieza automática:</strong> Se omitieron {resultado.caracteresDescartados} caracteres (letras, símbolos, espacios) de un total de {resultado.caracteresTotales}.
              <br />
              Se extrajeron {resultado.total} series de {resultado.caracteresTotales - resultado.caracteresDescartados} dígitos válidos.
            </div>
          )}

          {resultado.errores.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontWeight: "bold", color: "#991b1b" }}>
                ⚠️ Errores ({resultado.errores.length}):
              </p>
              {resultado.errores.slice(0, 5).map((err, idx) => (
                <p key={idx} style={{ margin: "4px 0", fontSize: "12px" }}>
                  {err.serie}: {err.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historial de cargas */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={cargarUltimasCargas}
          style={{
            padding: "8px 16px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
            marginBottom: 12,
          }}
        >
          📅 Ver Historial de Cargas
        </button>

        {ultimasCargas.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e7ff",
              borderRadius: 8,
              padding: 16,
              marginTop: 12,
            }}
          >
            <h3 style={{ marginTop: 0 }}>📋 Historial de Cargas (Auditoría)</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {ultimasCargas.map((carga, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: "bold", color: "#111" }}>
                      📅 {carga.fecha}
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>
                      Total de eSIMs: <strong>{carga.cantidad}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => eliminarCargaPorFecha(carga.fecha)}
                    disabled={eliminando}
                    style={{
                      padding: "6px 12px",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: eliminando ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      fontSize: "12px",
                      opacity: eliminando ? 0.6 : 1,
                    }}
                    title="Eliminar todas las eSIMs de esta fecha"
                  >
                    {eliminando ? "🗑️ Eliminando..." : "🗑️ Eliminar"}
                  </button>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 12, fontSize: "12px", color: "#999", fontStyle: "italic" }}>
              ⚠️ Advertencia: Al eliminar una carga, se removerán TODAS las eSIMs cargadas en esa fecha del sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
