import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { env } from './env.js';

// Cargar credenciales desde el archivo service-account.json
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';

let serviceAccount: ServiceAccount;
try {
    const raw = readFileSync(serviceAccountPath, 'utf-8');
    serviceAccount = JSON.parse(raw) as ServiceAccount;
} catch (error) {
    console.error(`❌ No se pudo leer el archivo de credenciales de Firebase en: ${serviceAccountPath}`);
    console.error('   Asegúrate de descargar la clave privada desde la consola de Firebase.');
    process.exit(1);
}

const app = initializeApp({
    credential: cert(serviceAccount),
});

export const firestore = getFirestore(app);

console.log('🔥 Firebase inicializado correctamente.');
