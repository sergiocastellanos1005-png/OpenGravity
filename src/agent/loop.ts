import { memory, Message } from './memory.js';
import { chatCompletion } from './llm.js';
import { executeTool } from '../tools/index.js';
import { SYSTEM_PROMPT } from './system.js';

const MAX_ITERATIONS = 15;

function parseMessageForLLM(msg: Message) {
    if (msg.role === 'assistant' || msg.role === 'tool') {
        try {
            const parsed = JSON.parse(msg.content);
            
            // Caso 1: Asistente con llamadas a herramientas
            if (msg.role === 'assistant' && parsed.tool_calls) {
                return { 
                    role: 'assistant', 
                    content: null, // Groq requiere content: null si hay tool_calls
                    tool_calls: parsed.tool_calls 
                };
            }
            
            // Caso 2: Respuesta de herramienta
            if (msg.role === 'tool' && parsed.tool_call_id) {
                return { 
                    role: 'tool', 
                    content: parsed.content, 
                    name: parsed.name, 
                    tool_call_id: parsed.tool_call_id 
                };
            }
        } catch (e) {
            // No es JSON, continuamos para ver si es un mensaje de texto normal
        }
    }
    
    // IMPORTANTE: Filtrar cualquier mensaje de rol 'tool' que no haya pasado el filtro anterior
    // Groq lanzará error 400 si enviamos un mensaje 'tool' sin tool_call_id.
    if (msg.role === 'tool') return null;

    // Mensajes normales de usuario o asistente (texto)
    return { role: msg.role, content: msg.content };
}

export async function processUserMessage(userId: number, text: string): Promise<string> {
    memory.addMessage(userId, 'user', text);

    let iterations = 0;
    
    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const history = memory.getHistory(userId);
        
        const messages: any[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.map(parseMessageForLLM).filter(Boolean)
        ];

        const responseMessage = await chatCompletion(messages);

        if (!responseMessage) {
            return "Lo siento, ha ocurrido un error de comunicación.";
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
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
                    console.error("❌ Error parseando argumentos de la herramienta:", tc.function.arguments);
                    try {
                        // Intento de limpieza básica por si hay newlines sin escapar
                        const cleaned = (tc.function.arguments || '{}').replace(/\n/g, '\\n');
                        functionArgs = JSON.parse(cleaned);
                    } catch (e2) {
                        memory.addMessage(userId, 'tool', JSON.stringify({
                            tool_call_id: toolCall.id,
                            name: functionName,
                            content: `Error: Los argumentos de la función no son un JSON válido. Reintenta con el formato correcto.`
                        }));
                        continue;
                    }
                }
                
                try {
                    const result = await executeTool(functionName, userId, functionArgs);
                    const toolResultContent = typeof result === 'string' ? result : JSON.stringify(result);

                    memory.addMessage(userId, 'tool', JSON.stringify({
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: toolResultContent
                    }));
                } catch (error: any) {
                    memory.addMessage(userId, 'tool', JSON.stringify({
                        tool_call_id: toolCall.id,
                        name: functionName,
                        content: `Error ejecutando herramienta: ${error.message}`
                    }));
                }
            }
            continue;
        }

        const finalContent = responseMessage.content || "No pude generar una respuesta.";
        memory.addMessage(userId, 'assistant', finalContent);
        
        return finalContent;
    }

    return "He superado el límite de operaciones pensando en tu solicitud. Por favor, intenta de nuevo.";
}
