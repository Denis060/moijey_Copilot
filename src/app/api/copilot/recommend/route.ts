import { auth } from "@/auth";
import { db } from "@/lib/db/db-client";
import { copilotRecommendationService } from "@/lib/ai/copilot-recommendation-service";
import { emailService } from "@/lib/ai/email-service";

// Derive a human-friendly display name from an email's local part:
// "jane.doe@x" → "Jane Doe", "ibrahim_fofanah@x" → "Ibrahim Fofanah",
// "ibrahimfofanah060@x" → "Ibrahimfofanah". Strips trailing digits.
function deriveRepName(email: string): string {
  const local = (email.split("@")[0] || "").replace(/\d+$/, "");
  if (!local) return "Your Moijey Specialist";
  if (/[._-]/.test(local)) {
    return local
      .split(/[._-]+/)
      .filter(Boolean)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(" ");
  }
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role - allow sales_rep, manager, admin
    const userQuery = `
      SELECT u.id, u.workspace_id, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;
    const userResult = await db.query(userQuery, [session.user.email]);

    if (!userResult.rows[0]) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];
    const allowedRoles = ["sales_rep", "manager", "admin"];

    if (!allowedRoles.includes(user.role_name)) {
      return Response.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const {
      customerName,
      customerEmail,
      productType,
      budgetMin,
      budgetMax,
      diamondShape,
      metal,
      style,
      timeline,
      notes,
      sendEmail,
      // Optional overrides supplied by the rep at send time:
      emailDraftOverride,        // string — final email body the rep edited locally
      selectedProductIds,        // string[] — subset of match IDs to include in the email
      subjectOverride,           // string — rep's custom subject line
      testRecipient,             // string — when present, send to this address instead of customerEmail and don't mark as sent
    } = body as {
      customerName: string;
      customerEmail: string;
      productType?: string;
      budgetMin?: number | string;
      budgetMax?: number | string;
      diamondShape?: string;
      metal?: string;
      style?: string;
      timeline?: string;
      notes?: string;
      sendEmail?: boolean;
      emailDraftOverride?: string;
      selectedProductIds?: string[];
      subjectOverride?: string;
      testRecipient?: string;
    };

    // Validate required fields
    if (!customerName || !customerEmail) {
      return Response.json(
        { error: "Customer name and email are required" },
        { status: 400 }
      );
    }

    // Normalize budget once — UI sends strings, server treats them as numbers.
    const toNum = (v: number | string | undefined): number | undefined => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const budgetMinN = toNum(budgetMin);
    const budgetMaxN = toNum(budgetMax);

    // Reject obviously-wrong budget ranges before they silently return zero matches.
    if (budgetMinN !== undefined && budgetMaxN !== undefined && budgetMinN > budgetMaxN) {
      return Response.json(
        { error: "Minimum budget can't be greater than maximum budget. Please correct and retry." },
        { status: 400 }
      );
    }

    const recInput = {
      customerName,
      customerEmail,
      productType,
      budgetMin: budgetMinN,
      budgetMax: budgetMaxN,
      diamondShape,
      metal,
      style,
      timeline,
      notes,
    };

    // Find matching products
    const matches = await copilotRecommendationService.findMatches(recInput);

    // Generate internal summary
    const internalSummary = await copilotRecommendationService.generateInternalSummary(recInput, matches);

    // Generate customer email — sign it with the logged-in rep's derived name.
    const repName = deriveRepName(session.user.email);
    const emailDraft = await copilotRecommendationService.generateCustomerEmail(recInput, matches, { name: repName });

    let emailSent = false;
    let emailError = null;
    let testEmailSent = false;

    // Honor rep edits at send time:
    //   - emailDraftOverride: rep tweaked the draft locally; send their version verbatim
    //   - selectedProductIds: rep curated which matches go in the email cards
    //   - subjectOverride: rep customized the subject line
    //   - testRecipient: send to the rep's own inbox first instead of the customer
    //                    (doesn't flip email_sent in the DB; this is just a preview)
    // Falls back to the freshly-generated draft + top-3 matches when no overrides given.
    const finalProducts = (Array.isArray(selectedProductIds) && selectedProductIds.length > 0)
      ? matches.filter(m => selectedProductIds.includes(m.id))
      : matches.slice(0, 3);
    const finalDraft = (typeof emailDraftOverride === "string" && emailDraftOverride.trim().length > 0)
      ? emailDraftOverride
      : emailDraft;
    const isTest = typeof testRecipient === "string" && testRecipient.trim().length > 0;
    const recipient = isTest ? testRecipient!.trim() : customerEmail;

    if (sendEmail && finalProducts.length > 0) {
      const emailResult = await emailService.sendRecommendationEmail(
        recipient,
        customerName,
        finalDraft,
        finalProducts,
        subjectOverride
      );

      if (isTest) {
        testEmailSent = emailResult.success;
      } else {
        emailSent = emailResult.success;
      }
      if (!emailResult.success) {
        emailError = emailResult.error;
      }
    }

    // Save recommendation to database. Persist what the customer ACTUALLY received:
    // the curated subset of products + the rep's edited draft (when those were used).
    await copilotRecommendationService.saveRecommendation(
      user.id,
      user.workspace_id,
      recInput,
      sendEmail ? finalProducts : matches,
      sendEmail ? finalDraft : emailDraft,
      emailSent
    );

    // Log action
    await db.query(
      `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.workspace_id,
        user.id,
        "GENERATE_RECOMMENDATION",
        "recommendation",
        customerEmail,
        JSON.stringify({ customer: customerName, matches: matches.length, sent: emailSent }),
      ]
    );

    return Response.json({
      success: true,
      data: {
        customerName,
        customerEmail,
        matchCount: matches.length,
        matches,
        internalSummary,
        emailDraft,
        emailSent,
        emailError,
        testEmailSent,
        customOrderSuggested: matches.length === 0,
      },
    });
  } catch (error: any) {
    console.error("Recommendation API error:", error);
    return Response.json(
      { error: error.message || "Failed to generate recommendation" },
      { status: 500 }
    );
  }
}
