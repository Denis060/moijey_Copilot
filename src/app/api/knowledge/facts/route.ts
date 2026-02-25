import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";

export async function GET() {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const result = await db.query(
            "SELECT id, key, value, category FROM business_facts WHERE workspace_id = $1 ORDER BY key ASC",
            [session.user.workspace_id]
        );
        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch facts" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { key, value, category } = await req.json();

        if (!key || !value) {
            return NextResponse.json({ error: "Key and Value are required" }, { status: 400 });
        }

        await db.query(
            `INSERT INTO business_facts (workspace_id, key, value, category) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (workspace_id, key) DO UPDATE SET value = $3, category = $4, updated_at = NOW()`,
            [session.user.workspace_id, key, value, category || "General"]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to save fact" }, { status: 500 });
    }
}
