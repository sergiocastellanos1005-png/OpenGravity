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
        { name: 'SearXNG', url: (q: string) => `https://searx.be/search?q=${encodeURIComponent(q)}&format=json` },
        { name: 'SearXNG_Backup', url: (q: string) => `https://searx.work/search?q=${encodeURIComponent(q)}&format=json` },
        { name: 'DuckDuckGo', url: (q: string) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` },
        { name: 'Yahoo', url: (q: string) => `https://es.search.yahoo.com/search?p=${encodeURIComponent(q)}` }
    ];

    for (const engine of engines) {
        console.log(`Buscando en ${engine.name}: ${query}`);
        try {
            const { data } = await axios.get(engine.url(query), { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'es-ES,es;q=0.9',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 8000
            });
            
            const $ = cheerio.load(data);
            const searchResults: any[] = [];
            
            if (engine.name.startsWith('SearXNG')) {
                const results = data.results || [];
                for (const res of results) {
                    if (res.title && res.content) {
                        searchResults.push({ title: res.title, snippet: res.content, url: res.url });
                    }
                }
            } else {
                const $ = cheerio.load(data);
                if (engine.name === 'DuckDuckGo') {
                    $('.result').each((i, el) => {
                        const title = $(el).find('h2.result__title a').first().text().trim();
                        const url = $(el).find('h2.result__title a').first().attr('href') || '#';
                        const snippet = $(el).find('a.result__snippet').first().text().trim();
                        if (title && snippet) searchResults.push({ title, snippet, url });
                    });
                } else if (engine.name === 'Yahoo') {
                    $('div.algo, div.algo-sr, div.compTitle, li.algo').each((i, el) => {
                        const title = $(el).find('h3, .title a').first().text().trim();
                        const url = $(el).find('a').first().attr('href') || '#';
                        const snippet = $(el).find('.compText, .fz-ms, span.txt').first().text().trim();
                        if (title && snippet.length > 5) searchResults.push({ title, snippet, url });
                    });
                }
            }
            
            if (searchResults.length > 0) {
                let results = `RESULTADOS DE ${engine.name.toUpperCase()}:\n\n`;
                searchResults.slice(0, 5).forEach((res, i) => {
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
