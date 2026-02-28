import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import bcrypt from "bcryptjs";

export async function GET() {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;

    const result = await db.query(
        `SELECT u.id, u.email, r.name as role, u.is_active, u.created_at
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.workspace_id = $1
         ORDER BY u.created_at DESC`,
        [workspaceId]
    );

    return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = (session.user as any).workspace_id;
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
        return NextResponse.json({ error: "Email, password, and role are required" }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Check email not already taken
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    // Resolve role ID
    const roleRes = await db.query("SELECT id FROM roles WHERE name = $1", [role]);
    if (!roleRes.rows.length) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
        `INSERT INTO users (workspace_id, email, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        [workspaceId, email.toLowerCase().trim(), passwordHash, roleRes.rows[0].id]
    );

    // Audit log
    await db.query(
        `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, session.user.id, "CREATE_USER", "user", result.rows[0].id, JSON.stringify({ email, role })]
    );

    return NextResponse.json({ success: true, userId: result.rows[0].id }, { status: 201 });
}
