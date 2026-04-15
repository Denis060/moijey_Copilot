import mammoth from "mammoth";

export const documentParser = {
    /**
     * Parses various file buffers into raw text.
     */
    async parseToText(buffer: Buffer, mimeType: string): Promise<string> {
        switch (mimeType) {
            case "application/pdf":
                const { PDFParse } = await import("pdf-parse");
                const { pathToFileURL } = await import("url");

                // Try to set worker, but handle cases where it's not available (e.g., Vercel serverless)
                try {
                    const workerPath = require.resolve("pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs");
                    PDFParse.setWorker(pathToFileURL(workerPath).href);
                } catch (workerError) {
                    // Worker path not available in this environment - continue without setting it
                    console.warn("PDF worker path not available, parsing may be limited");
                }

                const parser = new PDFParse({ data: buffer as any });
                const pdfData = await parser.getText();
                await parser.destroy();
                return pdfData.text;

            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                const wordData = await mammoth.extractRawText({ buffer });
                return wordData.value;

            case "text/plain":
                return buffer.toString("utf-8");

            default:
                throw new Error(`Unsupported file type: ${mimeType}`);
        }
    },
};
