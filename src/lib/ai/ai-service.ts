import { TtlCache } from "@/lib/cache";

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || "").trim();

// Cache query embeddings for 10 minutes — same query won't re-embed on repeated asks
const embeddingCache = new TtlCache<string, number[]>(10 * 60 * 1000);

export const aiService = {
    /**
     * Generates a vector embedding for a given text using Gemini via raw fetch.
     * Results are cached in-process for 10 minutes to avoid redundant API calls.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const modelId = process.env.EMBEDDING_MODEL_ID || "embedding-001";
        const cacheKey = `${modelId}:${text}`;
        const cached = embeddingCache.get(cacheKey);
        if (cached) return cached;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:embedContent?key=${GEMINI_API_KEY}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: { parts: [{ text }] }
                })
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("Gemini Embedding Fetch Error:", data.error || data);
                throw new Error(data.error?.message || "Failed to generate embedding");
            }

            const values = data.embedding?.values;
            if (!values) {
                throw new Error("Gemini returned an empty or invalid embedding result.");
            }

            embeddingCache.set(cacheKey, values);
            return values;
        } catch (error: any) {
            console.error("Gemini Embedding Exception:", error.message);
            throw error;
        }
    },

    /**
     * Generates a chat completion based on the provided prompt using Gemini via raw fetch.
     */
    async generateAnswer(prompt: string): Promise<string> {
        const modelId = process.env.COMPLETION_MODEL_ID || "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await res.json();

            if (!res.ok) {
                console.error("Gemini Generation Fetch Error:", data.error || data);
                throw new Error(data.error?.message || "Failed to generate answer");
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Gemini returned an empty completion result.");
            }

            return text;
        } catch (error: any) {
            console.error("Gemini Generation Exception:", error.message);
            throw error;
        }
    },

    /**
     * Streams a chat completion token-by-token using Gemini's streamGenerateContent SSE endpoint.
     * Yields text tokens as they arrive.
     */
    async *generateAnswerStream(prompt: string): AsyncGenerator<string> {
        const modelId = process.env.COMPLETION_MODEL_ID || "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!res.ok || !res.body) {
            const errData = await res.json().catch(() => ({}));
            throw new Error((errData as any).error?.message || "Failed to stream answer");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === "[DONE]") continue;
                try {
                    const data = JSON.parse(jsonStr);
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) yield text;
                } catch { /* skip malformed SSE lines */ }
            }
        }
    },
};

export default aiService;
