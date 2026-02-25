import mammoth from "mammoth";

export const documentParser = {
    /**
     * Parses various file buffers into raw text.
     */
    async parseToText(buffer: Buffer, mimeType: string): Promise<string> {
        switch (mimeType) {
            case "application/pdf":
                const pdf = (await import("pdf-parse")) as any;
                const pdfData = await (pdf.default || pdf)(buffer);
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
