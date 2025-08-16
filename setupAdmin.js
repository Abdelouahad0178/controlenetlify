// setupAdmin.js (ESM) — définit un rôle précis pour un utilisateur par email
// Usage: node setupAdmin.js <email> <role>
import admin from 'firebase-admin';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(await fs.readFile(path.join(__dirname, 'serviceAccountKey.json'), 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(sa) });

const email = process.argv[2];
const role = process.argv[3] || 'user';

if (!email) {
  console.error('Usage: node setupAdmin.js <email> <role>');
  process.exit(1);
}

try {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role });
  console.log(`✅ ${email} → claims.role=${role}`);
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
}
