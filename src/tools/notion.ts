import { Client } from '@notionhq/client';
import { env } from '../config/env.js';

export const notionTools = [
    {
        type: "function" as const,
        function: {
            name: "manage_notion",
            description: "Interactúa con el espacio de trabajo de Notion del usuario. Puede buscar páginas, leer bases de datos y añadir nuevas entradas o notas.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["search", "add_page"],
                        description: "La acción a realizar." 
                    },
                    query: { type: "string", description: "Término de búsqueda (para 'search')." },
                    database_id: { type: "string", description: "ID de la base de datos de Notion (requerido para 'add_page')." },
                    title: { type: "string", description: "Título de la nueva página o nota (requerido para 'add_page')." },
                    content: { type: "string", description: "Contenido de texto de la nota (opcional para 'add_page')." }
                },
                required: ["action"]
            }
        }
    }
];

export async function handleNotion(userId: number, args: any): Promise<any> {
    if (!env.NOTION_API_KEY) {
        return "Error: La clave de Notion (NOTION_API_KEY) no está configurada en las variables de entorno.";
    }

    const notion = new Client({ auth: env.NOTION_API_KEY });
    const { action, query, database_id, title, content } = args;

    try {
        if (action === 'search') {
            const response = await notion.search({
                query: query || '',
                sort: { direction: 'descending', timestamp: 'last_edited_time' }
            });
            
            if (response.results.length === 0) {
                return "No se encontraron páginas o bases de datos compartidas con esta integración. Asegúrate de invitar al bot ('OpenGravity') a la página desde el botón 'Compartir' en Notion.";
            }

            return response.results.map((res: any) => ({
                id: res.id,
                object: res.object,
                title: res.title?.[0]?.plain_text || res.properties?.Name?.title?.[0]?.plain_text || 'Sin título',
                url: res.url
            }));
        }

        if (action === 'add_page') {
            if (!database_id || !title) return "Error: Se requiere 'database_id' y 'title' para añadir una página.";
            
            const children: any[] = [];
            if (content) {
                children.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content } }]
                    }
                });
            }

            const response = await notion.pages.create({
                parent: { database_id },
                properties: {
                    Name: { // Asume que la columna principal se llama 'Name' o 'Nombre'
                        title: [
                            { text: { content: title } }
                        ]
                    }
                },
                children: children.length > 0 ? children : undefined
            });

            return `✅ Página creada exitosamente en Notion. URL: ${(response as any).url}`;
        }

        return "Acción no reconocida.";
    } catch (error: any) {
        return `Error al interactuar con Notion: ${error.message}`;
    }
}
