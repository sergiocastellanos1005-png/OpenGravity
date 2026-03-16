import { memory } from '../agent/memory.js';

export const memoryTools = [
    {
        type: "function" as const,
        function: {
            name: "clear_conversation_history",
            description: "Borra todo el historial de la conversación actual. Úsalo si el agente se confunde o para empezar de cero.",
            parameters: {
                type: "object",
                properties: {
                    confirm: { type: "boolean", description: "Confirmación del borrado" }
                },
                required: ["confirm"]
            }
        }
    }
];

export async function handleMemoryTool(userId: number, name: string, args: any): Promise<string> {
    if (name === 'clear_conversation_history' && args.confirm) {
        memory.clearHistory(userId);
        return "🧹 Historial de conversación borrado correctamente.";
    }
    return "Borrado cancelado o no confirmado.";
}
