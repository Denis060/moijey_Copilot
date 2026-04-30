import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/db-client";
import { parse } from "csv-parse/sync";
import { aiService } from "@/lib/ai/ai-service";

export const maxDuration = 60;

const REQUIRED_COLUMNS = ["product_id", "title"];

// Build the text we feed to the embedding model — combines all the searchable
// attributes of a product into one string. Empty fields are skipped.
function composeEmbeddingText(p: {
    title?: string | null; category?: string | null; diamond_shape?: string | null;
    metal?: string | null; style?: string | null; description_short?: string | null;
    tags?: string[] | null;
}): string {
    const parts: string[] = [
        p.title || "",
        p.category || "",
        p.diamond_shape || "",
        p.metal || "",
        p.style || "",
        p.description_short || "",
        Array.isArray(p.tags) ? p.tags.join(" ") : "",
    ];
    return parts.filter(Boolean).join(" ").trim();
}

// Embed any products that don't yet have a vector, with bounded concurrency.
// Stops early if we approach the function's runtime budget so we still return a response.
async function embedPendingProducts(softDeadlineMs: number): Promise<{
    embedded: number; failed: number; remaining: number;
}> {
    const pending = await db.query(
        `SELECT id, product_id, title, category, diamond_shape, metal, style, description_short, tags
         FROM products
         WHERE embedding IS NULL`
    );
    const queue = [...pending.rows];
    let embedded = 0;
    let failed = 0;
    const CONCURRENCY = 16;

    async function worker() {
        while (queue.length > 0) {
            if (Date.now() > softDeadlineMs) return; // Bail out before the function gets killed
            const p = queue.shift();
            if (!p) return;
            const text = composeEmbeddingText(p);
            if (!text) { failed++; continue; }
            try {
                const vec = await aiService.generateEmbedding(text);
                await db.query(
                    `UPDATE products SET embedding = $1::vector WHERE id = $2`,
                    [`[${vec.join(",")}]`, p.id]
                );
                embedded++;
            } catch (err: any) {
                console.error(`Embedding failed for ${p.product_id}:`, err.message);
                failed++;
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    return { embedded, failed, remaining: queue.length };
}

// Map a parsed CSV row to the products row shape. Returns null on missing required fields.
function rowToProduct(record: Record<string, string>): Record<string, any> | null {
    const product_id = record.product_id?.trim();
    const title = record.title?.trim();
    if (!product_id || !title) return null;

    const priceNum = parseFloat(record.price);
    const inStockRaw = (record.in_stock || "").trim().toLowerCase();

    return {
        product_id,
        title,
        category: record.category?.trim() || null,
        price: Number.isFinite(priceNum) ? priceNum : null,
        price_display: record.price_display?.trim() || null,
        in_stock: inStockRaw === "true" || inStockRaw === "1" || inStockRaw === "yes",
        shopify_product_id: record.shopify_product_id?.trim() || null,
        shopify_url: record.shopify_url?.trim() || null,
        image_url: record.image_url?.trim() || null,
        diamond_shape: record.diamond_shape?.trim() || null,
        metal: record.metal?.trim() || null,
        style: record.style?.trim() || null,
        description_short: record.description_short?.trim() || null,
        tags: (record.tags || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean),
        target_gender: record.target_gender?.trim() || null,
        notes_internal: record.notes_internal?.trim() || null,
    };
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
    const search = searchParams.get("q")?.trim() || "";

    const params: any[] = [];
    let where = "";
    if (search) {
        params.push(`%${search}%`);
        where = `WHERE title ILIKE $${params.length} OR product_id ILIKE $${params.length} OR category ILIKE $${params.length}`;
    }
    params.push(limit, offset);

    const rows = await db.query(
        `SELECT id, product_id, title, category, price, price_display, in_stock,
                diamond_shape, metal, style, image_url, shopify_url, created_at, updated_at
         FROM products
         ${where}
         ORDER BY updated_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
    );
    // Stats: always reflect the whole catalog (for the cards at the top of the page).
    const statsRes = await db.query(
        `SELECT COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE in_stock)::int AS in_stock,
                COUNT(*) FILTER (WHERE price IS NOT NULL)::int AS priced
         FROM products`
    );
    // Filtered total: matches the search filter, drives pagination.
    const filteredTotalRes = search
        ? await db.query(`SELECT COUNT(*)::int AS n FROM products ${where}`, params.slice(0, -2))
        : { rows: [{ n: statsRes.rows[0].n }] };

    return NextResponse.json({
        products: rows.rows,
        total: statsRes.rows[0].n,
        filtered_total: filteredTotalRes.rows[0].n,
        in_stock: statsRes.rows[0].in_stock,
        priced: statsRes.rows[0].priced,
    });
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!(file instanceof Blob)) {
            return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
        }
        if (file.size > 4 * 1024 * 1024) {
            return NextResponse.json({ error: "CSV too large (max 4MB)" }, { status: 413 });
        }

        const text = await file.text();
        let records: Record<string, string>[];
        try {
            records = parse(text, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
            });
        } catch (err: any) {
            return NextResponse.json({ error: `CSV parse error: ${err.message}` }, { status: 400 });
        }

        if (!records.length) {
            return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
        }
        const header = Object.keys(records[0]);
        const missing = REQUIRED_COLUMNS.filter(c => !header.includes(c));
        if (missing.length) {
            return NextResponse.json(
                { error: `CSV missing required columns: ${missing.join(", ")}` },
                { status: 400 }
            );
        }

        const products = records.map(rowToProduct).filter(Boolean) as Record<string, any>[];
        const skippedInvalid = records.length - products.length;

        let inserted = 0;
        let failed = 0;
        const errors: string[] = [];

        const upsertSQL = `
            INSERT INTO products (
                product_id, title, category, price, price_display, in_stock,
                shopify_product_id, shopify_url, image_url, diamond_shape, metal, style,
                description_short, tags, target_gender, notes_internal, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW(), NOW())
            ON CONFLICT (product_id) DO UPDATE SET
                title = EXCLUDED.title,
                category = EXCLUDED.category,
                price = EXCLUDED.price,
                price_display = EXCLUDED.price_display,
                in_stock = EXCLUDED.in_stock,
                shopify_product_id = EXCLUDED.shopify_product_id,
                shopify_url = EXCLUDED.shopify_url,
                image_url = EXCLUDED.image_url,
                diamond_shape = EXCLUDED.diamond_shape,
                metal = EXCLUDED.metal,
                style = EXCLUDED.style,
                description_short = EXCLUDED.description_short,
                tags = EXCLUDED.tags,
                target_gender = EXCLUDED.target_gender,
                notes_internal = EXCLUDED.notes_internal,
                updated_at = NOW()
        `;

        for (const p of products) {
            try {
                await db.query(upsertSQL, [
                    p.product_id, p.title, p.category, p.price, p.price_display, p.in_stock,
                    p.shopify_product_id, p.shopify_url, p.image_url, p.diamond_shape, p.metal, p.style,
                    p.description_short, p.tags, p.target_gender, p.notes_internal,
                ]);
                inserted++;
            } catch (err: any) {
                failed++;
                if (errors.length < 5) errors.push(`${p.product_id}: ${err.message}`);
            }
        }

        // Embed any products that don't yet have vectors (new rows, plus anything previously
        // skipped). Bounded by a soft deadline so we always return within the function budget.
        const importStart = Date.now();
        const SOFT_DEADLINE = importStart + 45_000;
        const embedStats = await embedPendingProducts(SOFT_DEADLINE).catch(err => {
            console.error("Embedding pass failed:", err);
            return { embedded: 0, failed: 0, remaining: -1 };
        });

        const workspaceId = (session.user as any).workspace_id;
        await db.query(
            `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [workspaceId, (session.user as any).id, "IMPORT_PRODUCTS", "products", null,
             JSON.stringify({
                 inserted, failed, skipped_invalid: skippedInvalid, total_rows: records.length,
                 embedded: embedStats.embedded, embed_failed: embedStats.failed, embed_remaining: embedStats.remaining,
             })]
        ).catch(() => { /* audit failures shouldn't block the response */ });

        return NextResponse.json({
            success: true,
            inserted,
            failed,
            skipped_invalid: skippedInvalid,
            total_rows: records.length,
            errors: errors.length ? errors : undefined,
            embeddings: embedStats,
        });
    } catch (error: any) {
        console.error("Products import error:", error);
        return NextResponse.json({ error: error.message || "Import failed" }, { status: 500 });
    }
}

export async function DELETE() {
    const session = await auth();
    if (!session || (session.user as any).role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await db.query("DELETE FROM products RETURNING id");
    const workspaceId = (session.user as any).workspace_id;
    await db.query(
        `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, (session.user as any).id, "DELETE_ALL_PRODUCTS", "products", null,
         JSON.stringify({ deleted: result.rowCount })]
    ).catch(() => {});

    return NextResponse.json({ success: true, deleted: result.rowCount });
}
