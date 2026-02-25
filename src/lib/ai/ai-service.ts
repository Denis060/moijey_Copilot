import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const aiService = {
    /**
     * Generates a vector embedding for a given text using Gemini.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            const model = genAI.getGenerativeModel({ model: process.env.EMBEDDING_MODEL_ID || "text-embedding-004" });
            const result = await model.embedContent(text);
            const values = result.embedding?.values;

            if (!values) {
                throw new Error("Gemini returned an empty or invalid embedding result.");
            }

            return values;
        } catch (error) {
            console.error("Gemini Embedding Error:", error);
            throw error;
        }
    },

    /**
     * Generates a chat completion based on the provided prompt using Gemini.
     */
    async generateAnswer(prompt: string): Promise<string> {
        try {
            const model = genAI.getGenerativeModel({ model: process.env.COMPLETION_MODEL_ID || "gemini-1.5-pro" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini Generation Error:", error);
            throw error;
        }
    },
};

export default aiService;
