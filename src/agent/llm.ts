import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { tools } from '../tools/index.js';
import { Message } from './memory.js';
import OpenAI from 'openai'; // OpenRouter usa la compatibilidad con OpenAI API

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const openRouter = env.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
}) : null;

export async function chatCompletion(messages: any[]) {
    const maxRetries = 2;
    let attempt = 0;

    const runWithGroq = async () => {
        return await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            // @ts-ignore
            messages: messages,
            tools: tools as any,
            tool_choice: "auto",
        });
    };

    const runWithOpenRouter = async () => {
        if (!openRouter) throw new Error("OpenRouter no está configurado.");
        return await openRouter.chat.completions.create({
            model: env.OPENROUTER_MODEL,
            // @ts-ignore
            messages: messages,
            tools: tools as any
        });
    };

    while (attempt <= maxRetries) {
        try {
            const response = await runWithGroq();
            return response.choices[0].message;
        } catch (error: any) {
            attempt++;
            const isRateLimit = error.status === 429 || (error.error && error.error.code === 429) || (error.message && error.message.includes("429"));
            
            if (isRateLimit && attempt <= maxRetries) {
                console.warn(`⚠️ Limite de Groq alcanzado (Intento ${attempt}/${maxRetries}). Esperando...`);
                await new Promise(r => setTimeout(r, 2000 * attempt)); // Espera exponencial
                continue;
            }

            console.error(`❌ Error con Groq, probando OpenRouter fallback... ${error.message}`);
            try {
                if (openRouter) {
                    const fallbackResponse = await runWithOpenRouter();
                    return fallbackResponse.choices[0].message;
                } else {
                     throw new Error("OpenRouter no está configurado para el fallback.");
                }
            } catch (fallbackError: any) {
                console.error("❌ Error en Fallback (OpenRouter):", fallbackError.message);
                
                // Si ambos fallan y es el último intento, lanzamos error
                if (attempt > maxRetries) {
                    throw new Error("Ambos modelos (Groq y OpenRouter) fallaron.");
                }
            }
        }
    }
    
    throw new Error("Se superó el límite de reintentos con la API de IA.");
}
