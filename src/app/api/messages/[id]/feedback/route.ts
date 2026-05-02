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
    try {
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
        // Cast $2 → uuid explicitly to avoid Postgres treating a TEXT param as a different
        // type; same for the user_id subquery comparison. Without these the parameterized
        // query can hit "operator does not exist: uuid = text" on some Postgres versions.
        const userId = (session.user as any).id;
        if (!userId) {
            console.error("Feedback: session has no user.id");
            return NextResponse.json({ error: "Session missing user id" }, { status: 401 });
        }

        const result = await db.query(
            `UPDATE messages
             SET feedback = $1, feedback_at = CASE WHEN $1::smallint IS NULL THEN NULL ELSE NOW() END
             WHERE id = $2::uuid
               AND role = 'assistant'
               AND conversation_id IN (SELECT id FROM conversations WHERE user_id = $3::uuid)
             RETURNING id, feedback, feedback_at`,
            [voteValue, id, userId]
        );

        if (result.rowCount === 0) {
            // Diagnose: is the message missing entirely, or is it just not the rep's?
            const exists = await db.query("SELECT role, conversation_id FROM messages WHERE id = $1::uuid", [id]);
            if (exists.rowCount === 0) {
                console.error(`Feedback: message id not found: ${id}`);
                return NextResponse.json({ error: "Message not found" }, { status: 404 });
            }
            console.error(`Feedback: message ${id} exists but not owned by user ${userId} (role=${exists.rows[0].role})`);
            return NextResponse.json({ error: "You can only vote on your own conversations" }, { status: 403 });
        }

        return NextResponse.json(result.rows[0]);
    } catch (err: any) {
        console.error("Feedback route exception:", err);
        return NextResponse.json(
            { error: err?.message || "Server error recording feedback" },
            { status: 500 }
        );
    }
}
