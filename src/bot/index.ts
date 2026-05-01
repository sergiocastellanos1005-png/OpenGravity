import { Bot, InputFile } from 'grammy';
import { env } from '../config/env.js';
import { processUserMessage } from '../agent/loop.js';
import { transcribeAudio } from '../tools/transcribe.js';
import { textToSpeech } from '../tools/tts.js';
import { unlinkSync } from 'fs';
import { memory } from '../agent/memory.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

async function sendVoiceResponse(ctx: any, text: string) {
    if (!env.ELEVENLABS_API_KEY) {
        await ctx.reply(text);
        return;
    }

    try {
        await ctx.replyWithChatAction('record_voice');
        console.log(`🎙️ Generando voz para: "${text.substring(0, 30)}..."`);
        const audioPath = await textToSpeech(text);
        
        await ctx.replyWithVoice(new InputFile(audioPath));
        
        try { unlinkSync(audioPath); } catch {}
    } catch (error: any) {
        console.error("❌ ERROR EN TTS:", error.message);
        // Fallback: Si falla la voz, enviamos el texto original
        await ctx.reply(text);
    }
}

async function handleResponse(ctx: any, response: string) {
    let text = response.trim();
    const isAudio = text.toUpperCase().startsWith('[AUDIO]');
    
    // Limpiar etiquetas para que no se muestren/lean
    text = text.replace(/^\[AUDIO\]\s*/i, '');
    text = text.replace(/^\[TEXTO\]\s*/i, '');
    text = text.replace(/^\[TEXT\]\s*/i, '');

    if (isAudio) {
        await sendVoiceResponse(ctx, text);
    } else {
        try {
            // Telegram Markdown usa *texto* para negritas, no **texto**
            const formattedText = text.replace(/\*\*/g, '*');
            await ctx.reply(formattedText, { parse_mode: 'Markdown' });
        } catch (err) {
            // Fallback si el markdown de Telegram falla por caracteres no escapados
            await ctx.reply(text);
        }
    }
}

// Middleware para Whitelist de Usuarios
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !env.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
        console.warn(`Intento de acceso denegado del usuario: ${userId}`);
        if (ctx.chat?.type === 'private') {
            await ctx.reply("Lo siento, no tienes autorización para usar este bot.");
        }
        return;
    }
    await next();
});

// Manejador de Comandos
bot.command('start', (ctx) => {
    ctx.reply("Hola, soy OpenGravity. Tu agente personal de Inteligencia Artificial. ¿En qué te puedo ayudar hoy?");
});

bot.command('clear', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
        memory.clearHistory(userId);
        await ctx.reply("🧹 Memoria borrada. ¡Empecemos de cero!");
    }
});

// Manejador de Mensajes de Texto
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    await ctx.replyWithChatAction('typing');

    try {
        const response = await processUserMessage(userId, text);
        await handleResponse(ctx, response);
    } catch (error: any) {
        console.error("Error procesando mensaje:", error);
        await ctx.reply("Lo siento, mis procesadores están un poco saturados. Por favor, espera 30 segundos e intenta de nuevo.");
    }
});

// Manejador de Notas de Voz
bot.on('message:voice', async (ctx) => {
    const userId = ctx.from.id;

    await ctx.replyWithChatAction('typing');
    
    try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const transcription = await transcribeAudio(fileUrl);
        console.log(`🎙️ Transcripción [${userId}]: ${transcription}`);

        await ctx.replyWithChatAction('typing');
        const response = await processUserMessage(userId, `[Mensaje de voz]: ${transcription}`);
        await handleResponse(ctx, response);
    } catch (error: any) {
        console.error("Error procesando audio:", error);
        await ctx.reply("No pude procesar tu audio esta vez (posible saturación del sistema). ¿Podrías intentar enviarlo de nuevo o escribirlo?");
    }
});

// Manejador de Archivos de Audio (MP3, etc.)
bot.on('message:audio', async (ctx) => {
    // ... Código existente del audio ...
    const userId = ctx.from.id;
    await ctx.replyWithChatAction('typing');
    try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        const transcription = await transcribeAudio(fileUrl);
        const response = await processUserMessage(userId, `[Archivo de audio]: ${transcription}`);
        await handleResponse(ctx, response);
    } catch (error: any) {
        console.error("Error audio:", error);
        await ctx.reply("❌ No pude transcribir el audio.");
    }
});

// NUEVO: Manejador de Fotos (VISIÓN AI)
bot.on('message:photo', async (ctx) => {
    const userId = ctx.from.id;
    const caption = ctx.message.caption || "";
    
    await ctx.replyWithChatAction('typing');

    try {
        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1]; // La de mayor calidad
        const file = await ctx.api.getFile(bestPhoto.file_id);
        const imageUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        console.log(`👁️ Visión AI [${userId}]: Imagen recibida. Caption: ${caption}`);

        // Enviamos al agente una instrucción que contenga la URL de la imagen encapsulada
        const visionText = `[IMAGEN_URL:${imageUrl}] ${caption || "Analiza esta imagen."}`;
        const response = await processUserMessage(userId, visionText);
        await handleResponse(ctx, response);
    } catch (error: any) {
        console.error("Error Visión AI:", error.message);
        await ctx.reply("❌ No pude procesar la imagen. Intenta de nuevo.");
    }
});

// Manejo de errores globales del bot
bot.catch((err) => {
    console.error("Error en el bot de Telegram:", err);
});

