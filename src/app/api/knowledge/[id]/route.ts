import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { storageService } from "@/lib/storage";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    console.log("DELETE /api/knowledge/[id] - ID:", id);
    const session = await auth();

    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 1. Get the document details to find the file path
        // Removing workspace_id check here to handle potential mismatches if user is verified admin
        const docRes = await db.query(
            "SELECT file_path, storage_bucket FROM documents WHERE id = $1",
            [id]
        );

        if (docRes.rows.length === 0) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const { file_path, storage_bucket } = docRes.rows[0];

        // 2. Delete from Storage
        try {
            await storageService.deleteFile(file_path, storage_bucket);
        } catch (storageError: any) {
            console.warn(`Could not delete file from storage: ${file_path}`, storageError.message);
            // We continue even if storage deletion fails, to ensure DB cleanup
        }

        // 3. Delete from DB
        await db.query(
            "DELETE FROM documents WHERE id = $1",
            [id]
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Error:", error);
        return NextResponse.json({
            error: "Failed to delete document",
            details: error.message
        }, { status: 500 });
    }
}
