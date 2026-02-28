import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = (session.user as any).workspace_id;

    const result = await db.query(
        `SELECT
            c.id,
            c.title,
            c.created_at,
            COUNT(m.id)::int AS message_count,
            MAX(m.created_at) AS last_message_at
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.user_id IS NOT DISTINCT FROM $1 AND c.workspace_id IS NOT DISTINCT FROM $2
         GROUP BY c.id
         ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
         LIMIT 30`,
        [userId, workspaceId]
    );

    return NextResponse.json(result.rows);
}
