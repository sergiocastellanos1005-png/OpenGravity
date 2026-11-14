import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { tools } from '../tools/index.js';
import OpenAI from 'openai';

// Nota: baseURL NO debe llevar barra al final para evitar el error de doble barra "//chat/completions" -> 404
const gemini = env.GEMINI_API_KEY ? new OpenAI({
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: env.GEMINI_API_KEY
}) : null;

const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

const openRouter = env.OPENROUTER_API_KEY ? new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://opengravity.io",
        "X-Title": "OpenGravity Bot",
    }
}) : null;

export async function chatCompletion(messages: any[]) {
    console.log("--- Iniciando ciclo de IA ---");

    // --- FASE 1: GOOGLE GEMINI (MOTOR PRINCIPAL: 1,000,000 TPM, VISIÓN Y TOOLS) ---
    if (gemini) {
        const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
        for (const model of geminiModels) {
            try {
                console.log(`🚀 Intentando Google Gemini (${model})...`);
                const response = await gemini.chat.completions.create({
                    model: model,
                    // @ts-ignore
                    messages: messages,
                    tools: tools as any,
                    tool_choice: "auto",
                });
                if (response.choices && response.choices[0]) {
                    console.log(`✅ Éxito con Gemini (${model})`);
                    return response.choices[0].message;
                }
            } catch (error: any) {
                console.warn(`⚠️ Google Gemini (${model}) falló: ${error.message}`);
            }
        }
    }

    // --- FASE 2: GROQ (RESPALDO ULTRA RÁPIDO) ---
    if (groq) {
        const groqModels = [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant"
        ];
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
                    console.warn(`⚠️ Groq Rate Limit en ${model}. Pasando al siguiente motor.`);
                    break;
                }
                console.warn(`⚠️ Groq ${model} falló: ${error.message}`);
            }
        }
    }

    // --- FASE 3: OPENROUTER (RESCATE ADICIONAL) ---
    if (openRouter) {
        const fallbackModels = [
            "meta-llama/llama-3.3-70b-instruct",
            env.OPENROUTER_MODEL
        ].filter(Boolean);

        for (const modelId of fallbackModels) {
            try {
                console.log(`🔄 Probando motor de reserva OpenRouter: ${modelId}...`);
                const fallbackResponse = await openRouter.chat.completions.create({
                    model: modelId,
                    // @ts-ignore
                    messages: messages,
                    tools: tools as any,
                    tool_choice: "auto"
                });
                if (fallbackResponse.choices && fallbackResponse.choices[0]) {
                    console.log(`✅ Rescate exitoso con OpenRouter: ${modelId}`);
                    return fallbackResponse.choices[0].message;
                }
            } catch (fallbackError: any) {
                console.error(`❌ OpenRouter ${modelId} falló: ${fallbackError.message}`);
            }
        }
    }

    // --- FASE 4: MENSAJE FINAL SI NINGUNO RESPONDIÓ ---
    return {
        role: 'assistant',
        content: "⚠️ No pude conectar con ningún motor de IA (Gemini / Groq / OpenRouter). Revisa que al menos una clave API (ej. GEMINI_API_KEY o GROQ_API_KEY) esté configurada y activa en las variables de entorno de Render."
    };
}
