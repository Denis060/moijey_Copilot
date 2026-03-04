require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
async function listNames() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) {
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log(JSON.stringify(data));
        }
    } catch (e) {
        console.error(e.message);
    }
}
listNames();
