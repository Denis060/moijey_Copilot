import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as any).workspace_id;
    const body = await req.json();

    // Only allow toggling is_active, role, and password (admin only)
    const updates: string[] = [];
    const values: any[] = [];

    if (typeof body.is_active === "boolean") {
        values.push(body.is_active);
        updates.push(`is_active = $${values.length}`);
    }

    if (body.role) {
        const roleRes = await db.query("SELECT id FROM roles WHERE name = $1", [body.role]);
        if (!roleRes.rows.length) {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        values.push(roleRes.rows[0].id);
        updates.push(`role_id = $${values.length}`);
    }

    if (body.password) {
        if (body.password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }
        const hash = await bcrypt.hash(body.password, 12);
        values.push(hash);
        updates.push(`password_hash = $${values.length}`);
    }

    if (!updates.length) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    values.push(id, workspaceId);
    const result = await db.query(
        `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length - 1} AND workspace_id = $${values.length} RETURNING id`,
        values
    );

    if (!result.rows.length) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const workspaceId = (session.user as any).workspace_id;

    // Prevent self-deletion
    if (id === session.user.id) {
        return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    const result = await db.query(
        "DELETE FROM users WHERE id = $1 AND workspace_id = $2 RETURNING id, email",
        [id, workspaceId]
    );

    if (!result.rows.length) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Audit log
    await db.query(
        `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, session.user.id, "DELETE_USER", "user", id, JSON.stringify({ email: result.rows[0].email })]
    );

    return NextResponse.json({ success: true });
}
