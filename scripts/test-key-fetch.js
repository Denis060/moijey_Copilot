require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
console.log(`Key length: ${apiKey.length}`);
console.log(`First 5: ${apiKey.substring(0, 5)}`);
console.log(`Last 5: ${apiKey.substring(apiKey.length - 5)}`);

async function testFetch() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: { parts: [{ text: "Hello world" }] } })
        });
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

testFetch();
