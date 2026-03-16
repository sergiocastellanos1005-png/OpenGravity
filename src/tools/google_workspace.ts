import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function executeGogCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await execPromise(`gog ${command}`);
        if (stderr && !stdout) return `Error: ${stderr}`;
        return stdout || 'Operación completada sin salida.';
    } catch (error: any) {
        return `Error ejecutando gog: ${error.message}`;
    }
}

export const googleWorkspaceTools = [
    {
        type: "function" as const,
        function: {
            name: "gmail_search",
            description: "Buscar correos en Gmail usando sintaxis de búsqueda de Google.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Ej: 'newer_than:7d' o 'from:ryanair.com'" },
                    max: { type: "number", default: 10 }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "gmail_send",
            description: "Enviar un correo electrónico.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "Email del destinatario" },
                    subject: { type: "string", description: "Asunto del correo" },
                    body: { type: "string", description: "Contenido del correo" }
                },
                required: ["to", "subject", "body"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "calendar_list_events",
            description: "Listar eventos del calendario.",
            parameters: {
                type: "object",
                properties: {
                    calendarId: { type: "string", default: "primary", description: "ID del calendario (por defecto 'primary')" },
                    from: { type: "string", description: "Fecha inicio ISO (YYYY-MM-DD)" },
                    to: { type: "string", description: "Fecha fin ISO (YYYY-MM-DD)" }
                },
                required: ["from", "to"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "calendar_create_event",
            description: "Crear un evento en el calendario.",
            parameters: {
                type: "object",
                properties: {
                    calendarId: { type: "string", default: "primary" },
                    summary: { type: "string", description: "Título del evento" },
                    from: { type: "string", description: "Inicio ISO fecha/hora" },
                    to: { type: "string", description: "Fin ISO fecha/hora" }
                },
                required: ["summary", "from", "to"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "drive_search",
            description: "Buscar archivos en Google Drive.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Término de búsqueda" },
                    max: { type: "number", default: 10 }
                },
                required: ["query"]
            }
        }
    }
];

export async function handleWorkspaceTool(name: string, args: any): Promise<string> {
    switch (name) {
        case 'gmail_search':
            return await executeGogCommand(`gmail search "${args.query}" --max ${args.max || 10} --json`);
        case 'gmail_send':
            return await executeGogCommand(`gmail send --to "${args.to}" --subject "${args.subject}" --body "${args.body}"`);
        case 'calendar_list_events':
            return await executeGogCommand(`calendar events ${args.calendarId || 'primary'} --from "${args.from}" --to "${args.to}" --json`);
        case 'calendar_create_event':
            return await executeGogCommand(`calendar create ${args.calendarId || 'primary'} --summary "${args.summary}" --from "${args.from}" --to "${args.to}"`);
        case 'drive_search':
            return await executeGogCommand(`drive search "${args.query}" --max ${args.max || 10} --json`);
        default:
            throw new Error(`Workspace tool not implemented: ${name}`);
    }
}
