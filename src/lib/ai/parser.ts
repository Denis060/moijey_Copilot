import mammoth from "mammoth";

export const documentParser = {
    /**
     * Parses various file buffers into raw text.
     */
    async parseToText(buffer: Buffer, mimeType: string): Promise<string> {
        switch (mimeType) {
            case "application/pdf":
                const { PDFParse } = await import("pdf-parse");
                const path = await import("path");
                const { pathToFileURL } = await import("url");

                // Set worker to an absolute local file URL for robustness in Node environments
                const workerPath = path.resolve("node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs");
                PDFParse.setWorker(pathToFileURL(workerPath).href);

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
