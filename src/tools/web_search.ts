import { search } from 'googlethis';

export const webSearchTool = {
    type: 'function',
    function: {
        name: 'web_search',
        description: 'Realiza una búsqueda en internet en tiempo real para obtener información actualizada, responder preguntas sobre eventos recientes, o buscar cualquier dato en Google.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'La consulta exacta para buscar en Google.'
                }
            },
            required: ['query'],
            additionalProperties: false
        }
    }
};

export async function handleWebSearch(query: string) {
    console.log(`Buscando en Google: ${query}`);
    try {
        const options = {
            page: 0, 
            safe: false, // Safe Search
            parse_ads: false, // If set to true sponsored results will be parsed
            additional_params: { 
                // add additional parameters here, see https://moz.com/blog/the-ultimate-guide-to-the-google-search-parameters and https://www.seobythesea.com/2006/01/google-search-url-parameters-query-string-anatomy/
                hl: 'es' 
            }
        };
        
        const response = await search(query, options);
        
        let results = "Resultados de la búsqueda web:\n\n";

        if (response.knowledge_panel && response.knowledge_panel.description) {
            results += `[Panel de Conocimiento Destacado]:\n${response.knowledge_panel.title}: ${response.knowledge_panel.description}\n\n`;
        }
        
        if (response.results.length === 0) {
            return "No se encontraron resultados relevantes.";
        }

        const topResults = response.results.slice(0, 5); // Tomamos los 5 primeros resultados
        
        topResults.forEach((result: any, i: number) => {
            results += `[Resultado ${i + 1}]:\n`;
            results += `Título: ${result.title}\n`;
            results += `Descripción: ${result.description}\n`;
            results += `----\n`;
        });
        
        return results;

    } catch (error: any) {
        console.error("Error buscando en Google:", error);
        return `Error al realizar la búsqueda: ${error.message}`;
    }
}
