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

    const fallbackModels = [
        env.OPENROUTER_MODEL, // Primera opción (desde .env o render)
        "google/gemini-2.0-flash-lite-preview-02-05:free", // Respaldo 1
        "meta-llama/llama-3.3-70b-instruct:free", // Respaldo 2
    ];

    const runWithOpenRouter = async (modelId: string) => {
        if (!openRouter) throw new Error("OpenRouter no está configurado.");
        console.log(`🔄 Probando OpenRouter con modelo: ${modelId}`);
        return await openRouter.chat.completions.create({
            model: modelId,
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
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }

            console.error(`❌ Error con Groq: ${error.message}. Probando fallback en OpenRouter...`);
            
            if (openRouter) {
                for (const model of fallbackModels) {
                    try {
                        const fallbackResponse = await runWithOpenRouter(model);
                        return fallbackResponse.choices[0].message;
                    } catch (fallbackError: any) {
                        console.error(`❌ Falló modelo ${model} en OpenRouter: ${fallbackError.message}`);
                        // Si falla, intentamos el siguiente en la lista
                    }
                }
            }
            
            if (attempt > maxRetries) {
                throw new Error("Todos los intentos fallaron (Groq y OpenRouter completo).");
            }
        }
    }
    
    throw new Error("Se superó el límite de reintentos con la API de IA.");
}
