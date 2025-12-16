import React, { useState } from "react";
import Papa from "papaparse";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

export default function CargaInventarioUpload({ onInventarioCargado }) {
  const [archivo, setArchivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleArchivo = (e) => {
    setArchivo(e.target.files[0]);
    setResultado(null);
  };

  const handleSubir = async (e) => {
    e.preventDefault();
    if (!archivo) return setResultado({ error: "Selecciona un archivo CSV." });
    
    setCargando(true);
    Papa.parse(archivo, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const dbf = getFirestore();
        let agregados = 0;
        let duplicados = 0;
        let errores = [];

        // Primero, obtener todos los IMEIs existentes
        const inventarioSnap = await getDocs(collection(dbf, "inventario"));
        const imeisExistentes = new Set(
          inventarioSnap.docs.map((doc) => doc.data().imei)
        );

        for (const row of results.data) {
          const agencia = row["AGENCIA"] || row["agencia"] || "";
          const marca = row["MARCA"] || row["marca"] || "";
          const terminal = row["TERMINAL"] || row["terminal"] || "";
          const imei = row["IMEI"] || row["imei"] || "";
          const estado = row["ESTADO"] || row["estado"] || "";

          if (!agencia || !marca || !terminal || !imei || !estado) {
            errores.push(`Fila incompleta: ${JSON.stringify(row)}`);
            continue;
          }

          // Si el IMEI ya existe, saltar (no duplicar)
          if (imeisExistentes.has(imei)) {
            duplicados++;
            continue;
          }

          try {
            await addDoc(collection(dbf, "inventario"), {
              agencia,
              marca,
              terminal,
              imei,
              estado,
              fecha_registro: new Date().toISOString(),
            });
            agregados++;
            imeisExistentes.add(imei); // Agregar a conjunto para evitar duplicados en lote
          } catch (err) {
            errores.push(`Error IMEI ${imei}: ${err.message}`);
          }
        }

        setResultado({ agregados, duplicados, errores });
        setCargando(false);
        if (typeof onInventarioCargado === "function") onInventarioCargado();
      },
      error: (err) => {
        setResultado({ error: err.message });
        setCargando(false);
      },
    });
  };

  return (
    <div style={{ padding: "20px", background: "#f9fafb", minHeight: "100vh" }}>
      {/* Encabezado */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ margin: "0 0 8px 0", color: "#1f2937" }}>
          📦 Carga de Inventario
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
          Sube un archivo CSV para agregar terminales al inventario
        </p>
      </div>

      {/* Formulario de carga */}
      <div
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          maxWidth: "600px",
        }}
      >
        <form onSubmit={handleSubir}>
          {/* Input de archivo */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: "8px",
                color: "#374151",
              }}
            >
              Selecciona archivo CSV:
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleArchivo}
              disabled={cargando}
              style={{
                display: "block",
                width: "100%",
                padding: "10px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            />
          </div>

          {/* Instrucciones */}
          <div
            style={{
              background: "#f3f4f6",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#555",
            }}
          >
            <strong>Formato esperado:</strong>
            <p style={{ margin: "4px 0 0 0" }}>
              Las columnas deben ser: AGENCIA, MARCA, TERMINAL, IMEI, ESTADO
            </p>
          </div>

          {/* Botón submit */}
          <button
            type="submit"
            disabled={cargando || !archivo}
            style={{
              width: "100%",
              padding: "12px",
              background: cargando ? "#ccc" : "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: cargando ? "not-allowed" : "pointer",
              fontWeight: "600",
              fontSize: "14px",
              transition: "all 0.3s",
            }}
          >
            {cargando ? "Cargando..." : "📤 Subir CSV"}
          </button>
        </form>

        {/* Resultados */}
        {resultado && (
          <div style={{ marginTop: "20px" }}>
            {resultado.error && (
              <div
                style={{
                  background: "#fee2e2",
                  color: "#991b1b",
                  padding: "12px",
                  borderRadius: "6px",
                  marginBottom: "12px",
                }}
              >
                ❌ Error: {resultado.error}
              </div>
            )}

            {resultado.agregados !== undefined && (
              <div
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  padding: "12px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  <strong>✅ Carga completada:</strong>
                </div>
                <div style={{ fontSize: "13px", lineHeight: "1.6" }}>
                  <div>
                    <strong>{resultado.agregados}</strong> dispositivos agregados
                  </div>
                  <div>
                    <strong>{resultado.duplicados}</strong> IMEIs duplicados (no
                    se agregaron)
                  </div>
                  {resultado.errores && resultado.errores.length > 0 && (
                    <details style={{ marginTop: "8px" }}>
                      <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                        Ver {resultado.errores.length} errores
                      </summary>
                      <ul
                        style={{
                          marginTop: "8px",
                          paddingLeft: "20px",
                          fontSize: "12px",
                        }}
                      >
                        {resultado.errores.map((err, i) => (
                          <li key={i} style={{ marginBottom: "4px" }}>
                            {err}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
