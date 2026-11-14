import { config } from 'dotenv';

config();

function getEnv(key: string, required: boolean = true): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`La variable de entorno ${key} es requerida pero no está definida.`);
    }
    return value || '';
}

export const env = {
    TELEGRAM_BOT_TOKEN: getEnv('TELEGRAM_BOT_TOKEN'),
    TELEGRAM_ALLOWED_USER_IDS: getEnv('TELEGRAM_ALLOWED_USER_IDS').split(',').map(id => parseInt(id.trim(), 10)),
    GEMINI_API_KEY: getEnv('GEMINI_API_KEY', false),
    GROQ_API_KEY: getEnv('GROQ_API_KEY', false),
    OPENROUTER_API_KEY: getEnv('OPENROUTER_API_KEY', false),
    OPENROUTER_MODEL: getEnv('OPENROUTER_MODEL', false) || 'google/gemini-2.0-flash-001',
    DB_PATH: getEnv('DB_PATH', false) || './memory.db',
    ELEVENLABS_API_KEY: getEnv('ELEVENLABS_API_KEY', false),
    NOTION_API_KEY: getEnv('NOTION_API_KEY', false),
};

if (!env.GEMINI_API_KEY && !env.GROQ_API_KEY && !env.OPENROUTER_API_KEY) {
    throw new Error('Debes definir al menos una clave de IA: GEMINI_API_KEY, GROQ_API_KEY o OPENROUTER_API_KEY.');
}

