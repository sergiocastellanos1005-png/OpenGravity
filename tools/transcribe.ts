import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import fetch from 'node-fetch';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

/**
 * Descarga un archivo desde una URL y lo guarda temporalmente.
 */
async function downloadFile(url: string, filePath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error descargando archivo: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    writeFileSync(filePath, Buffer.from(buffer));
}

/**
 * Transcribe un archivo de audio usando Groq Whisper.
 * @param fileUrl - URL pública del archivo de audio (de Telegram).
 * @returns El texto transcrito.
 */
export async function transcribeAudio(fileUrl: string): Promise<string> {
    const tempPath = join(tmpdir(), `og_audio_${Date.now()}.ogg`);
    let attempt = 0;
    const maxRetries = 3;

    try {
        await downloadFile(fileUrl, tempPath);
        const { readFileSync } = await import('fs');
        const fileBuffer = readFileSync(tempPath);

        while (attempt < maxRetries) {
            try {
                const transcription = await groq.audio.transcriptions.create({
                    file: new File([fileBuffer], 'audio.ogg', { type: 'audio/ogg' }),
                    model: 'whisper-large-v3',
                    language: 'es',
                    response_format: 'text',
                });

                const text = typeof transcription === 'string' 
                    ? transcription 
                    : (transcription as any).text || '';

                if (!text || text.trim().length === 0) {
                    return '[Audio vacío o no se entendió]';
                }

                return text.trim();
            } catch (error: any) {
                attempt++;
                if (error.status === 429 && attempt < maxRetries) {
                    console.warn(`🎙️ Límite de transcripción (Groq). Reintentando en ${attempt * 3}s...`);
                    await new Promise(r => setTimeout(r, attempt * 3000));
                    continue;
                }
                throw error;
            }
        }
        throw new Error("Se agotaron los reintentos de transcripción.");
    } finally {
        try { unlinkSync(tempPath); } catch {}
    }
}
