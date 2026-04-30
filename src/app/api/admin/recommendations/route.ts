import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET(req: Request) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim() || "";
    const rep = searchParams.get("rep")?.trim() || "";
    const sentParam = searchParams.get("sent"); // "1" sent, "0" drafts, null all
    const fromIso = searchParams.get("from")?.trim() || "";
    const toIso = searchParams.get("to")?.trim() || "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10) || 25, 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

    // Build the WHERE clauses incrementally so we can reuse the same fragment
    // for the list query and the filtered count.
    const filters: string[] = ["r.workspace_id IS NOT DISTINCT FROM $1"];
    const params: any[] = [workspaceId];
    let p = 2;

    if (q) {
        filters.push(`(r.customer_name ILIKE $${p} OR r.customer_email ILIKE $${p})`);
        params.push(`%${q}%`);
        p++;
    }
    if (rep) {
        filters.push(`u.email ILIKE $${p}`);
        params.push(`%${rep}%`);
        p++;
    }
    if (sentParam === "1") {
        filters.push(`r.email_sent = TRUE`);
    } else if (sentParam === "0") {
        filters.push(`r.email_sent = FALSE`);
    }
    if (fromIso) {
        filters.push(`r.created_at >= $${p}`);
        params.push(fromIso);
        p++;
    }
    if (toIso) {
        filters.push(`r.created_at <= $${p}`);
        params.push(toIso);
        p++;
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    // Page of rows
    const rowsParams = [...params, limit, offset];
    const rows = await db.query(
        `SELECT
            r.id, r.customer_name, r.customer_email, r.product_type,
            r.budget_min, r.budget_max, r.diamond_shape, r.metal, r.style,
            r.timeline, r.notes, r.matched_products, r.email_draft,
            r.email_sent, r.sent_at, r.created_at,
            u.email AS rep_email
         FROM recommendation_requests r
         LEFT JOIN users u ON u.id = r.user_id
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT $${p++} OFFSET $${p++}`,
        rowsParams
    );

    // Filtered total drives pagination.
    const filteredTotal = await db.query(
        `SELECT COUNT(*)::int AS n
         FROM recommendation_requests r
         LEFT JOIN users u ON u.id = r.user_id
         ${whereClause}`,
        params
    );

    // Workspace-wide stats are unfiltered (for the cards at the top).
    const stats = await db.query(
        `SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE email_sent)::int AS sent,
            COUNT(*) FILTER (WHERE NOT email_sent)::int AS drafts,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS this_week
         FROM recommendation_requests
         WHERE workspace_id IS NOT DISTINCT FROM $1`,
        [workspaceId]
    );

    return NextResponse.json({
        requests: rows.rows,
        filtered_total: filteredTotal.rows[0].n,
        stats: stats.rows[0],
    });
}
