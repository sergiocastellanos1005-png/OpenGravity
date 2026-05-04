import { memory } from '../agent/memory.js';

export const reminderTools = [
    {
        type: 'function',
        function: {
            name: 'set_reminder',
            description: 'Programa un recordatorio o aviso para el usuario en una fecha y hora específica.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'El texto del recordatorio (ej: "Llamar al médico").' },
                    datetime: { 
                        type: 'string', 
                        description: 'La fecha y hora en formato YYYY-MM-DD HH:MM:SS en formato UTC. (IMPORTANTE: El usuario está en Colombia UTC-5, así que si pide algo a las 6:00 PM, debes sumarle 5 horas para guardarlo en UTC).' 
                    }
                },
                required: ['text', 'datetime']
            }
        }
    }
];

export async function handleSetReminder(userId: number, text: string, datetime: string) {
    try {
        memory.addReminder(userId, text, datetime);
        return `✅ Recordatorio programado correctamente para: ${datetime}.\nTarea: "${text}"`;
    } catch (error: any) {
        return `Error al programar recordatorio: ${error.message}`;
    }
}
