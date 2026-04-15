# Sales Co-Pilot: Recommendation & Outreach Feature

## Overview

The **Sales Co-Pilot Recommendation Mode** extends the existing MOIJEY copilot with a second workflow that allows sales reps to generate product recommendations and draft customer emails in seconds.

## What's New

### Dual-Mode Interface
- **Questions Mode** (existing): RAG-powered Q&A about products, policies, FAQs
- **Recommendations Mode** (new): Structured product matching, AI-generated recommendations, and email drafts

### Workflow
1. Rep enters customer details (name, email, preferences, budget)
2. AI searches inventory for matches
3. AI generates:
   - Product recommendations (top 3 matches)
   - Internal sales summary for the rep
   - Customer-facing email draft
4. Rep reviews and sends with one click

### Who Can Access
- Sales reps
- Managers  
- Admins

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This adds `resend` to your package.json for email sending.

### 2. Set Up Database

The new tables are defined in `src/lib/db/init.sql`:
- `products` — inventory catalog
- `recommendation_requests` — audit trail of recommendations

Apply migrations (if using migrations):
```bash
npm run migrate
```

Or if you're using raw SQL, run the init.sql directly via your Supabase console.

### 3. Add Environment Variables

Add to your `.env.local`:

```env
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=copilot@moijeydiamonds.com
```

Get your Resend API key from [resend.com](https://resend.com).

### 4. Import Products

First, export your product Excel as CSV with these columns:

```
product_id, title, category, price, price_display, in_stock, 
shopify_product_id, shopify_url, image_url, diamond_shape, 
metal, style, description_short, tags, target_gender, notes_internal
```

Then run:

```bash
node scripts/import-products.js ./products.csv
```

**Output:**
```
📂 Reading CSV from: ./products.csv
🔗 Connected to database
📦 Loaded 142 products from CSV
✅ Inserted/Updated: 142/142

📈 Database Stats:
   Total products: 142
   In stock: 89
   Unique shapes: 7
   Unique metals: 4
```

### 5. Test the Feature

1. Sign in as a sales rep/manager/admin
2. Click the "Recommend" tab in the chat header
3. Fill in customer details
4. Click "Generate Recommendation"
5. Review matches, edit email, and send

---

## Architecture

### Files Created

**Components:**
- `src/components/copilot/RecommendationMode.tsx` — Form UI & results display

**Services:**
- `src/lib/ai/copilot-recommendation-service.ts` — Product matching logic & AI generation
- `src/lib/ai/email-service.ts` — Email sending via Resend

**API:**
- `src/app/api/copilot/recommend/route.ts` — Main recommendation endpoint

**Scripts:**
- `scripts/import-products.js` — CSV to database import utility

**Database:**
- `src/lib/db/init.sql` — `products` & `recommendation_requests` tables

### Data Flow

```
[Rep fills form]
      ↓
POST /api/copilot/recommend
      ↓
[Search products by budget, shape, metal, style]
      ↓
[AI generates internal summary + email draft]
      ↓
[Return matches + drafts to UI]
      ↓
[Rep reviews & clicks "Send Email"]
      ↓
POST (sendEmail=true)
      ↓
[Resend sends email to customer]
      ↓
[Log to recommendation_requests table]
```

### Key Features

✅ **Smart Product Matching**
- Budget range filtering
- Diamond shape, metal, style matching
- Fallback to closest options if no exact matches

✅ **AI-Powered Drafts**
- Internal summary (for rep to scan quickly)
- Customer email (personalized, professional tone)

✅ **Fallback Logic**
- If no products match → suggest custom order option
- If weak matches → show closest options + explain why

✅ **Email Integration**
- Drafts optional review before sending
- One-click send via Resend
- Automatic HTML formatting & branding

✅ **Audit Trail**
- All recommendations logged to `recommendation_requests` table
- Tracks customer email, matches, and send status
- Queryable for analytics

---

## API Endpoint

### POST `/api/copilot/recommend`

**Request:**
```json
{
  "customerName": "Sarah Johnson",
  "customerEmail": "sarah@email.com",
  "productType": "engagement ring",
  "budgetMin": 8000,
  "budgetMax": 12000,
  "diamondShape": "oval",
  "metal": "yellow gold",
  "style": "classic",
  "timeline": "within 1 month",
  "notes": "Wants simple, elegant design",
  "sendEmail": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "customerName": "Sarah Johnson",
    "matchCount": 3,
    "matches": [
      {
        "id": "uuid...",
        "product_id": "PROD_123",
        "title": "Classic Oval Engagement Ring",
        "price": 9500,
        "image_url": "...",
        "shopify_url": "https://..."
      }
    ],
    "internalSummary": "Customer wants oval engagement ring, $8k–$12k, yellow gold, classic style. 3 strong matches found.",
    "emailDraft": "Hi Sarah, Based on your preferences...",
    "emailSent": false,
    "customOrderSuggested": false
  }
}
```

**Error Response:**
```json
{
  "error": "Failed to generate recommendation"
}
```

---

## Permissions & Roles

Only authenticated users with these roles can access the recommendation mode:
- `sales_rep`
- `manager`
- `admin`

Unauthenticated requests return `401 Unauthorized`.
Insufficient roles return `403 Forbidden`.

---

## Email Styling

Emails are sent with:
- Professional HTML template
- Moijey branding (gold accent #d4af37)
- Product cards with images, price, shop links
- Personalized greeting

Example:
```
Dear Sarah,

Based on your preferences, I selected a few options that match what 
you're looking for. I've included pieces that align with your preferred 
style, budget, and metal choice. If none of these feel perfect, we'd 
also be happy to help with a custom option.

[Product Card 1]
[Product Card 2]
[Product Card 3]

Best regards,
Moijey Diamonds
```

---

## Troubleshooting

### "Failed to generate embedding"
- Check `GEMINI_API_KEY` is set
- API key must have gemini-embedding-001 enabled

### "Failed to send email"
- Check `RESEND_API_KEY` is set correctly
- Verify `RESEND_FROM_EMAIL` domain is verified in Resend

### Products not importing
- Ensure CSV columns match schema (see import script)
- Check for duplicate `product_id` values
- Verify database connection in `.env.local`

### Recommendation tab not showing
- Check user role (sales_rep, manager, or admin required)
- Clear browser cache
- Check browser console for errors

---

## Future Enhancements

**Phase 2:**
- Natural language mode: "Find oval ring under $10k in yellow gold"
- Batch recommendations for multiple customers
- Email scheduling

**Phase 3:**
- Rep-to-customer handoff in real-time chat
- Recommendation history & follow-up automation
- A/B testing on email content

---

## Files Changed

```
✨ Created
  src/components/copilot/RecommendationMode.tsx
  src/lib/ai/copilot-recommendation-service.ts
  src/lib/ai/email-service.ts
  src/app/api/copilot/recommend/route.ts
  scripts/import-products.js
  README-RECOMMENDATION.md (this file)

🔧 Modified
  package.json (added resend)
  src/components/chat/ChatInterface.tsx (added mode selector)
  src/lib/db/init.sql (added products & recommendation_requests tables)
```

---

## Questions?

Check the comment-documented code in:
- `src/lib/ai/copilot-recommendation-service.ts` — product matching logic
- `src/components/copilot/RecommendationMode.tsx` — UI form
- `src/app/api/copilot/recommend/route.ts` — API endpoint
