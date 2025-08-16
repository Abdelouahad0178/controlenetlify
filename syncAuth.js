// syncAuth.js  (ESM) — synchronise Firestore.users <-> Firebase Auth
// - Met à jour disabled (Auth) selon users/{uid}.disabled
// - Met à jour les custom claims { role } selon users/{uid}.role
// Usage:
//   node syncAuth.js          # synchronisation one-shot
//   node syncAuth.js --watch  # écoute en continu les changements Firestore
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(await fs.readFile(path.join(__dirname, 'serviceAccountKey.json'), 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = getFirestore();

async function syncDoc(uid, data) {
  if (!uid) return;
  const disabled = !!data.disabled;
  const role = data.role || 'user';

  try {
    // update disabled in Auth
    await admin.auth().updateUser(uid, { disabled });

    // update custom claims
    const claims = { role };
    await admin.auth().setCustomUserClaims(uid, claims);

    console.log(`✅ Sync → uid=${uid} disabled=${disabled} role=${role}`);
  } catch (e) {
    if (e.code === 'auth/user-not-found' && data.email) {
      // try to find by email (edge case)
      try {
        const u = await admin.auth().getUserByEmail(data.email);
        await admin.auth().updateUser(u.uid, { disabled });
        await admin.auth().setCustomUserClaims(u.uid, { role });
        if (u.uid !== uid) {
          console.warn(`⚠️ Doc id (${uid}) ≠ Auth uid (${u.uid}). Pense à réaligner le doc Firestore.`);
        }
        console.log(`✅ Sync par email → uid=${u.uid} disabled=${disabled} role=${role}`);
        return;
      } catch {}
    }
    console.error(`❌ Sync uid=${uid}:`, e.message);
  }
}

async function oneShot() {
  const snap = await db.collection('users').get();
  console.log(`🔎 ${snap.size} utilisateurs trouvés`);
  for (const doc of snap.docs) {
    await syncDoc(doc.id, doc.data());
  }
}

async function watch() {
  console.log('👂 Watch users/ (Ctrl+C pour quitter)');
  return db.collection('users').onSnapshot(async (snap) => {
    for (const change of snap.docChanges()) {
      const { type, doc } = change;
      if (type === 'added' || type === 'modified') {
        await syncDoc(doc.id, doc.data());
      }
    }
  }, (err)=>{
    console.error('❌ Watch error:', err);
  });
}

const isWatch = process.argv.includes('--watch');
if (isWatch) {
  await watch();
} else {
  await oneShot();
}
