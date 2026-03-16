import fetch from 'node-fetch';
import { env } from '../config/env.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as googleTTS from 'google-tts-api';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (Voz universal del sistema)

/**
 * Convierte texto a voz usando ElevenLabs y devuelve la ruta al archivo temporal.
 * Si ElevenLabs falla (ej. cuota excedida), usa Google Translate TTS como fallback.
 */
export async function textToSpeech(text: string): Promise<string> {
    const tempPath = join(tmpdir(), `og_tts_${Date.now()}.mp3`);

    try {
        if (!env.ELEVENLABS_API_KEY) {
            throw new Error('ELEVENLABS_API_KEY no configurado.');
        }

        const response = await fetch(`${ELEVENLABS_API_URL}/${DEFAULT_VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': env.ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error de ElevenLabs: ${error}`);
        }

        const buffer = await response.arrayBuffer();
        writeFileSync(tempPath, Buffer.from(buffer));
        return tempPath;

    } catch (error: any) {
        console.warn(`⚠️ ElevenLabs falló, usando Google TTS fallback: ${error.message}`);
        
        try {
            // Google TTS tiene un límite de 200 caracteres por petición, google-tts-api lo maneja internamente si se usa getAllAudioUrls o similar,
            // pero para simplicidad aquí generamos la URL y descargamos.
            const url = googleTTS.getAudioUrl(text.substring(0, 200), {
                lang: 'es',
                slow: false,
                host: 'https://translate.google.com',
            });

            const response = await fetch(url);
            if (!response.ok) throw new Error('Google TTS falló');
            
            const buffer = await response.arrayBuffer();
            writeFileSync(tempPath, Buffer.from(buffer));
            return tempPath;
        } catch (fallbackError: any) {
            throw new Error(`Ambos motores de TTS fallaron: ${fallbackError.message}`);
        }
    }
}
