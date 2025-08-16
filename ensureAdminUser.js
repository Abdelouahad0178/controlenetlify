// ensureAdminUser.js  (ESM, Node 18+)
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(await fs.readFile(path.join(__dirname, 'serviceAccountKey.json'), 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = getFirestore();

const email = process.env.ADMIN_EMAIL ?? 'admin@anapharmo.com';
const password = process.env.ADMIN_PASS ?? 'ChangeMoi#2025!';
const displayName = 'Admin Anapharmo';
const societe = 'Anapharmo';

console.log('🔧 Projet service account =', sa.project_id);

try {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, {
      password,
      emailVerified: true,
      disabled: false,
      displayName
    });
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      user = await admin.auth().createUser({
        email, password, emailVerified: true, disabled: false, displayName
      });
    } else {
      throw e;
    }
  }

  await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });

  await db.collection('users').doc(user.uid).set({
    email,
    displayName,
    role: 'admin',
    societe,
    disabled: false,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('✅ Admin prêt :', user.uid);
} catch (err) {
  console.error('❌', err);
  process.exitCode = 1;
}
