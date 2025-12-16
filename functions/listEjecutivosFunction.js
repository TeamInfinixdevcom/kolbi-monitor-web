const admin = require('firebase-admin');

// Listar ejecutivos desde Firestore
async function listEjecutivos(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Método no permitido');
  }
  try {
    const snapshot = await admin.firestore().collection('usuarios').where('rol', '==', 'ejecutivo').get();
    const ejecutivos = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    return res.status(200).json({ ejecutivos });
  } catch (err) {
    console.error('Error listando ejecutivos:', err);
    return res.status(500).send('Error listando ejecutivos: ' + err.message);
  }
}

module.exports = { listEjecutivos };