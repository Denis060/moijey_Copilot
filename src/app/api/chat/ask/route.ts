import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { ragService } from "@/lib/ai/rag-service";

export async function POST(req: Request) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { query, mode, conversationId } = await req.json();

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const { answer, citations, latency_ms, model } = await ragService.getAnswer(
            query,
            session.user.workspace_id,
            mode || "short"
        );

        // 1. Create or verify conversation
        let currentConvId = conversationId;
        if (!currentConvId) {
            const convRes = await db.query(
                "INSERT INTO conversations (user_id, workspace_id, title) VALUES ($1, $2, $3) RETURNING id",
                [session.user.id, session.user.workspace_id, query.substring(0, 50)]
            );
            currentConvId = convRes.rows[0].id;
        }

        // 2. Save Messages
        await db.query(
            "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
            [currentConvId, query]
        );

        await db.query(
            "INSERT INTO messages (conversation_id, role, content, citations, latency_ms, model_used) VALUES ($1, 'assistant', $2, $3, $4, $5)",
            [currentConvId, answer, JSON.stringify(citations), latency_ms, model]
        );

        // 3. Log Audit (selective for core questions)
        await db.query(
            "INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
            [
                session.user.workspace_id,
                session.user.id,
                "ASK_QUESTION",
                "conversation",
                currentConvId,
                JSON.stringify({ query_length: query.length, citations_count: citations.length })
            ]
        );

        return NextResponse.json({
            answer,
            citations,
            conversationId: currentConvId
        });
    } catch (error: any) {
        console.error("Chat Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
