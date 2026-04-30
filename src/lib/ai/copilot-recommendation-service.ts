import { db } from "@/lib/db/db-client";
import { aiService } from "./ai-service";

export interface RecommendationInput {
  customerName: string;
  customerEmail: string;
  productType?: string;
  budgetMin?: number;
  budgetMax?: number;
  diamondShape?: string;
  metal?: string;
  style?: string;
  timeline?: string;
  notes?: string;
}

export interface Product {
  id: string;
  product_id: string;
  title: string;
  category: string;
  price: number;
  image_url: string;
  diamond_shape: string;
  metal: string;
  style: string;
  description_short: string;
  shopify_url: string;
  tags: string[];
}

export interface RecommendationResult {
  matches: Product[];
  internalSummary: string;
  emailDraft: string;
  customOrderSuggested: boolean;
}

export const copilotRecommendationService = {
  /**
   * Find matching products based on customer requirements
   */
  async findMatches(input: RecommendationInput): Promise<Product[]> {
    const { productType, budgetMin, budgetMax, diamondShape, metal, style } = input;

    let query = `
      SELECT
        id, product_id, title, category, price, image_url,
        diamond_shape, metal, style, description_short,
        shopify_url, tags
      FROM products
      WHERE in_stock = true
    `;

    const params: any[] = [];
    let paramCount = 1;

    // Product type filter — split the form value into significant words and require each
    // to appear in either the category or the title. Catches "engagement ring" when the
    // category is stored as "engagement_ring", and avoids returning necklaces/earrings
    // when the rep asked for a ring.
    if (productType) {
      const words = productType
        .toLowerCase()
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 3); // drop "of", "a", etc.
      for (const word of words) {
        query += ` AND (LOWER(category) LIKE $${paramCount} OR LOWER(title) LIKE $${paramCount})`;
        params.push(`%${word}%`);
        paramCount++;
      }
    }

    // Budget filter
    if (budgetMin) {
      query += ` AND price >= $${paramCount}`;
      params.push(budgetMin);
      paramCount++;
    }
    if (budgetMax) {
      query += ` AND price <= $${paramCount}`;
      params.push(budgetMax);
      paramCount++;
    }

    // Exact attribute matches
    if (diamondShape) {
      query += ` AND LOWER(diamond_shape) = LOWER($${paramCount})`;
      params.push(diamondShape);
      paramCount++;
    }
    if (metal) {
      query += ` AND LOWER(metal) = LOWER($${paramCount})`;
      params.push(metal);
      paramCount++;
    }
    if (style) {
      query += ` AND LOWER(style) ILIKE LOWER($${paramCount})`;
      params.push(`%${style}%`);
      paramCount++;
    }

    // Sort by proximity to the budget midpoint (or to budgetMax / budgetMin if only one
    // bound is given). Previously used `budgetMin || 0 + budgetMax` which parses as
    // `budgetMin || (0 + budgetMax)` due to operator precedence — pinned the target to
    // budgetMin instead of the midpoint.
    if (budgetMin && budgetMax) {
      query += ` ORDER BY ABS(price - $${paramCount}) ASC LIMIT 20`;
      params.push((budgetMin + budgetMax) / 2);
    } else if (budgetMax) {
      query += ` ORDER BY ABS(price - $${paramCount}) ASC LIMIT 20`;
      params.push(budgetMax);
    } else if (budgetMin) {
      query += ` ORDER BY ABS(price - $${paramCount}) ASC LIMIT 20`;
      params.push(budgetMin);
    } else {
      query += ` LIMIT 20`;
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Generate internal sales summary
   */
  async generateInternalSummary(input: RecommendationInput, matches: Product[]): Promise<string> {
    const prompt = `
You are a luxury jewelry sales assistant. Create a brief internal sales summary (2-3 sentences) for a sales rep based on customer request.

Customer Request:
- Name: ${input.customerName}
- Looking for: ${input.productType || "engagement ring"}
- Budget: ${
      input.budgetMin && input.budgetMax
        ? `$${input.budgetMin.toLocaleString()} - $${input.budgetMax.toLocaleString()}`
        : input.budgetMin
          ? `$${input.budgetMin.toLocaleString()}+`
          : "Not specified"
    }
- Preferred Shape: ${input.diamondShape || "Not specified"}
- Metal: ${input.metal || "Not specified"}
- Style: ${input.style || "Not specified"}
- Timeline: ${input.timeline || "Not specified"}
- Additional Notes: ${input.notes || "None"}

Matching Products: ${matches.length} found${
      matches.length > 0
        ? ` (${matches
            .slice(0, 3)
            .map((p) => p.title)
            .join(", ")})`
        : ""
    }

Write a professional summary that a sales rep would use internally. Make it concise and actionable.
`;

    const summary = await aiService.generateAnswer(prompt);
    return summary;
  },

  /**
   * Generate customer-facing recommendation email.
   * The rep's name + title are appended programmatically so the LLM cannot
   * decide to use "[Your Name]" or invent an unrelated job title.
   */
  async generateCustomerEmail(
    input: RecommendationInput,
    matches: Product[],
    rep: { name: string; title?: string } = { name: "Your Moijey Specialist" }
  ): Promise<string> {
    const matchesText =
      matches.length > 0
        ? matches
            .slice(0, 3)
            .map(
              (p) =>
                `- **${p.title}** | $${p.price.toLocaleString()} | [View Product](${p.shopify_url})`
            )
            .join("\n")
        : "No exact matches available at this time.";

    const customOrderText =
      matches.length === 0
        ? "Since we don't have exact matches in our current inventory, we'd be happy to help you create a custom piece that perfectly matches your vision. Our custom design team specializes in bespoke luxury pieces."
        : "";

    const prompt = `
You are a luxury jewelry sales specialist writing a personalized recommendation email.

Customer Details:
- Name: ${input.customerName}
- Looking for: ${input.productType || "engagement ring"}
- Preferences: ${[input.diamondShape, input.metal, input.style].filter(Boolean).join(", ") || "various"}
- Budget: ${
      input.budgetMin && input.budgetMax
        ? `$${input.budgetMin.toLocaleString()} - $${input.budgetMax.toLocaleString()}`
        : "custom"
    }

Recommended Products:
${matchesText}

${customOrderText}

Write a professional, warm, and personalized email (4-5 sentences) recommending these products. Be enthusiastic about the selections and make a personal touch. Do NOT include the [View Product] links in the email body - just write naturally.

Format as plain text (no markdown formatting). End with the body of the email — DO NOT include a sign-off, signature, "Warmly", "Sincerely", "[Your Name]", or any closing line. The signature will be appended separately.
`;

    const body = await aiService.generateAnswer(prompt);

    // Strip any closing the model added anyway, then append the canonical signature.
    const closingPattern = /\n+\s*(warmly|sincerely|best regards|kind regards|regards|yours truly|yours sincerely|best,|cheers|with warm regards|with regards)\b[\s\S]*$/i;
    const cleanedBody = body.replace(closingPattern, "").trim();
    const title = rep.title || "Moijey Diamond Specialist";
    return `${cleanedBody}\n\nWarmly,\n\n${rep.name}\n${title}`;
  },

  /**
   * Save recommendation request to database
   */
  async saveRecommendation(
    userId: string,
    workspaceId: string,
    input: RecommendationInput,
    matches: Product[],
    emailDraft: string,
    sent: boolean = false
  ) {
    const query = `
      INSERT INTO recommendation_requests (
        user_id, workspace_id, customer_name, customer_email,
        budget_min, budget_max, product_type, diamond_shape, metal, style,
        timeline, notes, matched_products, email_draft, email_sent, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id;
    `;

    const params = [
      userId,
      workspaceId,
      input.customerName,
      input.customerEmail,
      input.budgetMin || null,
      input.budgetMax || null,
      input.productType || null,
      input.diamondShape || null,
      input.metal || null,
      input.style || null,
      input.timeline || null,
      input.notes || null,
      JSON.stringify(matches.map((m) => ({ id: m.id, title: m.title }))),
      emailDraft,
      sent,
      sent ? new Date() : null,
    ];

    const result = await db.query(query, params);
    return result.rows[0];
  },
};
