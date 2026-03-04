const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testSDKV1Beta() {
    // Force v1beta via options
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const testModel = "embedding-001";

    console.log(`Testing SDK with model ${testModel} and v1beta...`);
    try {
        // In recent versions of the SDK, you can specify the apiVersion in the config
        const model = genAI.getGenerativeModel({ model: testModel }, { apiVersion: 'v1beta' });
        const result = await model.embedContent("test");
        console.log(`✅ ${testModel} WORKS in SDK with v1beta!`);
    } catch (e) {
        console.log(`❌ ${testModel} FAILS in SDK with v1beta: ${e.message}`);
    }
}

testSDKV1Beta();
