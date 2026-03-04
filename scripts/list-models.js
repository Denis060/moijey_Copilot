const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    console.log("--- Listing Gemini Models ---");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    try {
        // There isn't a direct listModels method on genAI, but we can try to hit a known model or use the REST API if needed
        // However, usually we can just try 'embedding-001' which is very common

        console.log("Trying 'embedding-001'...");
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent("test");
        console.log("✅ 'embedding-001' works! Vector length:", result.embedding.values.length);

    } catch (err) {
        console.error("❌ 'embedding-001' failed:", err.message);

        try {
            console.log("Trying 'text-embedding-004' again with 'models/' prefix...");
            const model = genAI.getGenerativeModel({ model: "models/text-embedding-004" });
            const result = await model.embedContent("test");
            console.log("✅ 'models/text-embedding-004' works! Vector length:", result.embedding.values.length);
        } catch (err2) {
            console.error("❌ 'models/text-embedding-004' failed:", err2.message);
        }
    }
}

listModels();
