const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testSDKPrefix() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const testModels = ["embedding-001", "models/embedding-001"];

    for (const m of testModels) {
        console.log(`Testing SDK with model: ${m}`);
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.embedContent("test");
            console.log(`✅ ${m} WORKS in SDK!`);
        } catch (e) {
            console.log(`❌ ${m} FAILS in SDK: ${e.message}`);
        }
    }
}

testSDKPrefix();
