import Database from 'better-sqlite3';
import { env } from '../config/env.js';

const db = new Database(env.DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        schedule_time TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

export const routineTools = [
    {
        type: "function" as const,
        function: {
            name: "manage_routines",
            description: "Gestiona las rutinas diarias del usuario (bloques de tiempo o hábitos).",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["create", "list", "delete"],
                        description: "La acción a realizar." 
                    },
                    name: { type: "string", description: "El nombre de la rutina (ej. 'Estudio Profundo'). Requerido para create." },
                    schedule_time: { type: "string", description: "Horario o periodo (ej. 'Lunes a Viernes 09:00 - 11:00'). Requerido para create." },
                    routine_id: { type: "number", description: "ID de la rutina (requerido para delete)." }
                },
                required: ["action"]
            }
        }
    }
];

export async function handleRoutines(userId: number, args: any): Promise<any> {
    const { action, name, schedule_time, routine_id } = args;

    if (action === 'create') {
        if (!name || !schedule_time) return "Error: Se requiere 'name' y 'schedule_time'.";
        const stmt = db.prepare('INSERT INTO routines (user_id, name, schedule_time) VALUES (?, ?, ?)');
        const info = stmt.run(userId, name, schedule_time);
        return `⏰ Rutina creada con ID ${info.lastInsertRowid}: "${name}" (${schedule_time})`;
    }

    if (action === 'list') {
        const stmt = db.prepare('SELECT * FROM routines WHERE user_id = ? AND is_active = 1');
        const routines = stmt.all(userId);
        if (routines.length === 0) return "No tienes rutinas configuradas.";
        return routines;
    }

    if (action === 'delete') {
        if (!routine_id) return "Error: Se requiere 'routine_id'.";
        const stmt = db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?');
        const info = stmt.run(routine_id, userId);
        if (info.changes === 0) return `No se encontró la rutina con ID ${routine_id}.`;
        return `🗑️ Rutina ${routine_id} eliminada.`;
    }

    return "Acción no reconocida.";
}
