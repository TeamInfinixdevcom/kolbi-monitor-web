const admin = require('firebase-admin');

// Actualizar datos de ejecutivo en Firestore y Auth
async function updateEjecutivo(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }
  const { uid, nombre, correo, departamento, usuario_red, cedula, estado } = req.body;
  if (!uid) {
    return res.status(400).send('Falta el UID del ejecutivo');
  }
  try {
    // Actualizar en Auth
    if (correo || nombre || estado) {
      await admin.auth().updateUser(uid, {
        email: correo,
        displayName: nombre,
        disabled: estado === 'inactivo',
      });
    }
    // Actualizar en Firestore
    await admin.firestore().collection('usuarios').doc(uid).update({
      nombre,
      correo,
      departamento,
      usuario_red,
      cedula,
      estado: estado || 'activo',
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error actualizando ejecutivo:', err);
    return res.status(500).send('Error actualizando ejecutivo: ' + err.message);
  }
}

module.exports = { updateEjecutivo };