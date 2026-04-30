import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "copilot@moijeydiamonds.com";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
};

// Escape user-provided text before embedding it in HTML. Defensive — most fields
// are plain text from the rep's form or AI output, but a stray `<` or `&` would
// otherwise render or break the markup.
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface CustomerEmailProduct {
  title: string;
  price: number | null;
  price_display?: string | null;
  image_url: string | null;
  shopify_url: string | null;
}

// Render a single product card as table-based HTML — single column, image on top,
// title + price + CTA below. Tables (not flex/grid) are required for Outlook compat.
function renderProductCard(p: CustomerEmailProduct): string {
  const url = p.shopify_url || "https://moijeydiamonds.com";
  const priceText = p.price_display
    ? esc(p.price_display)
    : (p.price !== null ? `$${Number(p.price).toLocaleString()}` : "Price on request");

  const imageBlock = p.image_url
    ? `<tr>
         <td style="padding: 0; line-height: 0;">
           <a href="${esc(url)}" target="_blank" style="display:block;">
             <img src="${esc(p.image_url)}" alt="${esc(p.title)}" width="600"
                  style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:none; text-decoration:none;" />
           </a>
         </td>
       </tr>`
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin: 24px 0; border: 1px solid #e5e5e5; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
      ${imageBlock}
      <tr>
        <td style="padding: 22px 24px;">
          <h3 style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.3; color: #020617;">
            ${esc(p.title)}
          </h3>
          <p style="margin: 0 0 18px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: bold; color: #d4af37; letter-spacing: 0.3px;">
            ${priceText}
          </p>
          <a href="${esc(url)}" target="_blank"
             style="display: inline-block; padding: 11px 22px; background-color: #020617; color: #d4af37; text-decoration: none; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase; border-radius: 4px;">
            View on Moijey Diamonds
          </a>
        </td>
      </tr>
    </table>
  `;
}

export const emailService = {
  /**
   * Send recommendation email to customer with product cards (image, title, price,
   * "View on Moijey Diamonds" button per product). The body text is the AI-generated
   * narrative; cards reinforce by linking each piece directly to its Shopify page.
   */
  async sendRecommendationEmail(
    customerEmail: string,
    customerName: string,
    emailBody: string,
    products: CustomerEmailProduct[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const resend = getResendClient();
      const subject = `Your Personalized Jewelry Recommendations from Moijey`;

      const bodyParagraphs = emailBody
        .split(/\n+/)
        .filter(line => line.trim().length > 0)
        .map(line => `<p style="margin: 0 0 14px 0;">${esc(line)}</p>`)
        .join("");

      const productCards = products.slice(0, 3).map(renderProductCard).join("");
      const productsSection = products.length > 0 ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 28px;">
          <tr>
            <td style="padding-bottom: 6px; border-bottom: 1px solid #d4af37;">
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">
                Selected for You
              </p>
            </td>
          </tr>
        </table>
        ${productCards}
      ` : "";

      const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f0;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 6px; overflow: hidden;">
          <tr>
            <td style="padding: 30px 32px 24px 32px; border-bottom: 2px solid #d4af37;">
              <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; color: #020617; letter-spacing: 0.5px;">
                Your Personalized Jewelry Selection
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 8px 32px; font-size: 15px; color: #333;">
              <p style="margin: 0 0 14px 0;">Dear ${esc(customerName)},</p>
              ${bodyParagraphs}
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              ${productsSection}
            </td>
          </tr>
          <tr>
            <td style="padding: 22px 32px; background-color: #020617; color: #d4af37; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #d4af37; letter-spacing: 0.5px;">
                Moijey Diamonds
              </p>
              <p style="margin: 0 0 12px 0; color: #c8c8c8;">Luxury Jewelry · Premium Diamonds</p>
              <a href="https://moijeydiamonds.com" style="color: #d4af37; text-decoration: none; font-weight: bold;">moijeydiamonds.com</a>
              <p style="margin: 14px 0 0 0; color: #888; font-size: 11px;">
                Questions? Reply to this email and our team will respond shortly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
      const resend = getResendClient();
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
