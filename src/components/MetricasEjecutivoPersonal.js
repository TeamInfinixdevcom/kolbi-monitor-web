import React, { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadarController,
  Filler,
  Legend,
  Tooltip,
} from "chart.js";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import GaugeChart from "react-gauge-chart";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadarController,
  Filler,
  Legend,
  Tooltip
);

function MetricasEjecutivoPersonal({ user }) {
  const db = getFirestore();

  // Estado
  const [vendidos, setVendidos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [periodo, setPeriodo] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [zoomedChart, setZoomedChart] = useState(null);

  // Refs para captura de gráficos
  const chartBarRef = useRef();
  const chartLineRef = useRef();
  const chartDoughnutRef = useRef();
  const chartRadarRef = useRef();
  const containerRef = useRef();

  // Cargar vendidos (solo del ejecutivo logueado)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "vendidos"), (snapshot) => {
      const docs = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((v) => {
          const ejecutivoEmail = (v.ejecutivo || "").toLowerCase();
          const userEmail = (user?.correo || user?.email || "").toLowerCase();
          return ejecutivoEmail === userEmail;
        });
      setVendidos(docs);
    });
    return () => unsub();
  }, [user, db]);

  // Cargar eventos
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "marketing_events"), (snapshot) => {
      setEventos(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    });
    return () => unsub();
  }, [db]);

  // CÁLCULOS DE MÉTRICAS
  const calcularMetricas = () => {
    const correoUsuario = (user?.correo || user?.email || "").toLowerCase();

    let ventasEjecutivo = vendidos.filter(
      (v) => (v.ejecutivo || "").toLowerCase() === correoUsuario
    );

    // Aplicar filtro de fecha
    if (periodo === "custom" && fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      ventasEjecutivo = ventasEjecutivo.filter((v) => {
        try {
          const fecha = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          if (!fecha || isNaN(fecha.getTime())) return false;
          return fecha >= inicio && fecha <= fin;
        } catch (e) {
          return false;
        }
      });
    } else if (periodo !== "todos") {
      const hoy = new Date();
      const hace = parseInt(periodo);
      const fechaLimite = new Date(hoy.getTime() - hace * 24 * 60 * 60 * 1000);
      ventasEjecutivo = ventasEjecutivo.filter((v) => {
        try {
          const fecha = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          if (!fecha || isNaN(fecha.getTime())) return false;
          return fecha >= fechaLimite;
        } catch (e) {
          return false;
        }
      });
    }

    // Totales
    const ventasTotal = ventasEjecutivo.length;
    const marcas = {};
    ventasEjecutivo.forEach((v) => {
      const marca = v.marca || "Sin marca";
      marcas[marca] = (marcas[marca] || 0) + 1;
    });

    // Eventos asignados al ejecutivo
    const eventosAsignados = eventos.filter((evt) => {
      if (!evt.convocados || !Array.isArray(evt.convocados)) return false;
      const correo = user?.correo || user?.email || "";
      return evt.convocados.some((c) => c.toLowerCase() === correo.toLowerCase());
    }).length;

    // Calcular días activos
    const diasConVentas = new Set();
    ventasEjecutivo.forEach((v) => {
      try {
        const fecha = v.vendidoAt?.toDate
          ? v.vendidoAt.toDate()
          : new Date(v.vendidoAt);
        if (fecha && !isNaN(fecha.getTime())) {
          const dia = fecha.toISOString().split("T")[0];
          diasConVentas.add(dia);
        }
      } catch (e) {}
    });

    // Gráfico: ventas por día (últimos 30 días)
    const ultimosMeses = {};
    ventasEjecutivo.forEach((v) => {
      try {
        const fecha = v.vendidoAt?.toDate
          ? v.vendidoAt.toDate()
          : new Date(v.vendidoAt);
        if (!fecha || isNaN(fecha.getTime())) return;
        const mes = fecha.toLocaleString("es-CR", {
          year: "numeric",
          month: "short",
        });
        ultimosMeses[mes] = (ultimosMeses[mes] || 0) + 1;
      } catch (e) {}
    });

    // Conversión estimada
    const ratio =
      eventosAsignados > 0
        ? Math.round((ventasTotal / eventosAsignados) * 100)
        : 0;

    return {
      ventasTotal,
      eventosAsignados,
      ratio,
      marcas,
      diasActivos: diasConVentas.size,
      ventasEjecutivo,
      ultimosMeses,
    };
  };

  // PROYECCIÓN DE VENTAS
  const calcularProyeccion = () => {
    const metricas = calcularMetricas();
    if (!metricas || metricas.ventasEjecutivo.length === 0) return null;

    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(
      hoy.getMonth() + 1
    ).padStart(2, "0")}`;
    const diaDelMes = hoy.getDate();
    const diasDelMes = new Date(
      hoy.getFullYear(),
      hoy.getMonth() + 1,
      0
    ).getDate();

    const ventasHastaHoy = metricas.ventasEjecutivo
      .filter((v) => {
        try {
          const fechaVenta = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          if (!fechaVenta || isNaN(fechaVenta.getTime())) return false;
          const isoString = fechaVenta.toISOString();
          return isoString.startsWith(mesActual);
        } catch (e) {
          return false;
        }
      })
      .filter((v) => {
        try {
          const fecha = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          return fecha.getDate() <= diaDelMes;
        } catch (e) {
          return false;
        }
      }).length;

    const ventasProyectadas = Math.ceil((ventasHastaHoy / diaDelMes) * diasDelMes);

    return {
      ventasActuales: ventasHastaHoy,
      ventasProyectadas,
      diaDelMes,
      diasDelMes,
      porcentajeDelMes: Math.round((diaDelMes / diasDelMes) * 100),
    };
  };

  // ANÁLISIS MES A MES
  const calcularMoM = () => {
    const metricas = calcularMetricas();
    if (!metricas) return null;

    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anoActual = hoy.getFullYear();

    const ventasMesActual = metricas.ventasEjecutivo
      .filter((v) => {
        try {
          const fecha = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          if (!fecha || isNaN(fecha.getTime())) return false;
          return fecha.getMonth() === mesActual && fecha.getFullYear() === anoActual;
        } catch (e) {
          return false;
        }
      })
      .length;

    const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
    const anoPasado = mesActual === 0 ? anoActual - 1 : anoActual;

    const ventasMesPasado = metricas.ventasEjecutivo
      .filter((v) => {
        try {
          const fecha = v.vendidoAt?.toDate
            ? v.vendidoAt.toDate()
            : new Date(v.vendidoAt);
          if (!fecha || isNaN(fecha.getTime())) return false;
          return fecha.getMonth() === mesPasado && fecha.getFullYear() === anoPasado;
        } catch (e) {
          return false;
        }
      })
      .length;

    const diferencia = ventasMesActual - ventasMesPasado;
    const porcentajeCambio =
      ventasMesPasado > 0
        ? Math.round((diferencia / ventasMesPasado) * 100)
        : 0;

    const mesActualNombre = new Date(anoActual, mesActual, 1).toLocaleString(
      "es-CR",
      { month: "long" }
    );
    const mesPasadoNombre = new Date(anoPasado, mesPasado, 1).toLocaleString(
      "es-CR",
      { month: "long" }
    );

    return {
      ventasMesActual,
      ventasMesPasado,
      diferencia,
      porcentajeCambio,
      mesActualNombre,
      mesPasadoNombre,
    };
  };

  // GAUGE DATA (Normalizar para el medidor)
  const calcularGaugeData = () => {
    const metricas = calcularMetricas();
    if (!metricas) return 0;

    // Mostrar como % de 100 vendidos es "excelente"
    const valor = Math.min(metricas.ventasTotal / 100, 1);
    return valor;
  };

  // RADAR DATA (Multi-dimensional)
  const calcularRadarData = () => {
    const metricas = calcularMetricas();
    if (!metricas) return null;

    // Normalizar valores a escala 0-100
    const vendidos = Math.min(metricas.ventasTotal * 10, 100);
    const eventos = Math.min(metricas.eventosAsignados * 5, 100);
    const conversion = metricas.ratio;
    const diasActivos = Math.min(metricas.diasActivos * 3.33, 100);

    return {
      labels: ["Ventas", "Eventos", "Conversión %", "Días Activos"],
      datasets: [
        {
          label: "Mi Desempeño",
          data: [vendidos, eventos, conversion, diasActivos],
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderWidth: 2,
          fill: true,
        },
      ],
    };
  };

  // PDF GENERATION
  const generarPDF = async () => {
    setGenerandoPDF(true);
    try {
      const metricas = calcularMetricas();
      const proyeccion = calcularProyeccion();
      const mom = calcularMoM();

      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPosition = 15;

      // Encabezado
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 30, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.text("MIS MÉTRICAS DE DESEMPEÑO", pageWidth / 2, 15, {
        align: "center",
      });

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(11);
      yPosition = 40;

      // KPIs
      const kpiY = yPosition;
      pdf.setFontSize(10);
      pdf.setTextColor(59, 130, 246);
      pdf.text("INDICADORES CLAVE", 15, kpiY);

      yPosition += 8;
      const kpiData = [
        ["Ventas Totales", `${metricas.ventasTotal}`],
        ["Eventos Asignados", `${metricas.eventosAsignados}`],
        ["Ratio de Conversión", `${metricas.ratio}%`],
        ["Días Activos", `${metricas.diasActivos}`],
      ];

      if (pdf.autoTable) {
        pdf.autoTable({
          startY: yPosition,
          head: [["Métrica", "Valor"]],
          body: kpiData,
          theme: "grid",
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40 } },
        });

        yPosition = pdf.lastAutoTable.finalY + 10;
      } else {
        yPosition += 15;
      }

      // Proyección
      if (proyeccion) {
        pdf.setTextColor(59, 130, 246);
        pdf.setFontSize(11);
        pdf.text("PROYECCIÓN DEL MES", 15, yPosition);
        yPosition += 7;

        const proyData = [
          ["Ventas Hasta Hoy", `${proyeccion.ventasActuales}`],
          ["Ventas Proyectadas", `${proyeccion.ventasProyectadas}`],
          ["% del Mes Transcurrido", `${proyeccion.porcentajeDelMes}%`],
        ];

        if (pdf.autoTable) {
          pdf.autoTable({
            startY: yPosition,
            head: [["Concepto", "Valor"]],
            body: proyData,
            theme: "grid",
            headStyles: { fillColor: [34, 197, 94], textColor: 255 },
          });

          yPosition = pdf.lastAutoTable.finalY + 10;
        } else {
          yPosition += 15;
        }
      }

      // MoM
      if (mom) {
        pdf.setTextColor(59, 130, 246);
        pdf.setFontSize(11);
        pdf.text("MES A MES (MoM)", 15, yPosition);
        yPosition += 7;

        const momData = [
          [`${mom.mesActualNombre} (Actual)`, `${mom.ventasMesActual}`],
          [`${mom.mesPasadoNombre} (Pasado)`, `${mom.ventasMesPasado}`],
          [
            "Cambio %",
            `${mom.porcentajeCambio > 0 ? "+" : ""}${mom.porcentajeCambio}%`,
          ],
        ];

        if (pdf.autoTable) {
          pdf.autoTable({
            startY: yPosition,
            head: [["Período", "Ventas"]],
            body: momData,
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          });

          yPosition = pdf.lastAutoTable.finalY + 10;
        } else {
          yPosition += 15;
        }
      }

      // Capturar y agregar gráficos si existen refs
      if (containerRef.current) {
        try {
          const canvas = await html2canvas(containerRef.current, {
            scale: 2,
            useCORS: true,
          });
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = pageWidth - 20;
          const imgHeight = (canvas.height / canvas.width) * imgWidth;

          if (yPosition + imgHeight > pageHeight - 10) {
            pdf.addPage();
            yPosition = 15;
          }

          pdf.image(imgData, 10, yPosition, imgWidth, imgHeight);
        } catch (err) {
          console.log("No se pudieron capturar los gráficos:", err);
        }
      }

      // Descargar
      pdf.save(`metricas-${new Date().toISOString().split("T")[0]}.pdf`);
      showSnackbar("PDF descargado exitosamente", "success");
    } catch (error) {
      console.error("Error generando PDF:", error);
      showSnackbar("Error al generar PDF", "error");
    } finally {
      setGenerandoPDF(false);
    }
  };

  const showSnackbar = (message, type) => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Preparar datos para gráficos
  const metricas = calcularMetricas();
  const proyeccion = calcularProyeccion();
  const mom = calcularMoM();
  const gaugeValue = calcularGaugeData();
  const radarData = calcularRadarData();

  if (!metricas) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p>No hay datos disponibles para mostrar métricas.</p>
      </div>
    );
  }

  // Gráfico de barras: Marcas
  const chartBarData = {
    labels: Object.keys(metricas.marcas),
    datasets: [
      {
        label: "Ventas por Marca",
        data: Object.values(metricas.marcas),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 2,
      },
    ],
  };

  // Gráfico de línea: Ventas por mes
  const chartLineData = {
    labels: Object.keys(metricas.ultimosMeses),
    datasets: [
      {
        label: "Ventas por Mes",
        data: Object.values(metricas.ultimosMeses),
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Gráfico Doughnut: Distribución
  const chartDoughnutData = {
    labels: ["Ventas", "Eventos", "Otros"],
    datasets: [
      {
        data: [
          metricas.ventasTotal,
          metricas.eventosAsignados,
          Math.max(0, metricas.eventosAsignados - metricas.ventasTotal),
        ],
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(239, 68, 68, 0.8)",
        ],
        borderColor: [
          "rgba(59, 130, 246, 1)",
          "rgba(34, 197, 94, 1)",
          "rgba(239, 68, 68, 1)",
        ],
        borderWidth: 2,
      },
    ],
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#f9fafb",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            margin: "0 0 15px 0",
            color: "#1f2937",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          Mis Métricas de Desempeño
          <button
            onClick={generarPDF}
            disabled={generandoPDF}
            style={{
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            {generandoPDF ? "Generando..." : "Descargar PDF"}
          </button>
        </h2>

        {/* Controles */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
            }}
          >
            <option value="todos">Todos los tiempos</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="custom">Rango personalizado</option>
          </select>

          {periodo === "custom" && (
            <>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #3b82f6",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "5px" }}>
            Ventas Totales
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
            {metricas.ventasTotal}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #22c55e",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "5px" }}>
            Eventos Asignados
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
            {metricas.eventosAsignados}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #f59e0b",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "5px" }}>
            Ratio de Conversión
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
            {metricas.ratio}%
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #8b5cf6",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "5px" }}>
            Días Activos
          </div>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#1f2937" }}>
            {metricas.diasActivos}
          </div>
        </div>
      </div>

      {/* Proyección */}
      {proyeccion && (
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderTop: "4px solid #3b82f6",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
            Proyección del Mes
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                Ventas Hasta Hoy ({proyeccion.diaDelMes}/{proyeccion.diasDelMes})
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#3b82f6" }}>
                {proyeccion.ventasActuales}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                Ventas Proyectadas
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#22c55e" }}>
                {proyeccion.ventasProyectadas}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MoM */}
      {mom && (
        <div
          style={{
            background: "#fef2f2",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            borderLeft: "4px solid #ef4444",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
            Análisis Mes a Mes
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {mom.mesActualNombre} (Actual)
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
                {mom.ventasMesActual}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {mom.mesPasadoNombre} (Pasado)
              </div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#1f2937" }}>
                {mom.ventasMesPasado}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>Cambio %</div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color:
                    mom.porcentajeCambio >= 0
                      ? "#22c55e"
                      : "#ef4444",
                }}
              >
                {mom.porcentajeCambio > 0 ? "+" : ""}
                {mom.porcentajeCambio}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gauge Chart */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          marginBottom: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
          Indicador de Desempeño
        </h3>
        <div style={{ maxWidth: "300px", margin: "0 auto" }}>
          <GaugeChart
            id="gauge-chart-personal"
            nrOfLevels={10}
            arcsLength={[0.3, 0.5, 0.2]}
            colors={["#ef4444", "#f59e0b", "#22c55e"]}
            percent={gaugeValue}
            textColor="#000"
          />
        </div>
      </div>

      {/* Radar Chart */}
      {radarData && (
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>
            Análisis Multidimensional
          </h3>
          <div
            style={{
              maxWidth: "500px",
              margin: "0 auto",
              position: "relative",
              height: "300px",
            }}
            ref={chartRadarRef}
          >
            <Radar
              key="radar-main"
              data={radarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  r: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Gráficos adicionales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
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
            Ventas por Marca
          </h3>
          <div ref={chartBarRef} style={{ position: "relative", height: "300px" }}>
            <Bar
              key="bar-main"
              data={chartBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
              }}
            />
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
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
          <h3 style={{ margin: "0 0 15px 0", color: "#1f2937" }}>Distribución</h3>
          <div
            ref={chartDoughnutRef}
            style={{ position: "relative", height: "300px" }}
          >
            <Doughnut
              key="doughnut-main"
              data={chartDoughnutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
              }}
            />
          </div>
        </div>
      </div>

      {/* Gráfico de línea full-width */}
      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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
          Tendencia de Ventas
        </h3>
        <div ref={chartLineRef} style={{ position: "relative", height: "250px" }}>
          <Line
            key="line-main"
            data={chartLineData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
            }}
          />
        </div>
      </div>

      {/* Container para captura de gráficos en PDF */}
      <div ref={containerRef} style={{ display: "none" }}>
        <div style={{ position: "relative", height: "300px" }}>
          {radarData && <Radar key="radar-pdf" data={radarData} />}
        </div>
        <div style={{ position: "relative", height: "300px" }}>
          <Bar key="bar-pdf" data={chartBarData} />
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
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes zoomIn {
              from { transform: scale(0.95) translateZ(0); opacity: 0; }
              to { transform: scale(1) translateZ(0); opacity: 1; }
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

            {zoomedChart === "bar" && (
              <div>
                <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                  Ventas por Marca
                </h2>
                <div style={{ position: "relative", height: "500px" }}>
                  <Bar
                    key="bar-zoom"
                    data={chartBarData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>
            )}

            {zoomedChart === "doughnut" && (
              <div>
                <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                  Distribución
                </h2>
                <div style={{ position: "relative", height: "500px", display: "flex", justifyContent: "center" }}>
                  <div style={{ width: "350px", height: "350px" }}>
                    <Doughnut
                      key="doughnut-zoom"
                      data={chartDoughnutData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {zoomedChart === "line" && (
              <div>
                <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
                  Tendencia de Ventas
                </h2>
                <div style={{ position: "relative", height: "500px" }}>
                  <Line
                    key="line-zoom"
                    data={chartLineData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricasEjecutivoPersonal;
