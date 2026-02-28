import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;

    const [docs, chunks, facts, users, convs, activity] = await Promise.all([
        db.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed FROM documents WHERE workspace_id = $1", [workspaceId]),
        db.query("SELECT COUNT(*) as total FROM document_chunks dc JOIN documents d ON dc.document_id = d.id WHERE d.workspace_id = $1", [workspaceId]),
        db.query("SELECT COUNT(*) as total FROM business_facts WHERE workspace_id = $1", [workspaceId]),
        db.query("SELECT COUNT(*) as total FROM users WHERE workspace_id = $1 AND is_active = true", [workspaceId]),
        db.query("SELECT COUNT(*) as total FROM conversations WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '7 days'", [workspaceId]),
        db.query(
            `SELECT al.id, al.action, al.resource_type, al.details, al.created_at, u.email as user_email
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.workspace_id = $1
             ORDER BY al.created_at DESC
             LIMIT 10`,
            [workspaceId]
        ),
    ]);

    return NextResponse.json({
        totalDocs: parseInt(docs.rows[0].total),
        completedDocs: parseInt(docs.rows[0].completed),
        totalChunks: parseInt(chunks.rows[0].total),
        totalFacts: parseInt(facts.rows[0].total),
        totalUsers: parseInt(users.rows[0].total),
        conversationsThisWeek: parseInt(convs.rows[0].total),
        recentActivity: activity.rows,
    });
}
