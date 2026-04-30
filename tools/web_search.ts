import axios from 'axios';
import * as cheerio from 'cheerio';

export const webSearchTool = {
    type: 'function',
    function: {
        name: 'web_search',
        description: 'Realiza una búsqueda web para obtener información real y actualizada sobre cualquier tema, especialmente sobre eventos recientes o dinero/divisas.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'La consulta exacta para buscar en internet.'
                }
            },
            required: ['query'],
            additionalProperties: false
        }
    }
};

export async function handleWebSearch(query: string) {
    const engines = [
        { name: 'Yahoo', url: (q: string) => `https://es.search.yahoo.com/search?p=${encodeURIComponent(q)}` },
        { name: 'Google', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=es` }
    ];

    for (const engine of engines) {
        console.log(`Buscando en ${engine.name}: ${query}`);
        try {
            const { data } = await axios.get(engine.url(query), { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                },
                timeout: 5000
            });
            
            const $ = cheerio.load(data);
            const searchResults: any[] = [];
            
            if (engine.name === 'Yahoo') {
                $('div.algo, div.algo-sr, div.compTitle, li.algo').each((i, el) => {
                    const title = $(el).find('h3, .title a').first().text().trim();
                    const url = $(el).find('a').first().attr('href') || '#';
                    const snippet = $(el).find('.compText, .fz-ms, span.txt').first().text().trim();
                    if (title && snippet.length > 5) searchResults.push({ title, snippet, url });
                });
            } else {
                // Selector genérico para Google
                $('div.g').each((i, el) => {
                    const title = $(el).find('h3').text().trim();
                    const url = $(el).find('a').first().attr('href') || '#';
                    const snippet = $(el).find('div.VwiC3b, span.st').text().trim();
                    if (title && snippet.length > 5) searchResults.push({ title, snippet, url });
                });
            }
            
            if (searchResults.length > 0) {
                let results = `RESULTADOS DE ${engine.name.toUpperCase()}:\n\n`;
                searchResults.slice(0, 4).forEach((res, i) => {
                    results += `[${i + 1}] ${res.title}\nURL: ${res.url}\nINFO: ${res.snippet}\n----\n`;
                });
                return results;
            }
        } catch (error: any) {
            console.warn(`Error en ${engine.name}: ${error.message}`);
        }
    }

    return "No encontré resultados directos. INTENTA BUSCAR DE NUEVO con términos diferentes (ej: si buscaste 'partidos', busca 'calendario Champions') o usa 'read_web_page' si tienes una URL.";
}
