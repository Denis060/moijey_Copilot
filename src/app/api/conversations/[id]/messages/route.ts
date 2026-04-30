import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as any).id;

    // Verify the conversation belongs to this user
    const convRes = await db.query(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        [id, userId]
    );

    if (!convRes.rows.length) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Idempotent: make sure the products column exists before SELECTing it.
    // Same one-time ALTER pattern used in /api/chat/ask and /api/knowledge/upload.
    await db.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'`
    ).catch(err => console.warn("messages.products schema add warn:", err.message));

    // products column was added later — coalesce missing values to empty array so old rows still load.
    const messages = await db.query(
        `SELECT id, role, content, citations, COALESCE(products, '[]'::jsonb) AS products, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [id]
    );

    return NextResponse.json(messages.rows);
}
