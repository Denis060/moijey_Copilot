import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { documentParser } from "@/lib/ai/parser";
import { ingestionService } from "@/lib/ai/ingestion-service";
import { supabase } from "@/lib/storage";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const docRes = await db.query(
            "SELECT id, title, file_path, storage_bucket, content_type FROM documents WHERE id = $1 AND workspace_id = $2",
            [id, (session.user as any).workspace_id]
        );

        if (!docRes.rows.length) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const doc = docRes.rows[0];

        // Download file from storage
        const bucket = doc.storage_bucket || process.env.DOCUMENT_STORAGE_BUCKET || "moijey-docs";
        const { data, error } = await supabase.storage.from(bucket).download(doc.file_path);
        if (error || !data) {
            return NextResponse.json({ error: "Failed to download file from storage", details: error?.message }, { status: 500 });
        }

        const buffer = Buffer.from(await data.arrayBuffer());

        // Parse to text
        const text = await documentParser.parseToText(buffer, doc.content_type);

        // Clear existing chunks for this document
        await db.query("DELETE FROM document_chunks WHERE document_id = $1", [id]);

        // Fire-and-forget ingestion
        ingestionService.processDocument(id, text)
            .then(res => console.log(`-> Reprocess SUCCESS for ${id}:`, res))
            .catch(err => console.error(`-> Reprocess FAIL for ${id}:`, err));

        return NextResponse.json({ success: true, documentId: id, status: "processing" });
    } catch (error: any) {
        console.error("Reprocess error:", error);
        return NextResponse.json({ error: "Reprocess failed", details: error.message }, { status: 500 });
    }
}
