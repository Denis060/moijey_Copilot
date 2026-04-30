import { auth } from "@/auth";
import { db } from "@/lib/db/db-client";
import { ragService, loadConversationHistory } from "@/lib/ai/rag-service";
import { checkRateLimit } from "@/lib/rate-limiter";

export async function POST(req: Request) {
    const session = await auth();
    if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { allowed, retryAfterMs } = checkRateLimit(session.user.id!);
    if (!allowed) {
        return new Response(
            JSON.stringify({ error: "Too many requests. Please wait a moment before asking again." }),
            { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
        );
    }

    try {
        const { query, mode, conversationId } = await req.json();
        if (!query) return new Response(JSON.stringify({ error: "Query is required" }), { status: 400 });

        const userId = session.user.id;
        const workspaceId = (session.user as any).workspace_id;

        // One-time idempotent migration so this route can persist the new "products" column
        // without a separate manual schema change. Cheap on every request, only fires DDL once.
        await db.query(
            `ALTER TABLE messages ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'`
        ).catch(err => console.warn("messages.products schema add warn:", err.message));

        // 1. Run retrieval (embedding + chunks + facts + products), history-load, and
        //    conversation upsert all in parallel. The retrieval doesn't actually need
        //    history; only the final prompt does. Splitting them saves ~100ms of waterfall
        //    latency on multi-turn questions.
        const retrievalPromise = ragService.retrieve(query, workspaceId);
        const historyPromise = conversationId ? loadConversationHistory(conversationId) : Promise.resolve([]);
        const convIdPromise: Promise<string> = conversationId
            ? Promise.resolve(conversationId as string)
            : db.query(
                "INSERT INTO conversations (user_id, workspace_id, title) VALUES ($1, $2, $3) RETURNING id",
                [userId, workspaceId, query.substring(0, 60)]
              ).then(r => r.rows[0].id as string);

        const [retrieved, history, convId] = await Promise.all([retrievalPromise, historyPromise, convIdPromise]);
        const ragResult = ragService.streamFromContext(query, retrieved, history, mode || "short");

        const { citations, lowConfidence, products, tokenStream, model } = ragResult;

        // 2. Save user message (before we start streaming)
        await db.query(
            "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
            [convId, query]
        );

        // 3. Stream tokens to client via SSE
        const encoder = new TextEncoder();
        const ev = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
        const startTime = Date.now();

        const stream = new ReadableStream({
            async start(controller) {
                // Send metadata first so client knows convId + citations + confidence + products immediately
                controller.enqueue(ev({ type: "meta", conversationId: convId, citations, lowConfidence, products }));

                let fullAnswer = "";
                try {
                    for await (const token of tokenStream) {
                        fullAnswer += token;
                        controller.enqueue(ev({ type: "token", text: token }));
                    }
                } catch (err: any) {
                    controller.enqueue(ev({ type: "error", message: err.message }));
                }

                const latency = Date.now() - startTime;

                // Save assistant message + audit log after stream completes
                await db.query(
                    "INSERT INTO messages (conversation_id, role, content, citations, products, latency_ms, model_used) VALUES ($1, 'assistant', $2, $3, $4, $5, $6)",
                    [convId, fullAnswer, JSON.stringify(citations), JSON.stringify(products), latency, model]
                );
                db.query(
                    "INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
                    [workspaceId, userId, "ASK_QUESTION", "conversation", convId,
                     JSON.stringify({ query_length: query.length, citations_count: citations.length, latency_ms: latency })]
                ).catch((err: Error) => console.error("Audit log failed:", err.message));

                controller.enqueue(ev({ type: "done" }));
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error: any) {
        console.error("Chat Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
