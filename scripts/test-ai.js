const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testAI() {
    console.log("--- Gemini AI Embedding Test ---");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    try {
        const modelId = process.env.EMBEDDING_MODEL_ID || "text-embedding-004";
        console.log(`Using model: ${modelId}`);
        const model = genAI.getGenerativeModel({ model: modelId });

        const result = await model.embedContent("Hello world verification");
        const values = result.embedding?.values;

        if (values) {
            console.log("✅ Gemini Embedding SUCCESS. Vector length:", values.length);
        } else {
            console.error("❌ Gemini returned empty values.");
        }
    } catch (err) {
        console.error("❌ Gemini AI Test FAILED:");
        console.error(JSON.stringify(err, null, 2));
        console.error(err.message);
    }
}

testAI();
