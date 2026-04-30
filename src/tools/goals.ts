import Database from 'better-sqlite3';
import { env } from '../config/env.js';

const db = new Database(env.DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        status TEXT DEFAULT 'En Progreso',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

export const goalsTools = [
    {
        type: "function" as const,
        function: {
            name: "manage_goals",
            description: "Gestiona las metas y objetivos a largo plazo del usuario.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["create", "list", "update_progress"],
                        description: "La acción a realizar." 
                    },
                    title: { type: "string", description: "El título de la meta (requerido para create)." },
                    goal_id: { type: "number", description: "ID de la meta (requerido para update_progress)." },
                    progress: { type: "number", description: "Porcentaje de progreso (0-100) (requerido para update_progress)." }
                },
                required: ["action"]
            }
        }
    }
];

export async function handleGoals(userId: number, args: any): Promise<any> {
    const { action, title, goal_id, progress } = args;

    if (action === 'create') {
        if (!title) return "Error: Se requiere 'title' para crear una meta.";
        const stmt = db.prepare('INSERT INTO goals (user_id, title) VALUES (?, ?)');
        const info = stmt.run(userId, title);
        return `🎯 Meta creada con ID ${info.lastInsertRowid}: "${title}"`;
    }

    if (action === 'list') {
        const stmt = db.prepare('SELECT * FROM goals WHERE user_id = ? AND status = ?');
        const goals = stmt.all(userId, 'En Progreso');
        if (goals.length === 0) return "No tienes metas activas en este momento.";
        return goals;
    }

    if (action === 'update_progress') {
        if (!goal_id || progress === undefined) return "Error: Se requiere 'goal_id' y 'progress'.";
        let status = 'En Progreso';
        if (progress >= 100) status = 'Completada';
        
        const stmt = db.prepare('UPDATE goals SET progress = ?, status = ? WHERE id = ? AND user_id = ?');
        const info = stmt.run(progress, status, goal_id, userId);
        if (info.changes === 0) return `No se encontró la meta con ID ${goal_id}.`;
        return `📈 Meta ${goal_id} actualizada al ${progress}%. Estado: ${status}.`;
    }

    return "Acción no reconocida.";
}
