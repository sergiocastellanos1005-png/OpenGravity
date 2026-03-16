import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json';

export let firestore: any = null;

if (existsSync(serviceAccountPath)) {
    try {
        const raw = readFileSync(serviceAccountPath, 'utf-8');
        const serviceAccount = JSON.parse(raw) as ServiceAccount;
        
        const app = initializeApp({
            credential: cert(serviceAccount),
        });
        
        firestore = getFirestore(app);
        console.log('🔥 Firebase inicializado correctamente.');
    } catch (error) {
        console.error(`⚠️ No se pudo cargar Firebase, operando solo en modo local (SQLite).`);
    }
} else {
    console.warn('⚠️ Archivo de credenciales de Google no encontrado. Firebase desactivado, usando solo memoria local.');
}
