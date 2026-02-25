import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { documentParser } from "@/lib/ai/parser";
import { ingestionService } from "@/lib/ai/ingestion-service";

export const maxDuration = 300; // Allow up to 5 mins for processing large files

export async function POST(req: Request) {
    console.log("POST /api/knowledge/upload - Request received");
    const session = await auth();
    console.log("POST /api/knowledge/upload - Session:", session?.user?.email);

    if (!session || session.user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const title = formData.get("title") as string || file.name;
        const category = formData.get("category") as string || "General";

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const text = await documentParser.parseToText(buffer, file.type);

        // 1. Create Document Record
        const docRes = await db.query(
            `INSERT INTO documents (workspace_id, title, content_type, category, uploaded_by) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [session.user.workspace_id, title, file.type, category, session.user.id]
        );

        const docId = docRes.rows[0].id;

        // 2. Start Ingestion (Asynchronous logic would be better with a worker, but for MVP we do it inline or via background promise)
        // We'll run it in the background to avoid timing out the request if it's a large file
        ingestionService.processDocument(docId, text).catch(err => {
            console.error(`Failed to ingest document ${docId}:`, err);
        });

        // 3. Log Audit
        await db.query(
            `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [session.user.workspace_id, session.user.id, "UPLOAD_DOC", "document", docId, JSON.stringify({ title, category })]
        );

        return NextResponse.json({ success: true, documentId: docId, status: "processing" });
    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    console.log("GET /api/knowledge/upload - Fetching documents");
    const session = await auth();
    console.log("GET /api/knowledge/upload - Session:", session ? "Found" : "Null", session?.user?.email);

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await db.query(
            "SELECT id, title, category, status, total_chunks, processed_chunks, created_at FROM documents WHERE workspace_id = $1 ORDER BY created_at DESC",
            [session.user.workspace_id]
        );

        return NextResponse.json(result.rows);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
    }
}
