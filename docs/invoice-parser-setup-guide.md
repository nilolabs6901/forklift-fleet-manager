# Invoice Parser Setup Guide

**Fleet Shield** automatically reads your maintenance invoices, pulls out the important details, matches them to the right forklift, and creates a maintenance record — all without you lifting a finger.

This guide walks you through how to get it working.

---

## What It Does

When your forklift service company sends you an invoice by email, Fleet Shield:

1. **Receives the invoice** via email forwarding
2. **Reads the document** using AI-powered image recognition (works on PDFs, photos, scans)
3. **Pulls out the details** — vendor, invoice number, costs, serial number, work description
4. **Matches it to the right forklift** in your fleet using serial numbers, unit IDs, and model info
5. **Creates a maintenance record** automatically if the match is strong (80%+ confidence)
6. **Sends it to your review queue** if it needs a human eye before posting

It also catches **duplicate invoices** so you don't accidentally double-count anything.

---

## Step 1: Set Up Email Forwarding

This is the only thing you need to do on your end. You're telling your email inbox: "When an invoice comes in, forward a copy to Fleet Shield."

### What You'll Need

When your account is created, you'll receive a **unique inbound email address** like:

```
your-company-invoices@fleetshield.com
```

This is your company's dedicated address. Any invoice sent to this address gets processed automatically.

### Option A: Auto-Forward from Gmail

1. Open Gmail, click the gear icon, then **See all settings**
2. Go to **Forwarding and POP/IMAP**
3. Click **Add a forwarding address**
4. Enter your Fleet Shield inbound email address
5. Confirm the verification email
6. Under **Forwarding**, select **Forward a copy of incoming mail to** your Fleet Shield address
7. (Optional) Create a filter so only emails from your service vendors get forwarded:
   - Click **creating a filter** link
   - Set "From" to your vendor's email domain (e.g., `@southernstatestoyotalift.com`)
   - Check **Forward it to** and select your Fleet Shield address

### Option B: Auto-Forward from Outlook / Microsoft 365

1. Go to **Settings** > **Mail** > **Forwarding**
2. Check **Enable forwarding**
3. Enter your Fleet Shield inbound email address
4. Check **Keep a copy of forwarded messages** (recommended)
5. Click **Save**

For rules-based forwarding (only invoices from certain vendors):
1. Go to **Settings** > **Mail** > **Rules**
2. Add a new rule: "If from contains [vendor domain]"
3. Action: "Forward to [your Fleet Shield address]"

### Option C: Power Automate / Zapier

If you use Power Automate or Zapier, you can set up a flow that:
1. Triggers when a new email arrives from your service vendor
2. Extracts the attachment
3. Sends it to the Fleet Shield webhook

See the [Power Automate Setup Guide](power-automate-setup.md) for step-by-step instructions.

---

## Step 2: Register Your Vendor Domains

Fleet Shield uses the sender's email domain to figure out which company the invoice belongs to. Your primary vendor domain gets set up when your account is created.

If you get invoices from **multiple service companies**, let us know their email domains so we can link them to your account. For example:

- `@southernstatestoyotalift.com` (primary)
- `@ring-power.com` (additional)
- `@totalwarehouse.com` (additional)

This way, invoices from any of those vendors automatically route to your account.

---

## Step 3: That's It — Invoices Start Flowing

Once forwarding is on, here's what happens every time an invoice lands:

