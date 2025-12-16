// Cloud Function para listar todos los usuarios autenticados de Firebase
const admin = require('firebase-admin');
admin.initializeApp();

exports.listUsers = async (req, res) => {
  try {
    const maxResults = 1000; // máximo permitido por Firebase
    const listUsersResult = await admin.auth().listUsers(maxResults);
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      disabled: userRecord.disabled,
      metadata: userRecord.metadata,
      providerData: userRecord.providerData
    }));
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Para usar esta función, expórtala en tu index.js de Cloud Functions:
// exports.listUsers = require('./listUsers').listUsers;
