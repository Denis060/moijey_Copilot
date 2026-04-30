import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;

    // Make sure low_confidence column exists before we query it.
    // Cheap idempotent DDL — fires once, no-ops thereafter.
    await db.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS low_confidence BOOLEAN DEFAULT FALSE`
    ).catch(err => console.warn("messages.low_confidence schema add warn:", err.message));

    const [
        docs, chunks, facts, users,
        products, recommendations,
        consultThisWeek, consultLastWeek,
        recsThisWeek, recsLastWeek,
        topReps, topProducts,
        lowConfidence, totalAssistantMessages,
        activity,
    ] = await Promise.all([
        // Knowledge
        db.query(
            `SELECT COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE status = 'completed')::int as completed
             FROM documents WHERE workspace_id = $1`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int as total
             FROM document_chunks dc
             JOIN documents d ON dc.document_id = d.id
             WHERE d.workspace_id = $1`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int as total FROM business_facts WHERE workspace_id = $1`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int as total FROM users WHERE workspace_id = $1 AND is_active = TRUE`,
            [workspaceId]
        ),

        // Catalog (products are workspace-agnostic in current schema)
        db.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE in_stock)::int AS in_stock,
                    COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
             FROM products`
        ),

        // Recommendations totals
        db.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE email_sent)::int AS sent
             FROM recommendation_requests
             WHERE workspace_id = $1`,
            [workspaceId]
        ),

        // Week-over-week consultation comparison
        db.query(
            `SELECT COUNT(*)::int AS total FROM conversations
             WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int AS total FROM conversations
             WHERE workspace_id = $1
               AND created_at > NOW() - INTERVAL '14 days'
               AND created_at <= NOW() - INTERVAL '7 days'`,
            [workspaceId]
        ),

        // Week-over-week recommendation comparison
        db.query(
            `SELECT COUNT(*)::int AS total FROM recommendation_requests
             WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '7 days'`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int AS total FROM recommendation_requests
             WHERE workspace_id = $1
               AND created_at > NOW() - INTERVAL '14 days'
               AND created_at <= NOW() - INTERVAL '7 days'`,
            [workspaceId]
        ),

        // Top reps this week (most consultations + most recommendations combined)
        db.query(
            `SELECT u.email,
                    COUNT(DISTINCT c.id)::int AS conversations,
                    COUNT(DISTINCT r.id)::int AS recommendations
             FROM users u
             LEFT JOIN conversations c ON c.user_id = u.id
                AND c.created_at > NOW() - INTERVAL '7 days'
                AND c.workspace_id = $1
             LEFT JOIN recommendation_requests r ON r.user_id = u.id
                AND r.created_at > NOW() - INTERVAL '7 days'
                AND r.workspace_id = $1
             WHERE u.workspace_id = $1 AND u.is_active = TRUE
             GROUP BY u.id, u.email
             HAVING COUNT(DISTINCT c.id) + COUNT(DISTINCT r.id) > 0
             ORDER BY (COUNT(DISTINCT c.id) + COUNT(DISTINCT r.id)) DESC
             LIMIT 5`,
            [workspaceId]
        ),

        // Most-recommended products this week (unnest matched_products JSONB)
        db.query(
            `SELECT prod->>'product_id' AS product_id,
                    prod->>'title' AS title,
                    MIN(prod->>'image_url') AS image_url,
                    MIN(prod->>'shopify_url') AS shopify_url,
                    COUNT(*)::int AS times_recommended
             FROM recommendation_requests r,
                  jsonb_array_elements(r.matched_products) prod
             WHERE r.workspace_id = $1
               AND r.created_at > NOW() - INTERVAL '7 days'
               AND prod->>'title' IS NOT NULL
             GROUP BY prod->>'product_id', prod->>'title'
             ORDER BY COUNT(*) DESC
             LIMIT 5`,
            [workspaceId]
        ),

        // Low-confidence count (last 30 days — limits noise from tiny samples)
        db.query(
            `SELECT COUNT(*)::int AS total
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE c.workspace_id = $1
               AND m.role = 'assistant'
               AND m.low_confidence = TRUE
               AND m.created_at > NOW() - INTERVAL '30 days'`,
            [workspaceId]
        ),
        db.query(
            `SELECT COUNT(*)::int AS total
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE c.workspace_id = $1
               AND m.role = 'assistant'
               AND m.created_at > NOW() - INTERVAL '30 days'`,
            [workspaceId]
        ),

        // Recent activity (audit log) — return details so the UI can show specifics.
        db.query(
            `SELECT al.id, al.action, al.resource_type, al.resource_id, al.details, al.created_at,
                    u.email AS user_email
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.workspace_id = $1
             ORDER BY al.created_at DESC
             LIMIT 12`,
            [workspaceId]
        ),
    ]);

    const consultDelta = pctDelta(consultThisWeek.rows[0].total, consultLastWeek.rows[0].total);
    const recsDelta = pctDelta(recsThisWeek.rows[0].total, recsLastWeek.rows[0].total);
    const lcRate = totalAssistantMessages.rows[0].total > 0
        ? Math.round((lowConfidence.rows[0].total / totalAssistantMessages.rows[0].total) * 100)
        : 0;

    return NextResponse.json({
        // Knowledge
        totalDocs: docs.rows[0].total,
        completedDocs: docs.rows[0].completed,
        totalChunks: chunks.rows[0].total,
        totalFacts: facts.rows[0].total,

        // People
        totalUsers: users.rows[0].total,

        // Catalog
        totalProducts: products.rows[0].total,
        inStockProducts: products.rows[0].in_stock,
        embeddedProducts: products.rows[0].embedded,

        // Recommendations
        totalRecommendations: recommendations.rows[0].total,
        sentRecommendations: recommendations.rows[0].sent,

        // Activity (this week + WoW deltas; null delta means no baseline)
        conversationsThisWeek: consultThisWeek.rows[0].total,
        conversationsLastWeek: consultLastWeek.rows[0].total,
        consultationsDeltaPct: consultDelta,
        recsThisWeek: recsThisWeek.rows[0].total,
        recsLastWeek: recsLastWeek.rows[0].total,
        recsDeltaPct: recsDelta,

        // Quality signal (last 30 days)
        lowConfidenceCount: lowConfidence.rows[0].total,
        totalAssistantMessages: totalAssistantMessages.rows[0].total,
        lowConfidenceRatePct: lcRate,

        // Leaderboards
        topReps: topReps.rows,
        topProducts: topProducts.rows,

        recentActivity: activity.rows,
    });
}

/** Percentage change of `current` vs `previous`. Returns null when there's no baseline
 * (avoids divide-by-zero and fake "+∞%" deltas — UI displays "—" for null). */
function pctDelta(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? null : 0;
    return Math.round(((current - previous) / previous) * 100);
}
