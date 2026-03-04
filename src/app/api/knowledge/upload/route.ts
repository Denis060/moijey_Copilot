import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { documentParser } from "@/lib/ai/parser";
import { ingestionService } from "@/lib/ai/ingestion-service";
import { storageService } from "@/lib/storage";

export const maxDuration = 300; // Allow up to 5 mins for processing large files

export async function POST(req: Request) {
    console.log("POST /api/knowledge/upload - Request received");
    const session = await auth();
    console.log("POST /api/knowledge/upload - Session:", session?.user?.email);

    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        console.log("-> Start Post Upload Processing");
        // One-time schema check to ensure storage_bucket exists
        await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'moijey-docs';`).catch(err => {
            console.warn("-> Schema Alter Warn (May already exist):", err.message);
        });

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const title = formData.get("title") as string || file.name;
        const category = formData.get("category") as string || "General";

        if (!file) {
            console.log("-> No file provided");
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        console.log(`-> Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
        const buffer = Buffer.from(await file.arrayBuffer());

        // 1. Upload to Supabase Storage
        const workspaceId = session.user.workspace_id;
        const filePath = `documents/${workspaceId}/${Date.now()}_${file.name}`;
        console.log(`-> Storage Upload Target: ${filePath}`);

        let storageResult;
        try {
            storageResult = await storageService.uploadFile(buffer, filePath, file.type);
            console.log(`-> Storage Upload Success: ${storageResult.path}`);
        } catch (storageError: any) {
            console.error("-> Storage Upload FAIL:", storageError);
            return NextResponse.json({
                error: "Storage upload failed. Ensure 'moijey-docs' bucket exists and permissions are correct.",
                details: storageError.message
            }, { status: 500 });
        }

        // 2. Parse Text
        console.log("-> Starting Document Parsing...");
        let text = "";
        try {
            text = await documentParser.parseToText(buffer, file.type);
            console.log(`-> Parsing Success. Text length: ${text.length}`);
        } catch (parseError: any) {
            console.error("-> Parsing FAIL:", parseError);
            return NextResponse.json({
                error: "Document parsing failed. The file may be corrupt or too large.",
                details: parseError.message
            }, { status: 500 });
        }

        // 3. Create Document Record
        console.log("-> Creating DB Document Record...");
        const docRes = await db.query(
            `INSERT INTO documents (workspace_id, title, file_path, content_type, category, uploaded_by, storage_bucket) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [workspaceId, title, filePath, file.type, category, session.user.id, storageResult.bucket]
        );

        const docId = docRes.rows[0].id;
        console.log(`-> DB Record Created: ${docId}`);

        // 4. Start Ingestion
        console.log("-> Triggering Async Ingestion...");
        ingestionService.processDocument(docId, text)
            .then(res => console.log(`-> Ingestion SUCCESS for ${docId}:`, res))
            .catch(err => {
                console.error(`-> Ingestion FAIL (Async) for ${docId}:`, err);
                // We should also log this to a system log or update the DB status if not already handled
            });

        // 5. Log Audit
        await db.query(
            `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [workspaceId, session.user.id, "UPLOAD_DOC", "document", docId, JSON.stringify({ title, category, storagePath: filePath })]
        );

        console.log("-> POST Upload Complete");
        return NextResponse.json({ success: true, documentId: docId, status: "processing" });
    } catch (error: any) {
        console.error("-> Global Upload Error EXCEPTION:", error);
        console.error("-> Error Stack:", error.stack);
        return NextResponse.json({
            error: "An unexpected error occurred during upload.",
            details: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        }, { status: 500 });
    }
}

export async function GET() {
    console.log("-> API GET /upload");
    try {
        const session = await auth();
        console.log("-> API GET /upload-Session-Result:", session ? "OK" : "FAIL");

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await db.query(
            "SELECT id, title, category, status, total_chunks, processed_chunks, created_at FROM documents WHERE workspace_id = $1 ORDER BY created_at DESC",
            [session.user.workspace_id]
        );

        return NextResponse.json(result.rows);
    } catch (error: any) {
        console.error("-> API GET /upload Error:", error);
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}
