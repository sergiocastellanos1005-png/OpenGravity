import { bot } from './bot/index.js';
import http from 'http';
import { webhookCallback } from 'grammy';

async function main() {
    console.log("Iniciando OpenGravity...");
    
    const port = process.env.PORT || 8080;
    const url = process.env.RENDER_EXTERNAL_URL;

    // Manejador de Webhook
    const handleUpdate = webhookCallback(bot, 'http');

    const server = http.createServer(async (req, res) => {
        if (req.method === 'POST' && req.url === `/webhook`) {
            try {
                await handleUpdate(req, res);
            } catch (err) {
                console.error("Error procesando webhook:", err);
                res.statusCode = 500;
                res.end();
            }
        } else if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OpenGravity is alive and listening!');
        } else {
            res.statusCode = 404;
            res.end();
        }
    });

    server.listen(port, async () => {
        console.log(`Servidor HTTP activo en puerto: ${port}`);
        
        if (url) {
            console.log(`Configurando Webhook en: ${url}/webhook`);
            try {
                await bot.api.setWebhook(`${url}/webhook`);
                console.log("✅ Webhook configurado exitosamente en Telegram.");
            } catch (err: any) {
                console.error("❌ Error configurando webhook:", err.message);
            }
        } else {
            console.log("⚠️ No se detectó RENDER_EXTERNAL_URL. Iniciando en modo Polling (Local)...");
            bot.start({
                onStart: (botInfo) => {
                    console.log(`Bot conectado (Polling) como @${botInfo.username}`);
                }
            });
        }
    });

    // Iniciar el vigilante de recordatorios en segundo plano
    setInterval(async () => {
        try {
            const { memory } = await import('./agent/memory.js');
            const pending = memory.getPendingReminders();
            
            for (const r of pending) {
                console.log(`⏰ Procesando recordatorio a ${r.user_id}: ${r.text}`);
                
                const dateUTC = new Date(r.remind_at + 'Z'); 
                const dateLocal = dateUTC.toLocaleString('es-CO', { timeZone: 'America/Bogota' });

                if (r.text.startsWith('[TASK]')) {
                    const task = r.text.replace('[TASK]', '').trim();
                    console.log(`🔨 Ejecutando tarea programada: ${task}`);
                    
                    try {
                        const { processUserMessage } = await import('./agent/loop.js');
                        const result = await processUserMessage(r.user_id, `[Recordatorio Programado]: ${task}`);
                        
                        let content = result.trim();
                        const isAudio = content.toUpperCase().startsWith('[AUDIO]');
                        content = content.replace(/^\[AUDIO\]|\[TEXTO\]|\[TEXT\]\s*/gi, '').trim();

                        if (isAudio) {
                            const { textToSpeech } = await import('./tools/tts.js');
                            const audioPath = await textToSpeech(content);
                            const { InputFile } = await import('grammy');
                            await bot.api.sendVoice(r.user_id, new InputFile(audioPath));
                            const { unlinkSync } = await import('fs');
                            try { unlinkSync(audioPath); } catch {}
                        } else {
                            await bot.api.sendMessage(r.user_id, `⏰ **TAREA COMPLETADA:**\n\n${content}`, { parse_mode: 'Markdown' });
                        }
                    } catch (taskErr: any) {
                        console.error("Error ejecutando tarea:", taskErr.message);
                        await bot.api.sendMessage(r.user_id, `❌ Error en tarea programada: ${taskErr.message}`);
                    }
                } else {
                    await bot.api.sendMessage(r.user_id, `⏰ **RECORDATORIO:**\n\n"${r.text}"\n\n(Programado para: ${dateLocal})`, { parse_mode: 'Markdown' });
                }
                
                memory.markReminderAsSent(r.id);
            }
        } catch (err: any) {
            console.error("Error en el bucle de recordatorios:", err.message);
        }
    }, 30000);
}

main().catch(err => {
    console.error("Error fatal al iniciar la aplicación:", err);
    process.exit(1);
});

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

