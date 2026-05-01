import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

/**
 * POST /api/messages/[id]/feedback
 * Body: { vote: "up" | "down" | null }
 *
 * Lets a rep flag whether the AI's answer was helpful. Stored as smallint
 * (1 / -1 / null) on the messages row plus a timestamp. Idempotent — sending
 * the same vote again is a no-op; sending null clears the vote.
 *
 * The rep can only vote on messages from their own conversations (ownership
 * check via the conversations.user_id join below).
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const vote = (body as { vote?: string | null }).vote ?? null;

    let voteValue: number | null;
    if (vote === "up") voteValue = 1;
    else if (vote === "down") voteValue = -1;
    else if (vote === null) voteValue = null;
    else return NextResponse.json({ error: "vote must be 'up', 'down', or null" }, { status: 400 });

    // Make sure the columns exist (idempotent ALTER, same pattern as the chat route).
    await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback SMALLINT`)
        .catch(err => console.warn("messages.feedback schema add warn:", err.message));
    await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ`)
        .catch(err => console.warn("messages.feedback_at schema add warn:", err.message));

    // Verify ownership and only allow voting on assistant messages.
    const userId = (session.user as any).id;
    const result = await db.query(
        `UPDATE messages
         SET feedback = $1, feedback_at = CASE WHEN $1 IS NULL THEN NULL ELSE NOW() END
         WHERE id = $2
           AND role = 'assistant'
           AND conversation_id IN (SELECT id FROM conversations WHERE user_id = $3)
         RETURNING id, feedback, feedback_at`,
        [voteValue, id, userId]
    );

    if (result.rowCount === 0) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
}