| Step | What Happens | Time |
|------|-------------|------|
| 1 | Email arrives at your Fleet Shield address | Instant |
| 2 | System identifies your account from the email | Instant |
| 3 | AI reads the invoice attachment | ~5 seconds |
| 4 | Details extracted (vendor, costs, serial #, work done) | ~5 seconds |
| 5 | Duplicate check — blocks repeat invoices | Instant |
| 6 | Matched to the right forklift in your fleet | Instant |
| 7a | **High confidence match (80%+):** Maintenance record created automatically | Instant |
| 7b | **Lower confidence:** Sent to review queue for your approval | Instant |

---

## Reviewing Invoices

### Automatic vs. Manual

- **Auto-processed** — The system is confident it matched the right forklift. A maintenance record is created with all the costs, work description, and vendor info filled in. You'll see these marked as "Auto-Processed."

- **Ready for Review** — The system found a possible match but isn't confident enough to post it automatically. You'll see these in your review queue with the extracted data and suggested match. Just click **Approve** to create the maintenance record, or **Reject** if something looks off.

### Unmatched Invoices

If the system can't figure out which company an invoice belongs to (maybe it came from a new vendor domain), it goes to the **Unmatched Queue**. From there you can manually assign it to the right account.

---

## What Invoice Formats Work?

The parser handles:

- **PDF invoices** (most common)
- **Scanned images** — PNG, JPG, JPEG
- **Photos** — Take a picture of a paper invoice and email it
- **Other image formats** — GIF, TIFF, BMP

**Max file size:** 10 MB per attachment

**Tip:** Clear, high-resolution scans give the best results. If an invoice is blurry or has handwritten notes over printed text, accuracy may be lower.

---

## What Data Gets Extracted?

The AI pulls out these fields from every invoice:

| Field | Example |
|-------|---------|
| Vendor name | Southern States Toyotalift |
| Invoice number | INV-2026-04521 |
| Invoice date | 03/15/2026 |
| PO number | PO-88412 |
| Unit / asset reference | FL-0023 |
| Serial number | A1B2C3D456 |
| Make & model | Toyota 8FG25 |
| Work description | 2000-hour PM service, replaced tires |
| Labor cost | $450.00 |
| Parts cost | $1,230.00 |
| Tax | $134.40 |
| Total amount | $1,814.40 |
| Line items | Individual parts and labor breakdown |

---

## How Forklift Matching Works

The system scores each forklift in your fleet against the invoice data:

| Match Factor | Weight |
|-------------|--------|
| Serial number match | Strongest |
| Unit ID / asset reference | Strong |
| Model match | Moderate |
| Make (manufacturer) | Light |
| Location mention | Light |

If the combined score hits **80% or higher**, the maintenance record is created automatically. Below that, it goes to your review queue so you can confirm or correct the match.

---

## Duplicate Protection

If the same invoice number from the same vendor comes through twice, the system catches it and blocks the duplicate. You'll never accidentally double-count a maintenance expense.

---

## For Technical Teams: API Integration

If you're connecting Fleet Shield to another system (ERP, accounting, custom tools), here are the direct API endpoints:

### Send an Invoice via Webhook

**Multipart form upload:**
```
POST /api/v1/inbound-invoices/webhook

Fields:
  from     — sender email address
  to       — recipient email address
  subject  — email subject line
  date     — email date
  body     — email body text
  file     — invoice attachment (PDF/image, max 10MB)
```

**JSON with base64 attachment:**
```
POST /api/v1/inbound-invoices/webhook/json

Body:
{
  "email": {
    "from": "billing@vendor.com",
    "to": "your-company@fleetshield.com",
    "subject": "Invoice #INV-12345",
    "date": "2026-03-29"
  },
  "attachment": "<base64-encoded file>",
  "attachmentName": "invoice.pdf"
}
```

### Check Invoice Status
```
GET /api/v1/inbound-invoices/:id
```

### List All Invoices
```
GET /api/v1/inbound-invoices?status=ready_for_review
```

### Approve an Invoice
```
POST /api/v1/inbound-invoices/:id/approve
Body: { "forklift_id": "FL-0023" }
```

### Reject an Invoice
```
POST /api/v1/inbound-invoices/:id/reject
Body: { "reason": "Wrong vendor" }
```

### View Unmatched Invoices
```
GET /api/v1/inbound-invoices/unmatched
```

### Assign Tenant to Unmatched Invoice
```
PUT /api/v1/inbound-invoices/:id/assign-tenant
Body: { "tenant_id": 5 }
```

---

## Environment Setup (Admin Only)

The invoice parser requires one API key to power the AI document reading:

```
ANTHROPIC_API_KEY=your_key_here
```

Get this from [console.anthropic.com](https://console.anthropic.com). This powers the Claude Vision AI that reads and understands invoice documents.

Set this in your `.env` file or in your hosting platform's environment variables (e.g., Railway).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Invoice not showing up | Check that email forwarding is active and the vendor domain is registered to your account |
| Wrong forklift matched | Approve or reject from the review queue — make sure your fleet has serial numbers entered |
| Duplicate blocked | This is working as intended — the same invoice number + vendor won't process twice |
| Low match confidence | Ensure your fleet records have serial numbers, unit IDs, and model info filled in |
| Invoice shows as "error" | The attachment may be corrupted or unreadable — try re-sending a clearer scan |

---

## Questions?

Reach out to your Fleet Shield admin or contact support. We're here to help get your invoices flowing smoothly.
