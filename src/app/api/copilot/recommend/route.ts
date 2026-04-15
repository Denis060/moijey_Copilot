import { auth } from "@/auth";
import { dbClient } from "@/lib/db/db-client";
import { copilotRecommendationService } from "@/lib/ai/copilot-recommendation-service";
import { emailService } from "@/lib/ai/email-service";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role - allow sales_rep, manager, admin
    const userQuery = `
      SELECT u.id, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = $1
    `;
    const userResult = await dbClient.query(userQuery, [session.user.email]);

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

    // Generate customer email
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
      matches
    );

    let emailSent = false;
    let emailError = null;

    // Send email if requested
    if (sendEmail && matches.length > 0) {
      const emailResult = await emailService.sendRecommendationEmail(
        customerEmail,
        customerName,
        emailDraft
      );

      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
      }
    }

    // Save recommendation to database
    await copilotRecommendationService.saveRecommendation(
      user.id,
      session.user.email.split("@")[1] === "moijeydiamonds.com" ? "default" : "default",
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
    await dbClient.query(
      `INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "default",
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
