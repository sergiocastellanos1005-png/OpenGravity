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
                    parent_id: { type: "string", description: "ID de la página padre (requerido para 'add_page'). OBLIGATORIO: Si no tienes el ID, NUNCA se lo pidas al usuario. Usa la acción 'search' para buscar la página por su nombre y obtener el ID tú mismo." },
                    parent_type: { type: "string", enum: ["page", "database"], description: "El tipo de contenedor padre (requerido para 'add_page')." },
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
    const { action, query, parent_id, parent_type, title, content } = args;

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
                title: res.title?.[0]?.plain_text || res.properties?.title?.title?.[0]?.plain_text || res.properties?.Name?.title?.[0]?.plain_text || 'Sin título',
                url: res.url
            }));
        }

        if (action === 'add_page') {
            if (!parent_id || !title || !parent_type) {
                return "Error: Se requiere 'parent_id', 'parent_type' y 'title' para añadir una página.";
            }
            
            const children: any[] = [];
            if (content) {
                const lines = content.split('\n').filter((l: string) => l.trim() !== '');
                for (const line of lines) {
                    const text = line.trim();
                    if (text.startsWith('- ') || text.startsWith('* ')) {
                        children.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text.substring(2) } }] } });
                    } else if (text.startsWith('[ ] ')) {
                        children.push({ object: 'block', type: 'to_do', to_do: { checked: false, rich_text: [{ type: 'text', text: { content: text.substring(4) } }] } });
                    } else if (text.startsWith('[x] ') || text.startsWith('[X] ')) {
                        children.push({ object: 'block', type: 'to_do', to_do: { checked: true, rich_text: [{ type: 'text', text: { content: text.substring(4) } }] } });
                    } else if (text.startsWith('### ')) {
                        children.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: text.substring(4) } }] } });
                    } else if (text.startsWith('## ')) {
                        children.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: text.substring(3) } }] } });
                    } else if (text.startsWith('# ')) {
                        children.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: text.substring(2) } }] } });
                    } else {
                        children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: text } }] } });
                    }
                }
            }

            const parentObj = parent_type === 'database' 
                ? { database_id: parent_id } 
                : { page_id: parent_id };
                
            const propertiesObj = parent_type === 'database' 
                ? { Name: { title: [{ text: { content: title } }] } }
                : { title: { title: [{ text: { content: title } }] } };

            const response = await notion.pages.create({
                parent: parentObj,
                properties: propertiesObj,
                children: children.length > 0 ? children : undefined
            } as any);

            return `✅ Página creada exitosamente en Notion. ID: ${(response as any).id} | URL: ${(response as any).url}`;
        }

        return "Acción no reconocida.";
    } catch (error: any) {
        return `Error al interactuar con Notion: ${error.message}`;
    }
}
