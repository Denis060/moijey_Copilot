import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || (role !== "admin" && role !== "manager")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;

    const [today, week, totalUsers, repActivity, recentQuestions] = await Promise.all([
        // Consultations started today
        db.query(
            `SELECT COUNT(*) as total FROM conversations
             WHERE workspace_id = $1 AND created_at >= NOW()::date`,
            [workspaceId]
        ),
        // Consultations started this week
        db.query(
            `SELECT COUNT(*) as total FROM conversations
             WHERE workspace_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
            [workspaceId]
        ),
        // Total active team members
        db.query(
            `SELECT COUNT(*) as total FROM users
             WHERE workspace_id = $1 AND is_active = true`,
            [workspaceId]
        ),
        // Per-rep consultation counts (today + this week)
        db.query(
            `SELECT
                u.email,
                COUNT(c.id) FILTER (WHERE c.created_at >= NOW()::date) AS conversations_today,
                COUNT(c.id) FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days') AS conversations_week
             FROM users u
             LEFT JOIN conversations c ON c.user_id = u.id AND c.workspace_id = $1
             WHERE u.workspace_id = $1 AND u.is_active = true
             GROUP BY u.id, u.email
             ORDER BY conversations_week DESC`,
            [workspaceId]
        ),
        // Last 15 client questions across all reps
        db.query(
            `SELECT m.content, m.created_at, u.email as rep_email
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             JOIN users u ON c.user_id = u.id
             WHERE c.workspace_id = $1 AND m.role = 'user'
             ORDER BY m.created_at DESC
             LIMIT 15`,
            [workspaceId]
        ),
    ]);

    const activeRepsToday = repActivity.rows.filter(
        (r: any) => parseInt(r.conversations_today) > 0
    ).length;

    return NextResponse.json({
        totalConsultationsToday: parseInt(today.rows[0].total),
        totalConsultationsWeek: parseInt(week.rows[0].total),
        activeRepsToday,
        totalUsers: parseInt(totalUsers.rows[0].total),
        repActivity: repActivity.rows.map((r: any) => ({
            email: r.email,
            conversations_today: parseInt(r.conversations_today),
            conversations_week: parseInt(r.conversations_week),
        })),
        recentQuestions: recentQuestions.rows,
    });
}
