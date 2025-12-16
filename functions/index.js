const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();



const { listUsers } = require('./listUsers');
const { createEjecutivo } = require('./createEjecutivoFunction');
const { deleteEjecutivo } = require('./deleteEjecutivoFunction');
const { updateEjecutivo } = require('./updateEjecutivoFunction');
const { listEjecutivos } = require('./listEjecutivosFunction');
const { changeEstadoEjecutivo } = require('./changeEstadoEjecutivoFunction');

exports.listUsers = functions.https.onRequest(listUsers);
exports.createEjecutivo = functions.https.onRequest(createEjecutivo);
exports.deleteEjecutivo = functions.https.onRequest(deleteEjecutivo);
exports.updateEjecutivo = functions.https.onRequest(updateEjecutivo);
exports.listEjecutivos = functions.https.onRequest(listEjecutivos);
exports.changeEstadoEjecutivo = functions.https.onRequest(changeEstadoEjecutivo);
