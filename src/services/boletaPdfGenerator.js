import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generarBoletaPDF = (solicitud, ejecutivo = {}) => {
  const doc = new jsPDF();
  
  // Configuración de colores
  const colorPrimario = [0, 150, 136]; // Verde Kolbi
  const colorTexto = [33, 33, 33];
  
  // Encabezado
  doc.setFillColor(...colorPrimario);
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTITUTO COSTARRICENSE DE ELECTRICIDAD', 105, 12, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Kölbi', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CONTROL DE SALIDA DE MATERIALES Y DOCUMENTACIÓN', 105, 28, { align: 'center' });
  
  // Fecha y Dependencia
  doc.setTextColor(...colorTexto);
  doc.setFontSize(9);
  const fechaActual = new Date().toLocaleDateString('es-CR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
  doc.text(`FECHA: ${fechaActual}`, 150, 42);
  doc.text('DEPENDENCIA:', 150, 47);
  doc.setFontSize(8);
  doc.text('REGION COMERCIAL METROPOLITANA ESTE', 150, 52);
  
  // Datos del ejecutivo
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOMBRE DEL EJECUTIVO:', 14, 42);
  doc.setFont('helvetica', 'normal');
  doc.text((ejecutivo.nombre || solicitud.ejecutivoNombre || solicitud.ejecutivo || '-').toUpperCase(), 14, 47);
  
  doc.setFont('helvetica', 'bold');
  doc.text('TELÉFONO:', 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.text('2000 1758', 35, 52);
  
  doc.setFont('helvetica', 'bold');
  doc.text('TORRE TELECOMUNICACIONES-EJECUTIVOS SAN JOSÉ', 14, 57);
  
  // Línea separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 60, 196, 60);
  
  // Datos de la empresa y terminal
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DE LA EMPRESA Y TERMINAL', 105, 68, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  let yPos = 75;
  doc.setFont('helvetica', 'bold');
  doc.text('NOMBRE DE LA EMPRESA / CLIENTE:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text((solicitud.cliente || '-').toUpperCase(), 14, yPos + 5);
  
  yPos += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('CÉDULA:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(solicitud.cedulaCliente || '-', 35, yPos);
  
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('NÚMERO DE REFERENCIA:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(solicitud.pedido || '-', 60, yPos);
  
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  const direccion = solicitud.direccion || 'SAN JOSÉ, CURRIDABAT';
  const maxWidth = 180;
  const direccionLineas = doc.splitTextToSize(direccion.toUpperCase(), maxWidth);
  doc.text(direccionLineas, 14, yPos + 5);
  
  yPos += (direccionLineas.length * 5) + 5;
  
  // Tabla de dispositivos
  const imeis = Array.isArray(solicitud.imeis) ? solicitud.imeis : (solicitud.imei ? [solicitud.imei] : []);
  
  const tableData = imeis.map(imei => {
    // Buscar información del IMEI si está disponible
    const info = solicitud.detalles?.find(d => d.imei === imei) || {};
    return [
      info.marca || solicitud.marca || 'HONOR',
      imei || '-',
      solicitud.pedido || '-',
      solicitud.cedulaCliente || '-'
    ];
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [['MODELO', 'IMEI', 'PEDIDO', 'CÉDULA CLIENTE']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: colorPrimario,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: colorTexto
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50 },
      2: { cellWidth: 45 },
      3: { cellWidth: 45 }
    },
    margin: { left: 14, right: 14 }
  });
  
  yPos = doc.lastAutoTable.finalY + 10;
  
  // Boleta
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BOLETA:', 14, yPos);
  
  yPos += 7;
  doc.setFontSize(9);
  doc.text('OBSERVACIONES GENERALES:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  const observaciones = solicitud.observaciones || 'ENTREGAR CLIENTE YA FIRMO FMD';
  doc.text(observaciones.toUpperCase(), 14, yPos + 5);
  
  yPos += 15;
  
  // Línea de firma del cliente
  doc.setDrawColor(0, 0, 0);
  doc.line(14, yPos + 20, 100, yPos + 20);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('FIRMA DEL CLIENTE:', 14, yPos + 25);
  
  // Recuadro amarillo de advertencia
  doc.setFillColor(255, 255, 200);
  doc.rect(120, yPos + 10, 76, 15, 'F');
  doc.setDrawColor(255, 200, 0);
  doc.rect(120, yPos + 10, 76, 15);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(200, 0, 0);
  doc.text('FAVOR REVISAR QUE EL TELÉFONO QUE SE LE ESTÁ ENTREGANDO', 122, yPos + 14);
  doc.text('ES EL SOLICITADO', 122, yPos + 18);
  
  // Pie de página
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado: ${new Date().toLocaleString('es-CR')}`, 105, 285, { align: 'center' });
  doc.text(`Pedido: ${solicitud.pedido || '-'} | Estado: ${solicitud.estado || '-'}`, 105, 290, { align: 'center' });
  
  // Guardar PDF
  const nombreArchivo = `Boleta_${solicitud.pedido || 'solicitud'}_${Date.now()}.pdf`;
  doc.save(nombreArchivo);
  
  return nombreArchivo;
};
