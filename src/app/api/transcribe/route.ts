import { auth } from "@/auth";
import { aiService } from "@/lib/ai/ai-service";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap (~30s of 16kHz mono WAV)

export async function POST(req: Request) {
    const session = await auth();
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    try {
        const form = await req.formData();
        const file = form.get("audio");
        if (!(file instanceof Blob)) {
            return new Response(JSON.stringify({ error: "Missing audio file" }), { status: 400 });
        }
        if (file.size === 0) {
            return new Response(JSON.stringify({ error: "Empty audio file" }), { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return new Response(JSON.stringify({ error: "Audio too large (max 5MB)" }), { status: 413 });
        }

        const mime = file.type || "audio/wav";
        const bytes = new Uint8Array(await file.arrayBuffer());
        const text = await aiService.transcribeAudio(bytes, mime);

        return new Response(JSON.stringify({ text }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Transcribe Error:", error);
        return new Response(JSON.stringify({ error: error.message || "Transcription failed" }), { status: 500 });
    }
}
