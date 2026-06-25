import admin from "firebase-admin";
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

async function run() {
  try {
    const user = await admin.auth().getUserByEmail('asnahonron@gmail.com');
    console.log("User:", user.uid);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}
run();
