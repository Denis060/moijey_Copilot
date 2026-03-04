require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log(`Listing models: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(` - ${m.name}`));
        } else {
            console.log("❌ Failed to list models:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

listModels();
