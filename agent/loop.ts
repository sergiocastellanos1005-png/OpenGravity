import { memory, Message } from './memory.js';
import { chatCompletion } from './llm.js';
import { executeTool } from '../tools/index.js';
import { getSystemPrompt } from './system.js';

const MAX_ITERATIONS = 30;
const userLocks = new Set<number>();

function parseMessageForLLM(msg: Message) {
    if (msg.role === 'assistant' || msg.role === 'tool') {
        try {
            const parsed = JSON.parse(msg.content);
            if (msg.role === 'assistant' && parsed.tool_calls) {
                return { role: 'assistant', content: null, tool_calls: parsed.tool_calls };
            }
            if (msg.role === 'tool' && parsed.tool_call_id) {
                return { role: 'tool', content: parsed.content, name: parsed.name, tool_call_id: parsed.tool_call_id };
            }
        } catch (e) {}
    }
    
    // VISIÓN: Si el mensaje de usuario contiene una URL de imagen especial
    if (msg.role === 'user' && msg.content.includes('[IMAGEN_URL:')) {
        const urlMatch = msg.content.match(/\[IMAGEN_URL:(.*?)\]/);
        const url = urlMatch ? urlMatch[1] : null;
        const cleanContent = msg.content.replace(/\[IMAGEN_URL:.*?\]/, "").trim();
        
        if (url) {
            return {
                role: 'user',
                content: [
                    { type: 'text', text: cleanContent || "Analiza esta imagen." },
                    { type: 'image_url', image_url: { url: url } }
                ]
            };
        }
    }

    if (msg.role === 'tool') return null;
    return { role: msg.role, content: msg.content };
}

export async function processUserMessage(userId: number, text: string): Promise<string> {
    if (userLocks.has(userId)) {
        return "Todavía estoy procesando tu mensaje anterior. Por favor, dame un momento.";
    }
    
    userLocks.add(userId);
    try {
        memory.addMessage(userId, 'user', text);

        let iterations = 0;
        const usedTools = new Set<string>();
        
        while (iterations < MAX_ITERATIONS) {
            iterations++;

            const history = memory.getHistory(userId, 15); // Aumentamos a 15 mensajes para mejor contexto
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            
            const userProfile = memory.getProfile(userId);
            const systemPrompt = getSystemPrompt(userProfile || undefined);
            
            const messages: any[] = [
                { role: 'system', content: `${systemPrompt}\n\nFECHA Y HORA ACTUAL: ${dateStr}` },
                ...history.map(parseMessageForLLM).filter(Boolean)
            ];

            try {
                const responseMessage = await chatCompletion(messages) as any;

                if (!responseMessage) {
                    return "Lo siento, la IA no me devolvió una respuesta válida.";
                }

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    const toolNames = responseMessage.tool_calls.map((tc: any) => tc.function.name);
                    for (const name of toolNames) {
                        const count = [...usedTools].filter(t => t === name).length;
                        if (count >= 5) { // Un poco más de margen
                            return "He intentado resolver esto varias veces sin éxito. Por favor, intenta preguntar de otra forma.";
                        }
                        usedTools.add(name);
                    }

                    memory.addMessage(userId, 'assistant', JSON.stringify({
                        tool_calls: responseMessage.tool_calls
                    }));

                    for (const toolCall of responseMessage.tool_calls) {
                        const tc = toolCall as any;
                        const functionName = tc.function.name;
                        let functionArgs = {};
                        try {
                            functionArgs = JSON.parse(tc.function.arguments || '{}');
                        } catch (e) {
                            const cleaned = (tc.function.arguments || '{}').replace(/\n/g, '\\n');
                            try {
                                functionArgs = JSON.parse(cleaned);
                            } catch {
                                memory.addMessage(userId, 'tool', JSON.stringify({
                                    tool_call_id: toolCall.id,
                                    name: functionName,
                                    content: `Error: Formato de argumentos inválido.`
                                }));
                                continue;
                            }
                        }
                        
                        try {
                            const result = await executeTool(functionName, userId, functionArgs);
                            memory.addMessage(userId, 'tool', JSON.stringify({
                                tool_call_id: toolCall.id,
                                name: functionName,
                                content: typeof result === 'string' ? result : JSON.stringify(result)
                            }));
                        } catch (error: any) {
                            memory.addMessage(userId, 'tool', JSON.stringify({
                                tool_call_id: toolCall.id,
                                name: functionName,
                                content: `Error: ${error.message}`
                            }));
                        }
                    }
                    continue;
                }

                const finalContent = responseMessage.content || "No pude generar una respuesta.";
                memory.addMessage(userId, 'assistant', finalContent);
                return finalContent;

            } catch (error: any) {
                console.error("❌ Error en el bucle del agente:", error);
                if (error.message && error.message.includes("saturados")) {
                    return error.message;
                }
                return "He tenido un problema técnico procesando tu mensaje. Por favor, intenta de nuevo.";
            }
        }

        return "Me he perdido intentando resolver tu solicitud después de muchos pasos. ¿Podrías ser más específico?";
    } finally {
        userLocks.delete(userId);
    }
}
