const admin = require('firebase-admin');

// Cambiar estado de ejecutivo (activar/desactivar)
async function changeEstadoEjecutivo(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }
  const { uid, estado } = req.body;
  if (!uid || !estado) {
    return res.status(400).send('Faltan datos');
  }
  try {
    await admin.auth().updateUser(uid, { disabled: estado === 'inactivo' });
    await admin.firestore().collection('usuarios').doc(uid).update({ estado });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error cambiando estado:', err);
    return res.status(500).send('Error cambiando estado: ' + err.message);
  }
}

module.exports = { changeEstadoEjecutivo };