import React, { useState, useEffect } from "react";
import { Line, Bar, Doughnut, Radar } from "react-chartjs-2";
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
  RadarController,
} from "chart.js";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import GaugeChart from "react-gauge-chart";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadarController,
  Title,
  Tooltip,
  Legend
);

export default function MetricasEjecutivos({ ejecutivos = [] }) {
  const [vendidos, setVendidos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [ejecutivosLista, setEjecutivosLista] = useState([]);
  const [ejecutivoSeleccionado, setEjecutivoSeleccionado] = useState(null);
  const [ejecutivosComparar, setEjecutivosComparar] = useState([]);
  const [periodoTiempo, setPeriodoTiempo] = useState("mensual");
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [modo, setModo] = useState("individual");
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [zoomedChart, setZoomedChart] = useState(null);
  
  // Referencias para capturar gráficas
  const chartBarRef = React.useRef(null);
  const chartDoughnutRef = React.useRef(null);

  // Cargar datos
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        const dbf = getFirestore();
        
        // Cargar usuarios y crear mapeo correo -> nombre
        const usuariosSnap = await getDocs(collection(dbf, "usuarios"));
        const mapeo = {};
        const listaEjecutivos = [];
        
        usuariosSnap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.correo && data.nombre && data.rol === "ejecutivo" && data.estado === "activo") {
            mapeo[data.correo.toLowerCase()] = data.nombre;
            mapeo[data.correo] = data.nombre;
            listaEjecutivos.push({
              id: doc.id,
              correo: data.correo,
              nombre: data.nombre,
              cedula: data.cedula
            });
          }
        });
        
        setEjecutivosLista(listaEjecutivos);
        
        const vendidosSnap = await getDocs(collection(dbf, "vendidos"));
        setVendidos(vendidosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const eventosSnap = await getDocs(collection(dbf, "marketing_events"));
        setEventos(eventosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  // Funciones de agrupación
  const obtenerMesAño = (fecha) => {
    if (!fecha) return null;
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const obtenerTrimestre = (fecha) => {
    if (!fecha) return null;
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    const trimestre = Math.ceil((d.getMonth() + 1) / 3);
    return `Q${trimestre}-${d.getFullYear()}`;
  };

  const obtenerSemana = (fecha) => {
    if (!fecha) return null;
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    const inicio = new Date(d.getFullYear(), 0, 1);
    const diasDiferencia = Math.floor((d - inicio) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((diasDiferencia + inicio.getDay() + 1) / 7);
    return `Sem-${semana}-${d.getFullYear()}`;
  };

  const obtenerAño = (fecha) => {
    if (!fecha) return null;
    const d = fecha.toDate ? fecha.toDate() : new Date(fecha);
    return `${d.getFullYear()}`;
  };

  const agruparPorPeriodo = (datos, getter) => {
    const agrupados = {};
    datos.forEach((item) => {
      const periodo = getter(item.vendidoAt || item.createdAt);
      if (periodo) {
        if (!agrupados[periodo]) agrupados[periodo] = [];
        agrupados[periodo].push(item);
      }
    });
    return agrupados;
  };

  const getterPeriodo = () => {
    switch (periodoTiempo) {
      case "semanal":
        return obtenerSemana;
      case "mensual":
        return obtenerMesAño;
      case "trimestral":
        return obtenerTrimestre;
      case "anual":
        return obtenerAño;
      default:
        return obtenerMesAño;
    }
  };

  // Filtrar por rango de fechas
  const filtrarPorFechas = (datos) => {
    if (!fechaInicio || !fechaFin) return datos;
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);
    return datos.filter((item) => {
      const fecha = item.vendidoAt?.toDate
        ? item.vendidoAt.toDate()
        : new Date(item.vendidoAt);
      return fecha >= inicio && fecha <= fin;
    });
  };

  // Obtener ventas por marca
  const obtenerVentasPorMarca = (ventasLista) => {
    const marcas = {};
    ventasLista.forEach((venta) => {
      const marca = venta.marca || "Sin especificar";
      marcas[marca] = (marcas[marca] || 0) + 1;
    });
    return Object.entries(marcas)
      .map(([marca, cantidad]) => ({ marca, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  };

  // Calcular métricas individual
  const calcularMetricas = () => {
    if (!ejecutivoSeleccionado) return null;

    const nombreEjecutivo = ejecutivoSeleccionado.nombre;
    const correoEjecutivo = ejecutivoSeleccionado.correo;

    // Filtrar por email exacto (case-insensitive)
    let ventasEjecutivo = vendidos.filter((v) => {
      const emailVenta = (v.ejecutivo || "").toLowerCase();
      return emailVenta === correoEjecutivo.toLowerCase();
    });

    ventasEjecutivo = filtrarPorFechas(ventasEjecutivo);

    const eventosEjecutivo = eventos.filter(
      (e) =>
        (e.convocados || []).includes(correoEjecutivo) ||
        (e.convocados || []).some(c => c.toLowerCase() === correoEjecutivo.toLowerCase())
    );

    const getter = getterPeriodo();
    const ventasAgrupadas = agruparPorPeriodo(ventasEjecutivo, getter);
    const periodosOrdenados = Object.keys(ventasAgrupadas).sort();
    const ventasPorMarca = obtenerVentasPorMarca(ventasEjecutivo);

    return {
      nombreEjecutivo,
      ventasTotal: ventasEjecutivo.length,
      eventosTotal: eventosEjecutivo.length,
      ventasAgrupadas,
      periodosOrdenados,
      ventasEjecutivo,
      eventosEjecutivo,
      ventasPorMarca,
    };
  };

  // Calcular métricas comparativa
  const calcularComparativa = () => {
    if (ejecutivosComparar.length === 0) return [];

    return ejecutivosComparar.map((ej) => {
      let ventasEj = vendidos.filter((v) => {
        const emailVenta = (v.ejecutivo || "").toLowerCase();
        return emailVenta === ej.correo.toLowerCase();
      });
      ventasEj = filtrarPorFechas(ventasEj);
      return {
        nombre: ej.nombre,
        correo: ej.correo,
        ventas: ventasEj.length,
      };
    });
  };

  // ========== NUEVAS FUNCIONES PREMIUM ==========

  // 1. PROYECCIÓN DE VENTAS
  const calcularProyeccion = () => {
    const metricas = calcularMetricas();
    if (!metricas || metricas.periodosOrdenados.length === 0) return null;

    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const diaDelMes = hoy.getDate();
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();

    const ventasHastaHoy = metricas.ventasEjecutivo.filter((v) => {
      try {
        const fechaVenta = v.vendidoAt?.toDate ? v.vendidoAt.toDate() : new Date(v.vendidoAt);
        if (!fechaVenta || isNaN(fechaVenta.getTime())) return false;
        const isoString = fechaVenta.toISOString();
        return isoString.startsWith(mesActual);
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

  // 2. BENCHMARKING - COMPARAR CON PROMEDIO
  const calcularBenchmarking = () => {
    const metricas = calcularMetricas();
    if (!metricas) return null;

    // Calcular promedio de todos los ejecutivos
    const ventasPorEjecutivo = {};
    vendidos.forEach((v) => {
      const email = (v.ejecutivo || "").toLowerCase();
      ventasPorEjecutivo[email] = (ventasPorEjecutivo[email] || 0) + 1;
    });

    const ventas = Object.values(ventasPorEjecutivo);
    const promedio = ventas.length > 0 ? Math.round(ventas.reduce((a, b) => a + b, 0) / ventas.length) : 0;
    const maxVentas = Math.max(...ventas, 0);

    const miPosicion = ventas.filter((v) => v > metricas.ventasTotal).length + 1;
    const totalEjecutivos = ventas.length;

    return {
      ventasActuales: metricas.ventasTotal,
      promedio,
      maxVentas,
      miPosicion,
      totalEjecutivos,
      diferenciaPromedio: metricas.ventasTotal - promedio,
      porcentajePromedio: promedio > 0 ? Math.round((metricas.ventasTotal / promedio) * 100) : 0,
    };
  };

  // 3. ANÁLISIS MES A MES (MoM)
  const calcularMoM = () => {
    const metricas = calcularMetricas();
    if (!metricas || !ejecutivoSeleccionado) return null;

    const correoEjecutivo = ejecutivoSeleccionado.correo;
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const anoActual = hoy.getFullYear();

    // Ventas del mes actual
    const ventasMesActual = vendidos.filter((v) => {
      try {
        if ((v.ejecutivo || "").toLowerCase() !== correoEjecutivo.toLowerCase()) return false;
        const fecha = v.vendidoAt?.toDate ? v.vendidoAt.toDate() : new Date(v.vendidoAt);
        if (!fecha || isNaN(fecha.getTime())) return false;
        return fecha.getMonth() === mesActual && fecha.getFullYear() === anoActual;
      } catch (e) {
        return false;
      }
    }).length;

    // Ventas del mes anterior
    const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
    const anoPasado = mesActual === 0 ? anoActual - 1 : anoActual;

    const ventasMesPasado = vendidos.filter((v) => {
      try {
        if ((v.ejecutivo || "").toLowerCase() !== correoEjecutivo.toLowerCase()) return false;
        const fecha = v.vendidoAt?.toDate ? v.vendidoAt.toDate() : new Date(v.vendidoAt);
        if (!fecha || isNaN(fecha.getTime())) return false;
        return fecha.getMonth() === mesPasado && fecha.getFullYear() === anoPasado;
      } catch (e) {
        return false;
      }
    }).length;

    const diferencia = ventasMesActual - ventasMesPasado;
    const porcentajeCambio = ventasMesPasado > 0 ? Math.round((diferencia / ventasMesPasado) * 100) : 0;

    const mesActualNombre = new Date(anoActual, mesActual, 1).toLocaleString("es-CR", {
      month: "long",
    });
    const mesPasadoNombre = new Date(anoPasado, mesPasado, 1).toLocaleString("es-CR", {
      month: "long",
    });

    return {
      ventasMesActual,
      ventasMesPasado,
      diferencia,
      porcentajeCambio,
      mesActualNombre: mesActualNombre.charAt(0).toUpperCase() + mesActualNombre.slice(1),
      mesPasadoNombre: mesPasadoNombre.charAt(0).toUpperCase() + mesPasadoNombre.slice(1),
      mejora: diferencia > 0,
    };
  };

  // 4. DATOS PARA GAUGE CHART
  const calcularGaugeData = () => {
    const benchmark = calcularBenchmarking();
    if (!benchmark) return 0;
    return Math.min(benchmark.porcentajePromedio / 100, 1); // 0-1 para el gauge
  };

  // 5. DATOS PARA RADAR CHART (COMPARACIÓN MULTI-DIMENSIONAL)
  const calcularRadarData = () => {
    if (ejecutivosComparar.length === 0) return null;

    // Métricas para cada ejecutivo
    const datosRadar = ejecutivosComparar.map((ej) => {
      let ventasEj = vendidos.filter((v) => {
        const emailVenta = (v.ejecutivo || "").toLowerCase();
        return emailVenta === ej.correo.toLowerCase();
      });
      ventasEj = filtrarPorFechas(ventasEj);

      const eventosEj = eventos.filter((e) =>
        (e.convocados || []).some((c) => c.toLowerCase() === ej.correo.toLowerCase())
      ).length;

      const tasaConversion = eventosEj > 0 ? Math.round((ventasEj.length / eventosEj) * 100) : 0;
      const ventasPorMarcaEj = {};
      ventasEj.forEach((v) => {
        const marca = v.marca || "Otros";
        ventasPorMarcaEj[marca] = (ventasPorMarcaEj[marca] || 0) + 1;
      });
      const diversidadMarcas = Object.keys(ventasPorMarcaEj).length;

      return {
        nombre: ej.nombre,
        ventas: ventasEj.length,
        eventos: eventosEj,
        tasaConversion,
        diversidadMarcas,
      };
    });

    // Normalizar para radar (0-100)
    const maxVentas = Math.max(...datosRadar.map((d) => d.ventas), 1);
    const maxEventos = Math.max(...datosRadar.map((d) => d.eventos), 1);
    const maxMarcas = Math.max(...datosRadar.map((d) => d.diversidadMarcas), 1);

    return datosRadar.map((d) => ({
      nombre: d.nombre,
      "Ventas": Math.round((d.ventas / maxVentas) * 100),
      "Eventos": Math.round((d.eventos / maxEventos) * 100),
      "Conversión %": d.tasaConversion,
      "Marcas": Math.round((d.diversidadMarcas / maxMarcas) * 100),
    }));
  };

  // Generar PDF Profesional CON GRÁFICAS
  const generarPDF = async () => {
    const metricas = calcularMetricas();
    if (!metricas) return;

    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 10;

    // ========== HEADER PROFESIONAL ==========
    pdf.setFillColor(59, 130, 246); // #3b82f6
    pdf.rect(0, 0, pageWidth, 40, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, "bold");
    pdf.text("📊 REPORTE DE MÉTRICAS", pageWidth / 2, 18, { align: "center" });

    pdf.setFontSize(10);
    pdf.setFont(undefined, "normal");
    pdf.text("Sistema de Gestión de Ventas - Kolbi Monitor", pageWidth / 2, 30, {
      align: "center",
    });

    yPos = 50;

    // ========== INFORMACIÓN DEL EJECUTIVO ==========
    pdf.setTextColor(0, 0, 0);
    pdf.setFillColor(226, 232, 240);
    pdf.rect(10, yPos, pageWidth - 20, 35, "F");

    pdf.setFont(undefined, "bold");
    pdf.setFontSize(12);
    pdf.text("INFORMACIÓN DEL EJECUTIVO", 15, yPos + 6);

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    yPos += 12;

    pdf.text(`Ejecutivo: ${metricas.nombreEjecutivo}`, 15, yPos);
    pdf.text(`Período: ${periodoTiempo.toUpperCase()}`, pageWidth / 2, yPos);
    yPos += 7;

    pdf.text(`Fecha del Reporte: ${new Date().toLocaleDateString("es-CR")}`, 15, yPos);
    pdf.text(
      `Datos al: ${new Date().toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}`,
      pageWidth / 2,
      yPos
    );

    yPos += 15;

    // ========== KPIs DESTACADOS ==========
    const kpiWidth = (pageWidth - 30) / 3;

    // KPI 1: Ventas
    pdf.setFillColor(59, 130, 246);
    pdf.rect(10, yPos, kpiWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(14);
    pdf.text(`${metricas.ventasTotal}`, 10 + kpiWidth / 2, yPos + 10, {
      align: "center",
    });
    pdf.setFontSize(9);
    pdf.setFont(undefined, "normal");
    pdf.text("TOTAL VENTAS", 10 + kpiWidth / 2, yPos + 18, { align: "center" });

    // KPI 2: Eventos
    pdf.setFillColor(16, 185, 129);
    pdf.rect(10 + kpiWidth + 5, yPos, kpiWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(14);
    pdf.text(`${metricas.eventosTotal}`, 10 + kpiWidth + 5 + kpiWidth / 2, yPos + 10, {
      align: "center",
    });
    pdf.setFontSize(9);
    pdf.setFont(undefined, "normal");
    pdf.text("EVENTOS ASISTIDOS", 10 + kpiWidth + 5 + kpiWidth / 2, yPos + 18, {
      align: "center",
    });

    // KPI 3: Ratio
    const ratio = metricas.eventosTotal > 0 ? (metricas.ventasTotal / metricas.eventosTotal).toFixed(2) : 0;
    pdf.setFillColor(245, 158, 11);
    pdf.rect(10 + (kpiWidth + 5) * 2, yPos, kpiWidth, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(14);
    pdf.text(`${ratio}`, 10 + (kpiWidth + 5) * 2 + kpiWidth / 2, yPos + 10, {
      align: "center",
    });
    pdf.setFontSize(9);
    pdf.setFont(undefined, "normal");
    pdf.text("VENTA/EVENTO", 10 + (kpiWidth + 5) * 2 + kpiWidth / 2, yPos + 18, {
      align: "center",
    });

    yPos += 40;

    // ========== CAPTURAR GRÁFICAS ==========
    let chartBarImage = null;
    let chartDoughnutImage = null;

    try {
      // Capturar gráfica de barras
      if (chartBarRef.current) {
        const canvas = await html2canvas(chartBarRef.current, { scale: 2 });
        chartBarImage = canvas.toDataURL("image/png");
      }

      // Capturar gráfica doughnut
      if (chartDoughnutRef.current) {
        const canvas = await html2canvas(chartDoughnutRef.current, { scale: 2 });
        chartDoughnutImage = canvas.toDataURL("image/png");
      }
    } catch (err) {
      console.error("Error capturando gráficas:", err);
    }

    // ========== MOSTRAR GRÁFICAS EN PDF ==========
    if (chartBarImage) {
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFont(undefined, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text("GRÁFICA: VENTAS POR PERÍODO", 15, yPos);
      yPos += 8;

      const imgWidth = pageWidth - 30;
      const imgHeight = 50;
      pdf.addImage(chartBarImage, "PNG", 15, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    }

    if (chartDoughnutImage) {
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFont(undefined, "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.text("GRÁFICA: MARCAS MÁS VENDIDAS", 15, yPos);
      yPos += 8;

      const imgWidth = 60;
      const imgHeight = 60;
      const xPos = pageWidth / 2 - imgWidth / 2;
      pdf.addImage(chartDoughnutImage, "PNG", xPos, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 10;
    }

    // ========== TABLA: VENTAS POR PERÍODO ==========
    if (yPos > pageHeight - 60) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, "bold");
    pdf.setFontSize(11);
    pdf.text("RESUMEN: VENTAS POR PERÍODO", 15, yPos);
    yPos += 8;

    const tableData = metricas.periodosOrdenados.map((periodo) => [
      periodo,
      metricas.ventasAgrupadas[periodo].length,
    ]);

    if (pdf.autoTable) {
      pdf.autoTable({
        startY: yPos,
        head: [["Período", "Cantidad de Ventas"]],
        body: tableData,
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          fontSize: 9,
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [240, 249, 255],
        },
        margin: { left: 15, right: 15 },
        theme: "grid",
      });

      yPos = pdf.lastAutoTable.finalY + 10;
    }

    // ========== TABLA: VENTAS POR MARCA ==========
    if (metricas.ventasPorMarca.length > 0) {
      if (yPos > pageHeight - 60) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFont(undefined, "bold");
      pdf.setFontSize(11);
      pdf.text("RESUMEN: MARCAS MÁS VENDIDAS", 15, yPos);
      yPos += 8;

      const marcasData = metricas.ventasPorMarca.slice(0, 10).map((m) => [
        m.marca,
        m.cantidad,
      ]);

      if (pdf.autoTable) {
        pdf.autoTable({
          startY: yPos,
          head: [["Marca", "Cantidad"]],
          body: marcasData,
          headStyles: {
            fillColor: [16, 185, 129],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            halign: "center",
          },
          bodyStyles: {
            fontSize: 9,
            halign: "center",
          },
          alternateRowStyles: {
            fillColor: [240, 254, 247],
          },
          margin: { left: 15, right: 15 },
          theme: "grid",
        });
      }
    }

    // ========== FOOTER ==========
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(8);
    pdf.text(
      `Generado por: Sistema de Métricas Kolbi | ${new Date().toLocaleString("es-CR")}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );

    pdf.save(
      `Reporte_${metricas.nombreEjecutivo}_${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const metricas = calcularMetricas();
  const comparativa = modo === "comparativa" ? calcularComparativa() : [];

  if (loading)
    return <div style={{ padding: 20, textAlign: "center" }}>⏳ Cargando...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>📊 Métricas Avanzadas</h2>

      {/* Tabs de modo */}
      <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
        <button
          onClick={() => setModo("individual")}
          style={{
            padding: "8px 16px",
            background: modo === "individual" ? "#3b82f6" : "#ddd",
            color: modo === "individual" ? "#fff" : "#000",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          👤 Individual
        </button>
        <button
          onClick={() => setModo("comparativa")}
          style={{
            padding: "8px 16px",
            background: modo === "comparativa" ? "#3b82f6" : "#ddd",
            color: modo === "comparativa" ? "#fff" : "#000",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          📊 Comparativa
        </button>
      </div>

      {/* MODO INDIVIDUAL */}
      {modo === "individual" && (
        <div>
          {/* Controles */}
          <div
            style={{
              marginBottom: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                Ejecutivo:
              </label>
              <select
                value={ejecutivoSeleccionado?.id || ""}
                onChange={(e) => {
                  const ej = ejecutivosLista.find((x) => x.id === e.target.value);
                  setEjecutivoSeleccionado(ej);
                }}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              >
                <option value="">-- Selecciona --</option>
                {ejecutivosLista.map((ej) => (
                  <option key={ej.id} value={ej.id}>
                    {ej.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                Período:
              </label>
              <select
                value={periodoTiempo}
                onChange={(e) => setPeriodoTiempo(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              >
                <option value="semanal">Semanal</option>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                Desde:
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                Hasta:
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{
                  padding: 8,
                  borderRadius: 4,
                  border: "1px solid #ddd",
                  width: "100%",
                }}
              />
            </div>

            {metricas && (
              <button
                onClick={() => {
                  setGenerandoPDF(true);
                  generarPDF().finally(() => setGenerandoPDF(false));
                }}
                disabled={generandoPDF}
                style={{
                  padding: 8,
                  background: generandoPDF ? "#ccc" : "#ef4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: generandoPDF ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  alignSelf: "flex-end",
                }}
              >
                {generandoPDF ? "⏳ Generando..." : "📥 PDF"}
              </button>
            )}
          </div>

          {/* KPIs */}
          {metricas && (
            <>
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
                    background: "#dbeafe",
                    border: "2px solid #3b82f6",
                    borderRadius: 8,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#3b82f6" }}>
                    {metricas.ventasTotal}
                  </div>
                  <div style={{ fontSize: "0.85em", color: "#666" }}>Ventas</div>
                </div>

                <div
                  style={{
                    background: "#fef3c7",
                    border: "2px solid #f59e0b",
                    borderRadius: 8,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#f59e0b" }}>
                    {metricas.eventosTotal}
                  </div>
                  <div style={{ fontSize: "0.85em", color: "#666" }}>Eventos</div>
                </div>

                <div
                  style={{
                    background: "#d1fae5",
                    border: "2px solid #10b981",
                    borderRadius: 8,
                    padding: 16,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2em", fontWeight: "bold", color: "#10b981" }}>
                    {metricas.ventasTotal > 0
                      ? (metricas.eventosTotal / metricas.ventasTotal).toFixed(2)
                      : 0}
                  </div>
                  <div style={{ fontSize: "0.85em", color: "#666" }}>Ratio</div>
                </div>
              </div>

              {/* SECCIÓN 1: PROYECCIÓN + BENCHMARKING */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* PROYECCIÓN */}
                {(() => {
                  const proyeccion = calcularProyeccion();
                  if (!proyeccion) return null;
                  return (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e0e7ff",
                        borderRadius: 8,
                        padding: 16,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      <h3 style={{ margin: "0 0 12px 0", color: "#3b82f6" }}>📈 Proyección</h3>
                      <div style={{ fontSize: "0.9em", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>Día actual:</span>
                          <strong>{proyeccion.diaDelMes}/{proyeccion.diasDelMes}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>Ventas hasta hoy:</span>
                          <strong style={{ color: "#3b82f6" }}>{proyeccion.ventasActuales}</strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px",
                            background: "#dbeafe",
                            borderRadius: 4,
                          }}
                        >
                          <span>Proyección para fin de mes:</span>
                          <strong style={{ fontSize: "1.2em", color: "#3b82f6" }}>
                            {proyeccion.ventasProyectadas}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* BENCHMARKING */}
                {(() => {
                  const bench = calcularBenchmarking();
                  if (!bench) return null;
                  return (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e0e7ff",
                        borderRadius: 8,
                        padding: 16,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      <h3 style={{ margin: "0 0 12px 0", color: "#10b981" }}>📊 Benchmarking</h3>
                      <div style={{ fontSize: "0.9em", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>Promedio equipo:</span>
                          <strong>{bench.promedio} ventas</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>Tu desempeño:</span>
                          <strong
                            style={{
                              color: bench.diferenciaPromedio >= 0 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {bench.diferenciaPromedio > 0 ? "+" : ""}
                            {bench.diferenciaPromedio} ({bench.porcentajePromedio}%)
                          </strong>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "8px",
                            background: "#d1fae5",
                            borderRadius: 4,
                          }}
                        >
                          <span>Posición:</span>
                          <strong style={{ fontSize: "1.1em" }}>
                            🏆 {bench.miPosicion}° de {bench.totalEjecutivos}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SECCIÓN 2: MES A MES (MoM) */}
              {(() => {
                const mom = calcularMoM();
                if (!mom) return null;
                return (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 16px 0", color: "#f59e0b" }}>📉 Comparación Mes a Mes</h3>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 16,
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.85em", color: "#666", marginBottom: 8 }}>
                          {mom.mesPasadoNombre}
                        </div>
                        <div style={{ fontSize: "2em", fontWeight: "bold", color: "#9ca3af" }}>
                          {mom.ventasMesPasado}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontSize: "2.5em" }}>→</div>
                      </div>

                      <div>
                        <div style={{ fontSize: "0.85em", color: "#666", marginBottom: 8 }}>
                          {mom.mesActualNombre}
                        </div>
                        <div
                          style={{
                            fontSize: "2em",
                            fontWeight: "bold",
                            color: mom.mejora ? "#10b981" : "#ef4444",
                          }}
                        >
                          {mom.ventasMesActual}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: "12px",
                        background: mom.mejora ? "#d1fae5" : "#fee2e2",
                        borderRadius: 4,
                        textAlign: "center",
                      }}
                    >
                      <strong
                        style={{
                          color: mom.mejora ? "#10b981" : "#ef4444",
                          fontSize: "1.1em",
                        }}
                      >
                        {mom.mejora ? "📈" : "📉"} {mom.mejora ? "+" : ""}
                        {mom.diferencia} ventas ({mom.porcentajeCambio}%)
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* SECCIÓN 3: GAUGE CHART (Meta vs Realidad) */}
              {(() => {
                const bench = calcularBenchmarking();
                if (!bench) return null;
                return (
                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #e0e7ff",
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 24,
                      textAlign: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 16px 0", color: "#3b82f6" }}>⚡ Performance vs Promedio</h3>
                    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
                      <GaugeChart
                        id="gauge-chart-performance"
                        nrOfLevels={30}
                        type="semicircle"
                        percent={calcularGaugeData()}
                        formatTextValue={(value) => `${Math.round(bench.porcentajePromedio)}%`}
                        colors={["#ef4444", "#f59e0b", "#10b981"]}
                        needleColor="#333"
                      />
                    </div>
                    <div style={{ marginTop: 12, fontSize: "0.9em", color: "#666" }}>
                      {bench.porcentajePromedio >= 100
                        ? "✅ Superando el promedio"
                        : "⚠️ Por debajo del promedio"}
                    </div>
                  </div>
                );
              })()}

              {/* Gráficas */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 20,
                  marginBottom: 24,
                }}
              >
                {metricas.periodosOrdenados.length > 0 && (
                  <div style={{ background: "#f6f8fa", padding: 16, borderRadius: 8 }} ref={chartBarRef}>
                    <h3 style={{ marginTop: 0 }}>Ventas por {periodoTiempo}</h3>
                    <Bar
                      data={{
                        labels: metricas.periodosOrdenados,
                        datasets: [
                          {
                            label: "Ventas",
                            data: metricas.periodosOrdenados.map(
                              (p) => metricas.ventasAgrupadas[p].length
                            ),
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

                {metricas.periodosOrdenados.length > 0 && (
                  <div style={{ background: "#f6f8fa", padding: 16, borderRadius: 8 }}>
                    <h3 style={{ marginTop: 0 }}>Tendencia</h3>
                    <Line
                      data={{
                        labels: metricas.periodosOrdenados,
                        datasets: [
                          {
                            label: "Ventas",
                            data: metricas.periodosOrdenados.map(
                              (p) => metricas.ventasAgrupadas[p].length
                            ),
                            borderColor: "#10b981",
                            fill: false,
                            tension: 0.4,
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

                {metricas.ventasPorMarca.length > 0 && (
                  <div style={{ background: "#f6f8fa", padding: 16, borderRadius: 8 }} ref={chartDoughnutRef}>
                    <h3 style={{ marginTop: 0 }}>Marcas Más Vendidas</h3>
                    <Doughnut
                      data={{
                        labels: metricas.ventasPorMarca.map((m) => m.marca),
                        datasets: [
                          {
                            data: metricas.ventasPorMarca.map((m) => m.cantidad),
                            backgroundColor: [
                              "#3b82f6",
                              "#10b981",
                              "#f59e0b",
                              "#ef4444",
                              "#8b5cf6",
                              "#ec4899",
                            ],
                          },
                        ],
                      }}
                      options={{ responsive: true, maintainAspectRatio: true }}
                    />
                  </div>
                )}
              </div>

              {/* Descargar PDF */}
              <div
                style={{
                  background: "#f0f9ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 20,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: 4 }}>
                    📥 Descargar Reporte
                  </label>
                  <span style={{ fontSize: "12px", color: "#666" }}>
                    Ejecutivo: <strong>{ejecutivoSeleccionado?.nombre || "No seleccionado"}</strong>
                  </span>
                </div>
                <button
                  onClick={() => {
                    setGenerandoPDF(true);
                    generarPDF().finally(() => setGenerandoPDF(false));
                  }}
                  disabled={!ejecutivoSeleccionado || generandoPDF}
                  style={{
                    padding: "10px 20px",
                    background: ejecutivoSeleccionado && !generandoPDF ? "#10b981" : "#ccc",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: ejecutivoSeleccionado && !generandoPDF ? "pointer" : "not-allowed",
                    fontWeight: "bold",
                    transition: "all 0.3s",
                  }}
                >
                  {generandoPDF ? "⏳ Generando..." : "📄 Descargar PDF"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODO COMPARATIVA */}
      {modo === "comparativa" && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: "bold" }}>
              Selecciona ejecutivos para comparar:
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {ejecutivosLista.map((ej) => (
                <label key={ej.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={ejecutivosComparar.some((x) => x.id === ej.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setEjecutivosComparar([...ejecutivosComparar, ej]);
                      } else {
                        setEjecutivosComparar(
                          ejecutivosComparar.filter((x) => x.id !== ej.id)
                        );
                      }
                    }}
                  />
                  {ej.nombre}
                </label>
              ))}
            </div>
          </div>

          {comparativa.length > 0 && (
            <>
              <div style={{ background: "#f6f8fa", padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <h3>📊 Comparativa de Ventas (Barras)</h3>
                <Bar
                  data={{
                    labels: comparativa.map((c) => c.nombre),
                    datasets: [
                      {
                        label: "Total de Ventas",
                        data: comparativa.map((c) => c.ventas),
                        backgroundColor: "#3b82f6",
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    scales: { y: { beginAtZero: true } },
                  }}
                />
              </div>

              {/* RADAR CHART - ANÁLISIS MULTIDIMENSIONAL */}
              {(() => {
                const radarData = calcularRadarData();
                if (!radarData || radarData.length === 0) return null;

                return (
                  <div style={{ background: "#fff", border: "1px solid #e0e7ff", borderRadius: 8, padding: 16, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                    <h3 style={{ marginTop: 0, color: "#10b981" }}>🎯 Análisis Multidimensional (Radar)</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                      {radarData.map((ejecutivo, idx) => (
                        <div key={idx} style={{ textAlign: "center" }}>
                          <p style={{ fontWeight: "bold", marginBottom: 12, color: "#333" }}>
                            {ejecutivo.nombre}
                          </p>
                          <Radar
                            data={{
                              labels: ["Ventas", "Eventos", "Conversión %", "Marcas"],
                              datasets: [
                                {
                                  label: ejecutivo.nombre,
                                  data: [
                                    ejecutivo["Ventas"],
                                    ejecutivo["Eventos"],
                                    ejecutivo["Conversión %"],
                                    ejecutivo["Marcas"],
                                  ],
                                  borderColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][idx % 4],
                                  backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][idx % 4]
                                    .replace(")", ", 0.1)")
                                    .replace("rgb", "rgba"),
                                  pointBackgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"][idx % 4],
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              scales: {
                                r: {
                                  min: 0,
                                  max: 100,
                                  beginAtZero: true,
                                },
                              },
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 16, padding: 12, background: "#f0f9ff", borderRadius: 4, fontSize: "0.9em", color: "#333" }}>
                      <strong>📌 Interpretación:</strong> Cada dimensión (Ventas, Eventos, Conversión, Marcas) está normalizada a 0-100.
                      Un polígono más grande = mejor performance en múltiples áreas.
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

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
            <h2 style={{ margin: "0 0 20px 0", color: "#1f2937" }}>
              Contenido ampliado
            </h2>
            <p style={{ color: "#6b7280" }}>
              Aquí se mostrará el contenido ampliado del gráfico.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
