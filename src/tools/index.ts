import { getCurrentTimeTool, getCurrentTime } from './get_current_time.js';
// import { googleWorkspaceTools, handleWorkspaceTool } from './google_workspace.js';
import { developerTools, handleDeveloperTool } from './developer.js';
import { memoryTools, handleMemoryTool } from './memory_tool.js';

export const tools = [
    getCurrentTimeTool,
    // ...googleWorkspaceTools, // Desactivado temporalmente
    ...developerTools,
    ...memoryTools
];

export async function executeTool(name: string, userId: number, args: any): Promise<any> {
    switch (name) {
        case 'get_current_time':
            return await getCurrentTime();
        /*
        case 'gmail_search':
        case 'gmail_send':
        case 'calendar_list_events':
        case 'calendar_create_event':
        case 'drive_search':
            return await handleWorkspaceTool(name, args);
        */
        case 'write_file':
        case 'read_file':
        case 'execute_command':
        case 'list_directory':
            return await handleDeveloperTool(name, args);
        case 'clear_conversation_history':
            return await handleMemoryTool(userId, name, args);
        default:
            throw new Error(`Herramienta desconocida: ${name}`);
    }
}



