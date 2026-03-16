import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { tools } from '../tools/index.js';
import { Message } from './memory.js';
import OpenAI from 'openai';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const openRouter = env.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
}) : null;

export async function chatCompletion(messages: any[]) {
    const groqModels = [
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "llama-3.1-8b-instant"
    ];

    const fallbackModels = [
        env.OPENROUTER_MODEL, 
        "google/gemini-2.0-flash-lite-preview-02-05:free", 
        "meta-llama/llama-3.3-70b-instruct:free",
    ];

    // --- Intento con Groq ---
    for (const model of groqModels) {
        try {
            console.log(`🚀 Intentando Groq con: ${model}`);
            const response = await groq.chat.completions.create({
                model: model,
                // @ts-ignore
                messages: messages,
                tools: tools as any,
                tool_choice: "auto",
            });
            if (response.choices[0]) return response.choices[0].message;
        } catch (error: any) {
            const isRateLimit = error.status === 429 || error.message?.includes("429");
            if (isRateLimit) {
                console.warn(`⚠️ Groq Rate Limit (429) en ${model}.`);
                break; // Si es rate limit, saltamos directamente al rescate sin probar otros de Groq
            }
            console.warn(`⚠️ Groq ${model} falló: ${error.message}. Probando siguiente de Groq...`);
        }
    }

    // --- Rescate con OpenRouter (como Gemini) ---
    console.error(`❌ Groq no disponible. Entrando a modo Rescate...`);
    
    if (openRouter) {
        for (const modelId of fallbackModels) {
            if (!modelId) continue;
            try {
                console.log(`🔄 Probando Rescate con: ${modelId}`);
                const fallbackResponse = await openRouter.chat.completions.create({
                    model: modelId,
                    // @ts-ignore
                    messages: messages,
                    tools: tools as any
                });
                if (fallbackResponse.choices[0]) return fallbackResponse.choices[0].message;
            } catch (fallbackError: any) {
                console.error(`❌ Falló rescate ${modelId}: ${fallbackError.message}`);
            }
        }
    }

    // --- Fallo total ---
    return { 
        role: 'assistant', 
        content: "Lo siento, todos mis motores de inteligencia están saturados ahora mismo por el límite de uso gratuito. Por favor, espera un minuto e intenta de nuevo." 
    };
}
