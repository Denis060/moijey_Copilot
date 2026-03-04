require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();

async function test(version, model, method) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:${method}?key=${apiKey}`;
    console.log(`Testing: ${url}`);
    try {
        const body = method === 'embedContent'
            ? { content: { parts: [{ text: "Hello world" }] } }
            : { contents: [{ parts: [{ text: "Say hello" }] }] };

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            console.log(`✅ SUCCESS for ${model}`);
        } else {
            console.log(`❌ FAIL for ${model}:`, data.error?.message || JSON.stringify(data));
        }
    } catch (e) {
        console.error(`Fetch Error for ${model}:`, e.message);
    }
}

async function runTests() {
    await test('v1beta', 'text-embedding-004', 'embedContent');
    await test('v1', 'text-embedding-004', 'embedContent');
    await test('v1beta', 'embedding-001', 'embedContent');
    await test('v1beta', 'gemini-1.5-flash', 'generateContent');
}

runTests();
