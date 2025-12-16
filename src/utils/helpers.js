// Función robusta para detectar tipo de dispositivo (accesorio/teléfono)
export function detectarTipo(item = {}) {
  const marca = (item.marca || "").toLowerCase();
  const term = (item.terminal || "").toLowerCase();
  const serie = item.serie || "";
  // Palabras clave para accesorios (igual que EjecutivoDashboard)
  const keywords = [
    "cargador", "cable", "charger", "accesorio", "buds", "cubos", "watch", "audifono", "audífono", "auricular", "band", "tablet", "case", "funda", "powerbank", "bateria", "estuche", "adaptador", "manos libres", "usb", "protector", "soporte", "dock", "bocina", "speaker", "parlante", "kit", "combo"
  ];
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
