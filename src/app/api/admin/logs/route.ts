import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;

    const result = await db.query(
        `SELECT al.id, al.action, al.resource_type, al.resource_id, al.details, al.created_at, u.email as user_email
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.workspace_id = $1
         ORDER BY al.created_at DESC
         LIMIT 100`,
        [workspaceId]
    );

    return NextResponse.json(result.rows);
}
