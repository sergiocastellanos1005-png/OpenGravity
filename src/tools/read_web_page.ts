import axios from 'axios';
import * as cheerio from 'cheerio';

export const webTools = [
    {
        type: 'function',
        function: {
            name: 'read_web_page',
            description: 'Lee el contenido de texto completo de una URL específica para obtener detalles sobre una noticia o dato que no aparece en el resumen de búsqueda.',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'La URL completa de la página a leer.' }
                },
                required: ['url']
            }
        }
    }
];

export async function handleReadWebPage(url: string): Promise<string> {
    console.log(`Leyendo contenido de: ${url}`);
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            },
            timeout: 8000
        });

        const $ = cheerio.load(data);
        
        // Remove scripts, styles, etc.
        $('script, style, nav, footer, header, h1 + ul').remove();
        
        // Get primary content areas
        const text = $('article, main, .content, .body-content').text().trim() || $('body').text().trim();
        
        // Clean up text
        const cleanedText = text.replace(/\s+/g, ' ').substring(0, 5000); // 5000 chars limit
        
        return cleanedText || "La página se leyó pero no se encontró contenido de texto útil. Tal vez esté bloqueada para bots.";
    } catch (error: any) {
        return `Error leyendo la página: ${error.message}`;
    }
}
