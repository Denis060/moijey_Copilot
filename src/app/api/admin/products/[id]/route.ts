import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const result = await db.query("DELETE FROM products WHERE id = $1 RETURNING product_id", [id]);
    if (!result.rowCount) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const workspaceId = (session.user as any).workspace_id;
    await db.query(
        `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, (session.user as any).id, "DELETE_PRODUCT", "product", id,
         JSON.stringify({ product_id: result.rows[0].product_id })]
    ).catch(() => {});

    return NextResponse.json({ success: true });
}
