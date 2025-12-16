const admin = require("firebase-admin");
const serviceAccount = require("./src/kolbimonitorsells-infinix-firebase-adminsdk-fbsvc-f59ba2b3f9.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addEvent() {
  await db.collection("marketing_events").add({
    title: "Evento de prueba",
    description: "Descripción de ejemplo",
    date: new Date(),
    createdBy: "supervisor@ejemplo.com"
  });
  console.log("Evento agregado correctamente");
  process.exit(0);
}

addEvent().catch(e => {
  console.error(e);
  process.exit(1);
});
