import { Bot, InputFile } from 'grammy';
import { env } from '../config/env.js';
import { processUserMessage } from '../agent/loop.js';
import { transcribeAudio } from '../tools/transcribe.js';
import { textToSpeech } from '../tools/tts.js';
import { unlinkSync } from 'fs';

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
        await ctx.reply(text);
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
        await ctx.reply("Ocurrió un error inesperado al procesar tu solicitud.");
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
        await ctx.reply("❌ No pude transcribir el audio. Intenta de nuevo.");
    }
});

// Manejador de Archivos de Audio (MP3, etc.)
bot.on('message:audio', async (ctx) => {
    const userId = ctx.from.id;

    await ctx.replyWithChatAction('typing');

    try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        const transcription = await transcribeAudio(fileUrl);
        console.log(`🎵 Transcripción audio [${userId}]: ${transcription}`);

        await ctx.replyWithChatAction('typing');
        const response = await processUserMessage(userId, `[Archivo de audio]: ${transcription}`);
        await handleResponse(ctx, response);
    } catch (error: any) {
        console.error("Error procesando archivo de audio:", error);
        await ctx.reply("❌ No pude transcribir el archivo de audio. Intenta de nuevo.");
    }
});

// Manejo de errores globales del bot
bot.catch((err) => {
    console.error("Error en el bot de Telegram:", err);
});

