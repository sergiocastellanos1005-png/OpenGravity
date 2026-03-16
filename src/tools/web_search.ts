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
        
        $('.compTitle, .algo-sr').each((i, el) => {
            const title = $(el).find('.title a, h3').text().trim();
            const snippet = $(el).find('.compText, .fz-ms').text().trim();
            if (title && snippet && snippet.length > 5) {
                searchResults.push({ title, snippet });
            }
        });
        
        if (searchResults.length === 0) {
            return "No se encontraron resultados relevantes en la web. NO VUELVAS A INTENTAR HACER OTRA BÚSQUEDA IGUAL. Informa directamente al usuario de que no tienes esta información.";
        }

        let results = "Resultados de la búsqueda web:\n\n";
        const topResults = searchResults.slice(0, 5); // Tomamos los 5 primeros
        
        topResults.forEach((result: any, i: number) => {
            results += `[Resultado ${i + 1}]:\n`;
            results += `Título: ${result.title}\n`;
            results += `Descripción: ${result.snippet}\n`;
            results += `----\n`;
        });
        
        return results;

    } catch (error: any) {
        console.error("Error buscando en la web:", error);
        return `Error al realizar la búsqueda: ${error.message}. NO VUELVAS A INTENTAR HACER OTRA BÚSQUEDA. Dile al usuario que ha ocurrido un error de conexión al buscar.`;
    }
}
