const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function testChat() {
    console.log("--- Gemini Chat Test ---");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use flash as it's faster
        const result = await model.generateContent("Say hello");
        const response = await result.response;
        console.log("✅ Gemini Chat SUCCESS:", response.text());
    } catch (err) {
        console.error("❌ Gemini Chat Test FAILED:");
        console.error(err.message);
    }
}

testChat();
