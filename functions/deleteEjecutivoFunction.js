const admin = require('firebase-admin');

// Eliminar ejecutivo de Auth y Firestore
async function deleteEjecutivo(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).send('Falta el UID del ejecutivo');
  }
  try {
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection('usuarios').doc(uid).delete();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error eliminando ejecutivo:', err);
    return res.status(500).send('Error eliminando ejecutivo: ' + err.message);
  }
}

module.exports = { deleteEjecutivo };