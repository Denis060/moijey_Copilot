import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

/**
 * PATCH /api/conversations/[id]
 * Body may include any subset of:
 *   - title:    string  → rename the consultation
 *   - archived: boolean → archive (true) or restore (false). Archived
 *                         consultations vanish from the rep's sidebar but
 *                         remain visible to admins via /admin/logs and the
 *                         conversation can be restored by the same rep.
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { title, archived } = body as { title?: string; archived?: boolean };

    if (typeof title !== "string" && typeof archived !== "boolean") {
        return NextResponse.json({ error: "Nothing to update — provide title or archived" }, { status: 400 });
    }

    // Idempotent: make sure archived_at exists. Cheap on every request, only fires DDL once.
    await db.query(
        `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`
    ).catch(err => console.warn("conversations.archived_at schema add warn:", err.message));

    const userId = session.user.id;
    const workspaceId = (session.user as any).workspace_id;

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (typeof title === "string") {
        if (!title.trim()) {
            return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
        }
        sets.push(`title = $${i++}`);
        values.push(title.trim());
    }
    if (typeof archived === "boolean") {
        sets.push(`archived_at = $${i++}`);
        values.push(archived ? new Date() : null);
    }

    values.push(id);
    values.push(userId);

    const result = await db.query(
        `UPDATE conversations SET ${sets.join(", ")}
         WHERE id = $${i++} AND user_id = $${i++}
         RETURNING id, title, archived_at`,
        values
    );

    if (result.rowCount === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Audit any archive flip. Title-only changes (renames) are noisy and not logged today.
    if (typeof archived === "boolean") {
        await db.query(
            `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                workspaceId,
                userId,
                archived ? "ARCHIVE_CONVERSATION" : "UNARCHIVE_CONVERSATION",
                "conversation",
                id,
                JSON.stringify({ title: result.rows[0].title }),
            ]
        ).catch((err: Error) => console.error("Audit log failed:", err.message));
    }

    return NextResponse.json(result.rows[0]);
}
