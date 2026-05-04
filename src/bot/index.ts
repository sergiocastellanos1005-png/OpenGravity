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

// NUEVO: Manejador de Documentos (Análisis de archivos)
bot.on('message:document', async (ctx) => {
    const userId = ctx.from.id;
    const document = ctx.message.document;
    const fileName = document.file_name || "archivo_desconocido";
    const caption = ctx.message.caption || "";
    
    await ctx.replyWithChatAction('typing');

    try {
        const file = await ctx.api.getFile(document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

        console.log(`📄 Documento recibido [${userId}]: ${fileName}. Caption: ${caption}`);

        // Descargar archivo
        const axios = (await import('axios')).default;
        const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data);

        let extractedText = "";

        if (fileName.toLowerCase().endsWith('.pdf')) {
            const pdf = (await import('pdf-parse/lib/pdf-parse.js' as any)).default;
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (fileName.toLowerCase().endsWith('.docx')) {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        } else {
            // Asumir que es texto plano (txt, md, py, js, etc.)
            extractedText = buffer.toString('utf-8');
        }

        if (extractedText.length > 30000) {
            extractedText = extractedText.substring(0, 30000) + "... [Texto truncado por ser demasiado largo]";
        }

        const prompt = `[ARCHIVO_RECIBIDO: ${fileName}]
Contenido del archivo:
---
${extractedText}
---
${caption || "Analiza el contenido de este archivo."}`;

        await ctx.reply(`🔍 Analizando archivo: *${fileName}*...`, { parse_mode: 'Markdown' });
        const aiResponse = await processUserMessage(userId, prompt);
        await handleResponse(ctx, aiResponse);

    } catch (error: any) {
        console.error("Error procesando documento:", error.message);
        await ctx.reply(`❌ No pude procesar el archivo "${fileName}". Asegúrate de que sea un formato legible (.txt, .pdf, .docx).`);
    }
});

// Manejo de errores globales del bot
bot.catch((err) => {
    console.error("Error en el bot de Telegram:", err);
});

