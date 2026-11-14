export const getCurrentTimeTool = {
    type: "function" as const,
    function: {
        name: "get_current_time",
        description: "Obtener la fecha y hora actual local.",
        parameters: {
            type: "object",
            properties: {
                timezone: {
                    type: "string",
                    description: "Zona horaria opcional (ej: America/Bogota)"
                }
            },
            required: [],
        },
    },
};

export async function getCurrentTime(): Promise<string> {
    const now = new Date();
    return now.toLocaleString('es-ES', { timeZone: 'America/New_York' }); // Usar la zona local, pero format en español
}
