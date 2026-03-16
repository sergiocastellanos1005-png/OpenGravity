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

    const groqModels = [
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "llama-3.1-8b-instant"
    ];

    const runWithGroq = async (model: string) => {
        return await groq.chat.completions.create({
            model: model,
            // @ts-ignore
            messages: messages,
            tools: tools as any,
            tool_choice: "auto",
        });
    };

    const fallbackModels = [
        env.OPENROUTER_MODEL, 
        "google/gemini-2.0-flash-lite-preview-02-05:free", 
        "meta-llama/llama-3.3-70b-instruct:free",
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
            // Intentar con los modelos de Groq primero
            for (const model of groqModels) {
                try {
                    const response = await runWithGroq(model);
                    return response.choices[0].message;
                } catch (e: any) {
                    if (e.status === 429) throw e; // Si es rate limit, salir al catch principal para esperar
                    console.warn(`⚠️ Groq ${model} falló, probando siguiente...`);
                }
            }
            throw new Error("Todos los modelos de Groq fallaron.");

        } catch (error: any) {
            attempt++;
            const isRateLimit = error.status === 429 || (error.error && error.error.code === 429) || (error.message && error.message.includes("429"));
            
            if (isRateLimit && attempt <= maxRetries) {
                const waitTime = 5000 * attempt;
                console.warn(`⚠️ Límite de Groq (429). Esperando ${waitTime/1000}s...`);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }

            console.error(`❌ Falló Groq completamente. Entrando a Rescate (OpenRouter)...`);
            
            if (openRouter) {
                for (const model of fallbackModels) {
                    if (!model) continue;
                    try {
                        const fallbackResponse = await runWithOpenRouter(model);
                        if (fallbackResponse && fallbackResponse.choices[0]) {
                            return fallbackResponse.choices[0].message;
                        }
                    } catch (fallbackError: any) {
                        console.error(`❌ Falló modelo ${model}: ${fallbackError.message}`);
                    }
                }
            }
            
            if (attempt > maxRetries) {
                return { 
                    role: 'assistant', 
                    content: "Lo siento, mis procesadores están saturados por el límite de peticiones gratuitas. Por favor, espera un minuto e intenta de nuevo." 
                };
            }
        }
    }
    
    throw new Error("Se superó el límite de reintentos con la API de IA.");
}
