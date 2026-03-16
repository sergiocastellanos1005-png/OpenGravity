import Database from 'better-sqlite3';
import { env } from '../config/env.js';
import { firestore } from '../config/firebase.js';

// ─── SQLite local (caché rápido) ───
const db = new Database(env.DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

export interface Message {
    id?: number;
    user_id: number;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    created_at?: string;
}

// ─── Firestore (nube) ───
const CONVERSATIONS_COLLECTION = 'conversations';

async function syncToFirestore(userId: number, role: Message['role'], content: string) {
    try {
        const docRef = firestore
            .collection(CONVERSATIONS_COLLECTION)
            .doc(String(userId))
            .collection('messages');

        await docRef.add({
            role,
            content,
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('⚠️  Error sincronizando mensaje a Firestore (continuando en local):', error);
        // No bloqueamos la ejecución si Firestore falla — SQLite sigue funcionando
    }
}

// ─── API pública de memoria ───
export const memory = {
    addMessage: (userId: number, role: Message['role'], content: string) => {
        // 1. Guardar en SQLite (local, rápido, sincrónico)
        const stmt = db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)');
        const result = stmt.run(userId, role, content);

        // 2. Sincronizar a Firestore en background (no bloquea)
        syncToFirestore(userId, role, content);

        return result.lastInsertRowid;
    },

    getHistory: (userId: number, limit: number = 20): Message[] => {
        const stmt = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY id DESC LIMIT ?');
        const rows = stmt.all(userId, limit) as Message[];
        return rows.reverse();
    },

    clearHistory: (userId: number) => {
        const stmt = db.prepare('DELETE FROM messages WHERE user_id = ?');
        stmt.run(userId);

        // También limpiar en Firestore
        firestore
            .collection(CONVERSATIONS_COLLECTION)
            .doc(String(userId))
            .collection('messages')
            .get()
            .then(snapshot => {
                const batch = firestore.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                return batch.commit();
            })
            .catch(err => console.error('⚠️  Error limpiando Firestore:', err));
    }
};
