import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

const execPromise = promisify(exec);

export const developerTools = [
    {
        type: "function" as const,
        function: {
            name: "write_file",
            description: "Crea o sobreescribe un archivo con código o texto.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Ruta del archivo (relativa al proyecto)" },
                    content: { type: "string", description: "Contenido del archivo" }
                },
                required: ["path", "content"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "read_file",
            description: "Lee el contenido de un archivo.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", description: "Ruta del archivo" }
                },
                required: ["path"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "execute_command",
            description: "Ejecuta un comando en la terminal del sistema.",
            parameters: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Comando a ejecutar" }
                },
                required: ["command"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "list_directory",
            description: "Lista los archivos y carpetas de un directorio.",
            parameters: {
                type: "object",
                properties: {
                    path: { type: "string", default: "./", description: "Ruta a listar" }
                }
            }
        }
    }
];

export async function handleDeveloperTool(name: string, args: any): Promise<string> {
    const rootDir = process.cwd();
    
    try {
        switch (name) {
            case 'write_file': {
                const fullPath = join(rootDir, args.path);
                const dir = dirname(fullPath);
                if (!existsSync(dir)) await mkdir(dir, { recursive: true });
                await writeFile(fullPath, args.content, 'utf8');
                return `✅ Archivo guardado correctamente en: ${args.path}`;
            }
            case 'read_file': {
                const fullPath = join(rootDir, args.path);
                const content = await readFile(fullPath, 'utf8');
                return content;
            }
            case 'execute_command': {
                // Por seguridad, podrías añadir una lista blanca aquí
                const { stdout, stderr } = await execPromise(args.command);
                return stdout || stderr || "Comando ejecutado (sin salida)";
            }
            case 'list_directory': {
                const fullPath = join(rootDir, args.path || "./");
                const files = await readdir(fullPath, { withFileTypes: true });
                return files.map(f => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`).join('\n');
            }
            default:
                throw new Error(`Módulo developer no reconoce: ${name}`);
        }
    } catch (error: any) {
        return `❌ Error en herramienta developer: ${error.message}`;
    }
}
