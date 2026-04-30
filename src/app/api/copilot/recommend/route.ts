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
    } = body;

    // Validate required fields
    if (!customerName || !customerEmail) {
      return Response.json(
        { error: "Customer name and email are required" },
        { status: 400 }
      );
    }

    // Find matching products
    const matches = await copilotRecommendationService.findMatches({
      customerName,
      customerEmail,
      productType,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      diamondShape,
      metal,
      style,
      timeline,
      notes,
    });

    // Generate internal summary
    const internalSummary = await copilotRecommendationService.generateInternalSummary(
      {
        customerName,
        customerEmail,
        productType,
        budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
        budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
        diamondShape,
        metal,
        style,
        timeline,
        notes,
      },
      matches
    );

    // Generate customer email — sign it with the logged-in rep's derived name.
    const repName = deriveRepName(session.user.email);
    const emailDraft = await copilotRecommendationService.generateCustomerEmail(
      {
        customerName,
        customerEmail,
        productType,
        budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
        budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
        diamondShape,
        metal,
        style,
        timeline,
        notes,
      },
      matches,
      { name: repName }
    );

    let emailSent = false;
    let emailError = null;

    // Send email if requested. Top 3 products embedded as cards in the email
    // body (matches the chat preview: title, price, image, link to Shopify).
    if (sendEmail && matches.length > 0) {
      const emailResult = await emailService.sendRecommendationEmail(
        customerEmail,
        customerName,
        emailDraft,
        matches.slice(0, 3)
      );

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
      }
    }

    // Save recommendation to database
    await copilotRecommendationService.saveRecommendation(
      user.id,
      user.workspace_id,
      {
        customerName,
        customerEmail,
        productType,
        budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
        budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
        diamondShape,
        metal,
        style,
        timeline,
        notes,
      },
      matches,
      emailDraft,
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
