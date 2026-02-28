import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as any).workspace_id;

    const result = await db.query(
        "DELETE FROM business_facts WHERE id = $1 AND workspace_id = $2 RETURNING id",
        [id, workspaceId]
    );

    if (!result.rows.length) {
        return NextResponse.json({ error: "Fact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
