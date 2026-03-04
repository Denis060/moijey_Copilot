require('dotenv').config();
const apiKey = (process.env.GEMINI_API_KEY || "").trim();

async function findWorkingPair() {
    console.log("--- Comprehensive Model Testing ---");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.models) {
        console.log("❌ No models found or key invalid.");
        return;
    }

    const embedCandidates = data.models.filter(m => m.supportedGenerationMethods.includes("embedContent"));
    const chatCandidates = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

    console.log(`Found ${embedCandidates.length} embed candidates and ${chatCandidates.length} chat candidates.`);

    let workingEmbed = null;
    for (const m of embedCandidates) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${m.name}:embedContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: { parts: [{ text: "test" }] } })
            });
            const d = await r.json();
            if (d.embedding) {
                console.log(`✅ ${m.name} WORKS!`);
                workingEmbed = m.name;
                break;
            } else {
                console.log(`❌ ${m.name} FAILED: ${d.error?.message}`);
            }
        } catch (e) {
            console.log(`❌ ${m.name} CRASHED: ${e.message}`);
        }
    }

    let workingChat = null;
    for (const m of chatCandidates) {
        try {
            const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/${m.name}:generateContent?key=${apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
            });
            const d = await r.json();
            if (d.candidates) {
                console.log(`✅ ${m.name} WORKS!`);
                workingChat = m.name;
                break;
            } else {
                console.log(`❌ ${m.name} FAILED: ${d.error?.message}`);
            }
        } catch (e) {
            console.log(`❌ ${m.name} CRASHED: ${e.message}`);
        }
    }

    if (workingEmbed && workingChat) {
        const results = `EMBEDDING_MODEL_ID="${workingEmbed.replace('models/', '')}"\nCOMPLETION_MODEL_ID="${workingChat.replace('models/', '')}"`;
        require('fs').writeFileSync('working_models.txt', results);
        console.log("\n--- CONFIGURATION RECOVERY WRITTEN TO working_models.txt ---");
    }
    else {
        console.log("\n❌ Could not find a fully working pair.");
    }
}

findWorkingPair();
