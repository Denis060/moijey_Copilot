require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();

async function findEmbedModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
            const embedModels = data.models.filter(m => m.name.includes("embed") || m.name.includes("embedding"));
            console.log("--- Found Embedding Models ---");
            embedModels.forEach(m => console.log(m.name));

            const chatModels = data.models.filter(m => m.name.includes("gemini") && !m.name.includes("embed"));
            console.log("\n--- Found Chat Models ---");
            chatModels.forEach(m => console.log(m.name));
        } else {
            console.log("❌ Failed:", data.error?.message);
        }
    } catch (e) {
        console.error(e.message);
    }
}

findEmbedModels();
