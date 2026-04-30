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
    },
    {
        type: "function" as const,
        function: {
            name: "save_user_preference",
            description: "Guarda o actualiza información clave sobre el usuario (profesión, estudios, gustos, contexto personal). Esta información se mantendrá a largo plazo y ayudará a personalizar tus respuestas.",
            parameters: {
                type: "object",
                properties: {
                    profile_summary: { 
                        type: "string", 
                        description: "Un resumen completo de todo lo que sabes del usuario hasta ahora. Si ya sabías cosas de antes, incorpóralas a este nuevo resumen." 
                    }
                },
                required: ["profile_summary"]
            }
        }
    }
];

export async function handleMemoryTool(userId: number, name: string, args: any): Promise<string> {
    if (name === 'clear_conversation_history' && args.confirm) {
        memory.clearHistory(userId);
        return "🧹 Historial de conversación borrado correctamente.";
    }
    
    if (name === 'save_user_preference' && args.profile_summary) {
        memory.updateProfile(userId, args.profile_summary);
        return "🧠 Perfil de usuario guardado y actualizado con éxito en la memoria a largo plazo.";
    }

    return "Operación de memoria no válida o no confirmada.";
}
