import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await db.query(
        `SELECT id, title, content, citations, created_at
         FROM saved_responses
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [session.user.id]
    );

    return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, content, citations } = await req.json();
    if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });

    const result = await db.query(
        `INSERT INTO saved_responses (user_id, title, content, citations)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title, content, citations, created_at`,
        [session.user.id, title || content.substring(0, 60), content, JSON.stringify(citations ?? [])]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
}
