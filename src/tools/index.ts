import { getCurrentTimeTool, getCurrentTime } from './get_current_time.js';
// import { googleWorkspaceTools, handleWorkspaceTool } from './google_workspace.js';
import { developerTools, handleDeveloperTool } from './developer.js';
import { memoryTools, handleMemoryTool } from './memory_tool.js';
import { webSearchTool, handleWebSearch } from './web_search.js';
import { webTools, handleReadWebPage } from './read_web_page.js';
import { financeTools, handleFinancialData } from './finance.js';
import { reminderTools, handleSetReminder } from './reminders.js';

export const tools = [
    getCurrentTimeTool,
    // ...googleWorkspaceTools, // Desactivado temporalmente
    ...developerTools,
    ...memoryTools,
    webSearchTool,
    ...webTools,
    ...financeTools,
    ...reminderTools
];

export async function executeTool(name: string, userId: number, args: any): Promise<any> {
    switch (name) {
        case 'get_current_time':
            return await getCurrentTime();
        case 'web_search':
            return await handleWebSearch(args.query);
        case 'read_web_page':
            return await handleReadWebPage(args.url);
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
        case 'get_financial_data':
            return await handleFinancialData(args.symbol);
        case 'set_reminder':
            return await handleSetReminder(userId, args.text, args.datetime);
        default:
            throw new Error(`Herramienta desconocida: ${name}`);
    }
}



