import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET(req: Request) {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = (session.user as any).workspace_id;

    // Idempotent: make sure archived_at exists before we filter on it.
    await db.query(
        `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`
    ).catch(err => console.warn("conversations.archived_at schema add warn:", err.message));

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "1" || searchParams.get("archived") === "true";

    const archivedFilter = includeArchived
        ? "AND c.archived_at IS NOT NULL"
        : "AND c.archived_at IS NULL";

    const result = await db.query(
        `SELECT
            c.id,
            c.title,
            c.created_at,
            c.archived_at,
            COUNT(m.id)::int AS message_count,
            MAX(m.created_at) AS last_message_at
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.user_id IS NOT DISTINCT FROM $1
           AND c.workspace_id IS NOT DISTINCT FROM $2
           ${archivedFilter}
         GROUP BY c.id
         ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
         LIMIT 100`,
        [userId, workspaceId]
    );

    return NextResponse.json(result.rows);
}
