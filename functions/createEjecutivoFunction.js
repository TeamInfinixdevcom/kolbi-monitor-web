    const admin = require('firebase-admin');

    // Cloud Function handler for creating an executive in Auth and Firestore
    async function createEjecutivo(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Método no permitido');
    }
    const { nombre, correo, departamento, usuario_red, cedula, estado } = req.body;
    if (!nombre || !correo || !departamento || !usuario_red || !cedula) {
        return res.status(400).send('Faltan campos obligatorios');
    }
    try {
        // Crear usuario en Firebase Auth
        const userRecord = await admin.auth().createUser({
        email: correo,
        password: 'Kolbi200',
        displayName: nombre,
        disabled: estado === 'inactivo',
        });
        // Guardar en Firestore
        await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
        nombre,
        correo,
        departamento,
        usuario_red,
        cedula,
        estado: estado || 'activo',
        rol: 'ejecutivo',
        uid: userRecord.uid,
        creadoEn: new Date().toISOString(),
        });
        return res.status(200).json({ success: true, uid: userRecord.uid });
    } catch (err) {
        console.error('Error creando ejecutivo:', err);
        return res.status(500).send('Error creando ejecutivo: ' + err.message);
    }
    }

    module.exports = { createEjecutivo };