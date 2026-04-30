import Database from 'better-sqlite3';
import { env } from '../config/env.js';

const db = new Database(env.DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        priority TEXT DEFAULT 'Media',
        status TEXT DEFAULT 'Pendiente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

export const tasksTools = [
    {
        type: "function" as const,
        function: {
            name: "manage_tasks",
            description: "Gestiona las tareas del usuario (crear, listar, completar, eliminar).",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["create", "list", "complete", "delete"],
                        description: "La acción a realizar." 
                    },
                    title: { type: "string", description: "El título o descripción de la tarea (requerido para create)." },
                    priority: { type: "string", enum: ["Alta", "Media", "Baja"], description: "Prioridad de la tarea (para create)." },
                    task_id: { type: "number", description: "ID de la tarea (requerido para complete y delete)." }
                },
                required: ["action"]
            }
        }
    }
];

export async function handleTasks(userId: number, args: any): Promise<any> {
    const { action, title, priority, task_id } = args;

    if (action === 'create') {
        if (!title) return "Error: Se requiere 'title' para crear una tarea.";
        const p = priority || 'Media';
        const stmt = db.prepare('INSERT INTO tasks (user_id, title, priority) VALUES (?, ?, ?)');
        const info = stmt.run(userId, title, p);
        return `✅ Tarea creada con ID ${info.lastInsertRowid}: "${title}" (Prioridad: ${p})`;
    }

    if (action === 'list') {
        const stmt = db.prepare('SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY priority ASC, id DESC');
        const tasks = stmt.all(userId, 'Pendiente');
        if (tasks.length === 0) return "No tienes tareas pendientes. ¡Todo al día!";
        return tasks;
    }

    if (action === 'complete') {
        if (!task_id) return "Error: Se requiere 'task_id' para completar una tarea.";
        const stmt = db.prepare('UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?');
        const info = stmt.run('Completada', task_id, userId);
        if (info.changes === 0) return `No se encontró la tarea con ID ${task_id} o ya estaba completada.`;
        return `✅ Tarea ${task_id} marcada como completada.`;
    }

    if (action === 'delete') {
        if (!task_id) return "Error: Se requiere 'task_id' para eliminar una tarea.";
        const stmt = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?');
        const info = stmt.run(task_id, userId);
        if (info.changes === 0) return `No se encontró la tarea con ID ${task_id}.`;
        return `🗑️ Tarea ${task_id} eliminada.`;
    }

    return "Acción no reconocida.";
}
