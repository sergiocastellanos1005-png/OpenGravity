import { Document, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export const documentGeneratorTools = [
    {
        type: 'function',
        function: {
            name: 'generate_document',
            description: 'Crea un archivo Word (.docx) o PDF con el contenido proporcionado y lo prepara para enviar al usuario.',
            parameters: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['docx', 'pdf'], description: 'El tipo de archivo a crear.' },
                    filename: { type: 'string', description: 'Nombre del archivo (ej: "resumen_proyecto").' },
                    content: { type: 'string', description: 'El contenido de texto que debe tener el documento.' },
                    title: { type: 'string', description: 'Título que aparecerá al inicio del documento.' }
                },
                required: ['type', 'filename', 'content']
            }
        }
    }
];

export async function handleGenerateDocument(args: any): Promise<any> {
    const { type, filename, content, title } = args;
    const finalFilename = filename.endsWith(`.${type}`) ? filename : `${filename}.${type}`;
    const filePath = join(tmpdir(), finalFilename);

    try {
        if (type === 'docx') {
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: title || "Documento de OpenGravity",
                                    bold: true,
                                    size: 32,
                                }),
                            ],
                        }),
                        new Paragraph({ text: "" }), // Espacio
                        ...content.split('\n').map((line: string) => new Paragraph({
                            children: [new TextRun(line)],
                        })),
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            writeFileSync(filePath, buffer);
        } else {
            // PDF Generation
            const doc = new PDFDocument();
            const stream = createWriteStream(filePath);
            doc.pipe(stream);

            doc.fontSize(20).text(title || "Documento de OpenGravity", { underline: true });
            doc.moveDown();
            doc.fontSize(12).text(content);
            doc.end();

            // Esperar a que el stream termine
            await new Promise((resolve) => stream.on('finish', resolve));
        }

        return {
            status: "success",
            message: `✅ Documento ${type.toUpperCase()} generado con éxito: ${finalFilename}`,
            filePath,
            fileName: finalFilename
        };
    } catch (error: any) {
        console.error("Error generando documento:", error);
        return `❌ Error al generar el documento: ${error.message}`;
    }
}
