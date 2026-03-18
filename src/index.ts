import { bot } from './bot/index.js';
import http from 'http';

async function main() {
    console.log("Iniciando OpenGravity...");
    
    // Iniciar servidor http básico para Health Checks (Requerido por Cloud Run)
    const port = process.env.PORT || 8080;
    http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OpenGravity is alive!');
    }).listen(port);
    
    console.log(`Servidor HTTP activo en puerto: ${port}`);

    // Iniciar el vigilante de recordatorios en segundo plano
    setInterval(async () => {
        try {
            const { memory } = await import('./agent/memory.js');
            const pending = memory.getPendingReminders();
            
            for (const r of pending) {
                console.log(`⏰ Enviando recordatorio a ${r.user_id}: ${r.text}`);
                await bot.api.sendMessage(r.user_id, `⏰ **RECORDATORIO:**\n\n"${r.text}"\n\n(Programado para: ${r.remind_at})`, { parse_mode: 'Markdown' });
                memory.markReminderAsSent(r.id);
            }
        } catch (err: any) {
            console.error("Error en el bucle de recordatorios:", err.message);
        }
    }, 30000); // Cada 30 segundos

    // Iniciar servidor de polling de telegram
    bot.start({
        onStart: (botInfo) => {
            console.log(`Bot conectado exitosamente como @${botInfo.username}`);
        }
    });
}

main().catch(err => {
    console.error("Error fatal al iniciar la aplicación:", err);
    process.exit(1);
});

// Manejo de señales de cierre gracefully
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
