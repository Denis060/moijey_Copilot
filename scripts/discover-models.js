const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listAllModels() {
    console.log("--- Listing All Available Gemini Models ---");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

    try {
        // The SDK doesn't have a direct 'listModels' in the GenAI class usually,
        // it's often done via the rest API or a specific client.
        // But we can try a few common ones to see what sticks.

        const testModels = [
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "text-embedding-004",
            "embedding-001",
            "gemini-pro",
            "gemini-pro-vision"
        ];

        for (const m of testModels) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                // Try a very small generation or embedding to see if it exists
                if (m.includes("embedding")) {
                    await model.embedContent("test");
                } else {
                    await model.generateContent("test");
                }
                console.log(`✅ Model found and supported: ${m}`);
            } catch (e) {
                console.log(`❌ Model not found or not supported: ${m} (${e.message})`);
            }
        }
    } catch (err) {
        console.error("Fatal error:", err.message);
    }
}

listAllModels();
