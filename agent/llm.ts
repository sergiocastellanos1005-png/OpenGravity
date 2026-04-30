import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { tools } from '../tools/index.js';
import { Message } from './memory.js';
import OpenAI from 'openai';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const openRouter = env.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://opengravity.io", // Requerido por algunos modelos de OpenRouter
        "X-Title": "OpenGravity Bot",
    }
}) : null;

export async function chatCompletion(messages: any[]) {
    const groqModels = [
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "llama-3.1-8b-instant"
    ];

    // Lista ampliada de rescate: Probamos modelos gratis y muy baratos de OpenRouter
    const fallbackModels = [
        "google/gemini-2.0-flash-001", // Potente para visión y herramientas
        env.OPENROUTER_MODEL, 
        "google/gemini-2.0-flash-lite-preview-02-05:free", 
        "meta-llama/llama-3.2-11b-vision-instruct:free", // Respaldo de visión gratis
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-7b-instruct:free"
    ].filter(Boolean);

    // --- FASE 1: INTENTAR CON GROQ ---
    console.log("--- Iniciando ciclo de IA ---");
    for (const model of groqModels) {
        try {
            console.log(`🚀 Intentando Groq (${model})...`);
            const response = await groq.chat.completions.create({
                model: model,
                // @ts-ignore
                messages: messages,
                tools: tools as any,
                tool_choice: "auto",
            });
            if (response.choices && response.choices[0]) {
                console.log(`✅ Éxito con Groq (${model})`);
                return response.choices[0].message;
            }
        } catch (error: any) {
            const isRateLimit = error.status === 429 || error.message?.includes("429");
            if (isRateLimit) {
                console.warn(`⚠️ Groq Rate Limit en ${model}. Saltando al rescate inmediatamente.`);
                break; // No perdemos tiempo con otros modelos de Groq si hay rate limit global
            }
            console.warn(`⚠️ Groq ${model} falló: ${error.message}`);
        }
    }

    // --- FASE 2: RESCATE TOTAL CON OPENROUTER ---
    if (openRouter) {
        console.error(`❌ Groq falló o está saturado. Iniciando cascada de rescate en OpenRouter...`);
        for (const modelId of fallbackModels) {
            try {
                console.log(`🔄 Probando motor de reserva: ${modelId}...`);
                const fallbackResponse = await openRouter.chat.completions.create({
                    model: modelId,
                    // @ts-ignore
                    messages: messages,
                    tools: tools as any,
                    tool_choice: "auto"
                });
                if (fallbackResponse.choices && fallbackResponse.choices[0]) {
                    console.log(`✅ Rescate exitoso con: ${modelId}`);
                    return fallbackResponse.choices[0].message;
                }
            } catch (fallbackError: any) {
                console.error(`❌ El motor ${modelId} también falló: ${fallbackError.message}`);
                // Seguimos al siguiente en la lista sin detenernos
            }
        }
    } else {
        console.error("⚠️ No hay motor de rescate (OpenRouter) configurado en las variables de entorno.");
    }

    // --- FASE 3: MENSAJE DE ÚLTIMO RECURSO ---
    return { 
        role: 'assistant', 
        content: "Lo siento mucho. Todos mis cerebros (Groq y Gemini/OpenRouter) han alcanzado su límite de uso gratuito por este minuto. Por favor, **espera exactamente 60 segundos** e intenta de nuevo. Si esto pasa mucho, revisa tu configuración de OpenRouter." 
    };
}
