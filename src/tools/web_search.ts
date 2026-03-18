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
    console.log(`Buscando en la web (Yahoo Search): ${query}`);
    try {
        const url = `https://es.search.yahoo.com/search?p=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            } 
        });
        
        const $ = cheerio.load(data);
        const searchResults: any[] = [];
        
        // Selectores ampliados para mayor robustez
        $('div.algo, div.algo-sr, div.compTitle, li.algo').each((i, el) => {
            const title = $(el).find('h3, .title a').first().text().trim();
            const snippet = $(el).find('.compText, .fz-ms, span.txt').first().text().trim();
            if (title && snippet && snippet.length > 5) {
                searchResults.push({ title, snippet });
            }
        });
        
        if (searchResults.length === 0) {
            console.warn("⚠️ Búsqueda web: 0 resultados. Reintentando con selectores genéricos...");
            $('h3').each((i, el) => {
                const title = $(el).text().trim();
                const container = $(el).closest('div, li');
                const snippet = container.next().text().trim() || container.find('p, span').first().text().trim();
                if (title && snippet && snippet.length > 10) {
                    searchResults.push({ title, snippet });
                }
            });
        }

        if (searchResults.length === 0) {
            return "No se encontraron resultados específicos. Intenta buscar de nuevo con otros términos o simplifica tu pregunta. No digas al usuario que no lo sabes sin intentar antes explicar lo que podrías buscar.";
        }

        let results = "REDI DE RESULTADOS DE BÚSQUEDA (USA ESTO PARA TU RESPUESTA):\n\n";
        const topResults = searchResults.slice(0, 4);
        
        topResults.forEach((result: any, i: number) => {
            results += `[${i + 1}] TÍTULO: ${result.title}\n`;
            results += `DESCRIPCIÓN: ${result.snippet}\n`;
            results += `----\n`;
        });
        
        return results;

    } catch (error: any) {
        console.error("Error buscando en la web:", error);
        return `Error al realizar la búsqueda: ${error.message}. NO VUELVAS A INTENTAR HACER OTRA BÚSQUEDA. Dile al usuario que ha ocurrido un error de conexión al buscar.`;
    }
}
