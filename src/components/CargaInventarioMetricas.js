    import React, { useState, useEffect, useRef } from "react";
    import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Legend,
    Tooltip,
    } from "chart.js";
    import { Bar, Line, Doughnut } from "react-chartjs-2";
    import { getFirestore, collection, onSnapshot } from "firebase/firestore";

    ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Legend,
    Tooltip
    );

    export default function CargaInventarioMetricas() {
    const db = getFirestore();

    // Estado
    const [inventario, setInventario] = useState([]);
    const [zoomedChart, setZoomedChart] = useState(null);
    const [cargando, setCargando] = useState(true);

    // Refs para captura de gráficos
    const chartBarRef = useRef();
    const chartLineRef = useRef();

    // Cargar inventario
    useEffect(() => {
        setCargando(true);
        const unsub = onSnapshot(collection(db, "inventario"), (snapshot) => {
        setInventario(
            snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            }))
        );
        setCargando(false);
        });
        return () => unsub();
    }, [db]);

    // CÁLCULOS DE MÉTRICAS
    const calcularMetricas = () => {
        const totalItems = inventario.length;

        // Contar por marca
        const porMarca = {};
        inventario.forEach((item) => {
        const marca = item.marca || "Sin marca";
        porMarca[marca] = (porMarca[marca] || 0) + 1;
        });

        // Contar por estado
        const porEstado = {};
        inventario.forEach((item) => {
        const estado = item.estado || "Sin estado";
        porEstado[estado] = (porEstado[estado] || 0) + 1;
        });

        // Contar por agencia
        const porAgencia = {};
        inventario.forEach((item) => {
        const agencia = item.agencia || "Sin agencia";
        porAgencia[agencia] = (porAgencia[agencia] || 0) + 1;
        });

        // Terminales disponibles vs reservadas
        const disponibles = inventario.filter(
        (i) => i.estado === "disponible"
        ).length;
        const reservadas = inventario.filter((i) => i.estado === "reservado").length;
        const bloqueadas = inventario.filter((i) => i.estado === "bloqueado").length;
        const vendidas = inventario.filter((i) => i.estado === "vendido").length;

        return {
        totalItems,
        totalMarcas: Object.keys(porMarca).length,
        totalAgencias: Object.keys(porAgencia).length,
        disponibles,
        reservadas,
        bloqueadas,
        vendidas,
        porcentajeDisponible:
            totalItems > 0
            ? Math.round((disponibles / totalItems) * 100)
            : 0,
        porMarca,
        porEstado,
        porAgencia,
        };
    };

    const metricas = calcularMetricas();

    // GRÁFICAS
    const chartBarData = {
        labels: Object.keys(metricas.porMarca).sort(),
        datasets: [
        {
            label: "Terminales por Marca",
            data: Object.keys(metricas.porMarca)
            .sort()
            .map((m) => metricas.porMarca[m]),
            backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            "rgba(34, 197, 94, 0.8)",
            "rgba(249, 115, 22, 0.8)",
            "rgba(239, 68, 68, 0.8)",
            "rgba(168, 85, 247, 0.8)",
            "rgba(59, 130, 246, 0.6)",
            "rgba(34, 197, 94, 0.6)",
            ],
            borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(34, 197, 94, 1)",
            "rgba(249, 115, 22, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(168, 85, 247, 1)",
            "rgba(59, 130, 246, 1)",
            "rgba(34, 197, 94, 1)",
            ],
            borderWidth: 2,
        },
        ],
    };

    const chartDoughnutData = {
        labels: Object.keys(metricas.porEstado),
        datasets: [
        {
            label: "Distribución por Estado",
            data: Object.values(metricas.porEstado),
            backgroundColor: Object.keys(metricas.porEstado).map((estado) => {
            switch (estado) {
                case "disponible":
                return "rgba(34, 197, 94, 0.8)"; // Verde
                case "reservado":
                return "rgba(234, 179, 8, 0.8)"; // Amarillo
                case "bloqueado":
                return "rgba(239, 68, 68, 0.8)"; // Rojo
                case "vendido":
                return "rgba(168, 85, 247, 0.8)"; // Lila
                default:
                return "rgba(200, 200, 200, 0.8)"; // Gris por defecto
            }
            }),
            borderColor: Object.keys(metricas.porEstado).map((estado) => {
            switch (estado) {
                case "disponible":
                return "rgba(34, 197, 94, 1)"; // Verde
                case "reservado":
                return "rgba(234, 179, 8, 1)"; // Amarillo
                case "bloqueado":
                return "rgba(239, 68, 68, 1)"; // Rojo
                case "vendido":
                return "rgba(168, 85, 247, 1)"; // Lila
                default:
                return "rgba(200, 200, 200, 1)"; // Gris por defecto
            }
            }),
            borderWidth: 2,
        },
        ],
    };

    // Gráfica de línea - Cargas por día (últimos 30 días)
    const últimos30Días = [];
    const hoy = new Date();
    for (let i = 29; i >= 0; i--) {
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - i);
        últimos30Días.push(fecha.toISOString().split("T")[0]);
    }

    const cargasPorDía = {};
    últimos30Días.forEach((d) => (cargasPorDía[d] = 0));

    inventario.forEach((item) => {
        if (item.creadoEn) {
        const fecha = item.creadoEn?.toDate
            ? item.creadoEn.toDate()
            : new Date(item.creadoEn);
        const diaStr = fecha.toISOString().split("T")[0];
        if (cargasPorDía.hasOwnProperty(diaStr)) {
            cargasPorDía[diaStr]++;
        }
        }
    });

    const chartLineData = {
        labels: últimos30Días.map((d) =>
        new Date(d).toLocaleDateString("es-CR", { month: "short", day: "numeric" })
        ),
        datasets: [
        {
            label: "Items cargados",
            data: últimos30Días.map((d) => cargasPorDía[d] || 0),
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "rgba(59, 130, 246, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
        },
        ],
    };

    return (
        <div style={{ padding: "20px", background: "#f9fafb", minHeight: "100vh" }}>
        {/* Pantalla de carga estilo Apple */}
        {cargando && (
            <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(255, 255, 255, 0.95)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                backdropFilter: "blur(4px)",
            }}
            >
            <div style={{ textAlign: "center" }}>
                {/* Spinner animado */}
                <div
                style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    border: "4px solid #e5e7eb",
                    borderTop: "4px solid #3b82f6",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 24px",
                }}
                />
                <h2 style={{ color: "#1f2937", marginBottom: 8, fontSize: "18px", fontWeight: "600" }}>
                Cargando Inventario
                </h2>
                <p style={{ color: "#9ca3af", margin: 0, fontSize: "14px" }}>
                Procesando datos...
                </p>
                {/* Dots animados */}
                <div
                style={{
                    marginTop: 20,
                    display: "flex",
                    gap: 6,
                    justifyContent: "center",
                }}
                >
                {[0, 1, 2].map((i) => (
                    <div
                    key={i}
                    style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#3b82f6",
                        animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
                    }}
                    />
                ))}
                </div>
            </div>
            </div>
        )}

        {/* Encabezado */}
        <div
            style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            }}
        >
            <div>
            <h1 style={{ margin: "0 0 8px 0", color: "#1f2937" }}>
                📦 Análisis de Inventario
            </h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
                Visualiza métricas y estadísticas de tu inventario
            </p>
            </div>
        </div>

        {/* KPIs */}
        <div
            style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
            }}
        >
            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                borderLeft: "4px solid #3b82f6",
            }}
            >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Total Items
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
                {metricas.totalItems}
            </div>
            </div>

            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                borderLeft: "4px solid #22c55e",
            }}
            >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Disponibles
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#22c55e" }}>
                {metricas.disponibles}
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                {metricas.porcentajeDisponible}% del total
            </div>
            </div>

            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                borderLeft: "4px solid #f59e0b",
            }}
            >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Reservadas
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#f59e0b" }}>
                {metricas.reservadas}
            </div>
            </div>

            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                borderLeft: "4px solid #ef4444",
            }}
            >
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Bloqueadas
            </div>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}>
                {metricas.bloqueadas}
            </div>
            </div>
        </div>

        {/* Gráficas */}
        <div
            style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
            }}
        >
            {/* Bar Chart */}
            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.3s ease",
            }}
            onClick={() => setZoomedChart("bar")}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
                e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
            }}
            >
            <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
                Inventario por Marca
            </h3>
            <div ref={chartBarRef} style={{ position: "relative", height: "300px" }}>
                <Bar
                key="bar-inventory"
                data={chartBarData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                    legend: { display: true, position: "top" },
                    },
                }}
                />
            </div>
            </div>

            {/* Doughnut Chart */}
            <div
            style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                cursor: "pointer",
                transition: "all 0.3s ease",
            }}
            onClick={() => setZoomedChart("doughnut")}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
                e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
            }}
            >
            <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
                Distribución por Estado
            </h3>
            <div
                style={{ position: "relative", height: "300px", display: "flex", justifyContent: "center" }}
            >
                <div style={{ width: "250px", height: "250px" }}>
                <Doughnut
                    key="doughnut-inventory"
                    data={chartDoughnutData}
                    options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: "bottom" },
                    },
                    }}
                />
                </div>
            </div>
            </div>
        </div>

        {/* Line Chart Full Width */}
        <div
            style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "24px",
            cursor: "pointer",
            transition: "all 0.3s ease",
            }}
            onClick={() => setZoomedChart("line")}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
                e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
            Tendencia de Carga (Últimos 30 días)
            </h3>
            <div ref={chartLineRef} style={{ position: "relative", height: "300px" }}>
            <Line
                key="line-inventory"
                data={chartLineData}
                options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true },
                },
                }}
            />
            </div>
        </div>

        {/* Detalles por Agencia */}
        <div
            style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}
        >
            <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
            Inventario por Agencia
            </h3>
            <div style={{ overflowX: "auto" }}>
            <table
                style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                }}
            >
                <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: "600" }}>
                    Agencia
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>
                    Items
                    </th>
                    <th style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>
                    % del Total
                    </th>
                </tr>
                </thead>
                <tbody>
                {Object.entries(metricas.porAgencia)
                    .sort((a, b) => b[1] - a[1])
                    .map(([agencia, cantidad], idx) => (
                    <tr
                        key={idx}
                        style={{
                        borderBottom: "1px solid #e5e7eb",
                        background: idx % 2 === 0 ? "#fff" : "#f9fafb",
                        }}
                    >
                        <td style={{ padding: "12px" }}>{agencia}</td>
                        <td style={{ padding: "12px", textAlign: "center", fontWeight: "600" }}>
                        {cantidad}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#6b7280" }}>
                        {Math.round((cantidad / metricas.totalItems) * 100)}%
                        </td>
                    </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>

        {/* Modal Zoom - Estilo Apple */}
        {zoomedChart && (
            <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                animation: "fadeIn 0.3s ease-out",
            }}
            onClick={() => setZoomedChart(null)}
            >
            <style>{`
                @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
                }
                @keyframes zoomIn {
                from {
                    transform: scale(0.95) translateZ(0);
                    opacity: 0;
                }
                to {
                    transform: scale(1) translateZ(0);
                    opacity: 1;
                }
                }
            `}</style>
            <div
                style={{
                background: "#fff",
                borderRadius: "20px",
                padding: "32px",
                maxWidth: "90vw",
                maxHeight: "90vh",
                width: "1000px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
                animation: "zoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                overflow: "auto",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                onClick={() => setZoomedChart(null)}
                style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    fontSize: "24px",
                    transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e5e7eb";
                    e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                    e.currentTarget.style.transform = "scale(1)";
                }}
                >
                ✕
                </button>

                {/* Chart Content */}
                <div>
                {zoomedChart === "bar" && (
                    <div>
                    <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                        Inventario por Marca
                    </h2>
                    <div style={{ position: "relative", height: "500px" }}>
                        <Bar
                        key="bar-zoom"
                        data={chartBarData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                            legend: { display: true, position: "top" },
                            },
                        }}
                        />
                    </div>
                    </div>
                )}

                {zoomedChart === "doughnut" && (
                    <div>
                    <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                        Distribución por Estado
                    </h2>
                    <div style={{ position: "relative", height: "500px", display: "flex", justifyContent: "center" }}>
                        <div style={{ width: "350px", height: "350px" }}>
                        <Doughnut
                            key="doughnut-zoom"
                            data={chartDoughnutData}
                            options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: "bottom" },
                            },
                            }}
                        />
                        </div>
                    </div>
                    </div>
                )}

                {zoomedChart === "line" && (
                    <div>
                    <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                        Tendencia de Carga (Últimos 30 días)
                    </h2>
                    <div style={{ position: "relative", height: "500px" }}>
                        <Line
                        key="line-zoom"
                        data={chartLineData}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                            legend: { display: true },
                            },
                        }}
                        />
                    </div>
                    </div>
                )}
                </div>
            </div>
            </div>
        )}

        {/* Estilos de animación */}
        <style>{`
            @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
            }
            @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
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
        </div>
    );
    }
