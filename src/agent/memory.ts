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
    );

    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        remind_at DATETIME NOT NULL,
        is_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER PRIMARY KEY,
        profile_text TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
    if (!firestore) return; // Si firestore es null, no hacemos nada y la app no se crashea
    
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

        // También limpiar en Firestore si la nube está encendida
        if (firestore) {
            firestore
                .collection(CONVERSATIONS_COLLECTION)
                .doc(String(userId))
                .collection('messages')
                .get()
                .then((snapshot: any) => {
                    const batch = firestore.batch();
                    snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
                    return batch.commit();
                })
                .catch((err: any) => console.error('⚠️ Error limpiando Firestore:', err));
        }
    },

    // ─── RECORDATORIOS (NUEVO) ───
    addReminder: (userId: number, text: string, remindAtStr: string) => {
        const stmt = db.prepare('INSERT INTO reminders (user_id, text, remind_at) VALUES (?, ?, ?)');
        return stmt.run(userId, text, remindAtStr).lastInsertRowid;
    },

    getPendingReminders: () => {
        const stmt = db.prepare(`
            SELECT * FROM reminders 
            WHERE is_sent = 0 AND remind_at <= datetime('now')
        `);
        return stmt.all() as any[];
    },

    markReminderAsSent: (id: number) => {
        const stmt = db.prepare('UPDATE reminders SET is_sent = 1 WHERE id = ?');
        stmt.run(id);
    },

    // ─── PERFIL DEL USUARIO (NUEVO) ───
    getProfile: (userId: number): string | null => {
        const stmt = db.prepare('SELECT profile_text FROM user_profiles WHERE user_id = ?');
        const row = stmt.get(userId) as any;
        return row ? row.profile_text : null;
    },

    updateProfile: (userId: number, profileText: string) => {
        const stmt = db.prepare(`
            INSERT INTO user_profiles (user_id, profile_text, updated_at) 
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET 
                profile_text = excluded.profile_text,
                updated_at = datetime('now')
        `);
        stmt.run(userId, profileText);
    }
};
