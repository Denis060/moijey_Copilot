import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { title } = await req.json();

    if (!title?.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const result = await db.query(
        `UPDATE conversations SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING id, title`,
        [title.trim(), id, session.user.id]
    );

    if (result.rowCount === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
}
