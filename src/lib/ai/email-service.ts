import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "copilot@moijeydiamonds.com";

export const emailService = {
  /**
   * Send recommendation email to customer
   */
  async sendRecommendationEmail(
    customerEmail: string,
    customerName: string,
    emailBody: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const subject = `Your Personalized Jewelry Recommendations from Moijey`;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #020617; margin: 0; font-size: 24px; }
    .content { margin: 20px 0; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; font-size: 12px; color: #666; }
    .product-link { color: #d4af37; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Your Personalized Jewelry Selection</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      ${emailBody.split("\n").map((line) => `<p>${line}</p>`).join("")}
    </div>
    <div class="footer">
      <p>
        <strong>Moijey Diamonds</strong><br/>
        Luxury Jewelry | Premium Diamonds<br/>
        <a href="https://moijeydiamonds.com" class="product-link">Visit Our Store</a>
      </p>
      <p>Questions? Reply to this email or contact our team directly.</p>
    </div>
  </div>
</body>
</html>
      `;

      const response = await resend.emails.send({
        from: FROM_ADDRESS,
        to: customerEmail,
        subject,
        html: htmlBody,
      });

      if (response.error) {
        console.error("Resend error:", response.error);
        return {
          success: false,
          error: response.error.message || "Failed to send email",
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error: any) {
      console.error("Email service exception:", error);
      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  },

  /**
   * Send email draft to sales rep for review
   */
  async sendDraftForReview(
    repEmail: string,
    customerName: string,
    customerEmail: string,
    emailDraft: string,
    products: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const productsHtml = products
        .map(
          (p) => `
        <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 4px;">
          <strong>${p.title}</strong><br/>
          Price: $${p.price.toLocaleString()}<br/>
          <a href="${p.shopify_url}" style="color: #d4af37;">View on Shopify</a>
        </div>
      `
        )
        .join("");

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #020617; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📧 Email Draft Ready for Review</h2>
    </div>
    
    <h3>Customer: ${customerName} (${customerEmail})</h3>
    
    <h4>Email Draft:</h4>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 10px 0;">
      ${emailDraft.split("\n").map((line) => `<p>${line}</p>`).join("")}
    </div>
    
    <h4>Recommended Products:</h4>
    ${productsHtml}
    
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Review the email draft above</li>
        <li>Check the recommended products</li>
        <li>Send to customer or make adjustments as needed</li>
      </ul>
    </div>
  </div>
</body>
</html>
      `;

      const response = await resend.emails.send({
        from: FROM_ADDRESS,
        to: repEmail,
        subject: `Review: Recommendation for ${customerName}`,
        html: htmlBody,
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message || "Failed to send draft",
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error: any) {
      console.error("Draft email exception:", error);
      return {
        success: false,
        error: error.message || "Failed to send draft",
      };
    }
  },
};
