# Power Automate Setup for Automatic Invoice Processing

This guide explains how to set up Microsoft Power Automate to automatically send invoice emails to the Forklift Fleet Manager for processing.

## Overview

When configured, the system will:
1. Monitor your Outlook inbox for invoices from specific vendors
2. Extract the email details and attachments
3. Send them to the Fleet Manager API for OCR processing
4. Automatically create maintenance records or queue them for review

## Prerequisites

- Microsoft 365 account with Power Automate access
- Your Fleet Manager API endpoint URL (e.g., `https://your-app.railway.app`)
- Admin access to configure the inbox rules

## Step-by-Step Setup

### Step 1: Create a New Flow

1. Go to [Power Automate](https://make.powerautomate.com/)
2. Click **Create** → **Automated cloud flow**
3. Name your flow: "Invoice to Fleet Manager"
4. Select trigger: **When a new email arrives (V3)** (Office 365 Outlook)
5. Click **Create**

### Step 2: Configure the Email Trigger

Configure the trigger with these settings:

| Setting | Value |
|---------|-------|
| Folder | Inbox |
| Include Attachments | Yes |
| Only with Attachments | Yes |

**Optional Filters** (recommended):
- **From**: Add your vendor emails, e.g., `invoices@southernstatestoyotalift.com`
- **Subject Filter**: Contains "invoice" or "maintenance"

### Step 3: Add a Condition (Optional but Recommended)

Add a **Condition** action to filter for invoice-like emails:

```
Subject contains "invoice"
OR
Subject contains "maintenance"
OR
From contains "toyotalift"
```

### Step 4: Add HTTP Action to Send to API

Inside the "If yes" branch, add an **HTTP** action:

| Setting | Value |
|---------|-------|
| Method | POST |
| URI | `https://your-app.railway.app/api/v1/inbound-invoices/webhook/json` |
| Headers | Content-Type: application/json |

**Body:**
```json
{
  "email": {
    "from": "@{triggerOutputs()?['body/from']}",
    "subject": "@{triggerOutputs()?['body/subject']}",
    "date": "@{triggerOutputs()?['body/receivedDateTime']}"
  },
  "attachment": "@{first(triggerOutputs()?['body/attachments'])?['contentBytes']}",
  "attachmentName": "@{first(triggerOutputs()?['body/attachments'])?['name']}"
}
```

### Step 5: Handle Multiple Attachments (Optional)

If invoices might have multiple attachments, use an **Apply to each** loop:

1. Add **Apply to each** action
2. Select: `triggerOutputs()?['body/attachments']`
3. Inside the loop, add the HTTP action with:

```json
{
  "email": {
    "from": "@{triggerOutputs()?['body/from']}",
    "subject": "@{triggerOutputs()?['body/subject']}",
    "date": "@{triggerOutputs()?['body/receivedDateTime']}"
  },
  "attachment": "@{items('Apply_to_each')?['contentBytes']}",
  "attachmentName": "@{items('Apply_to_each')?['name']}"
}
```

### Step 6: Add Error Handling (Recommended)

After the HTTP action, add a **Condition** to check for errors:

```
Status code is equal to 200
```

**If no:** Send yourself an email notification about the failed processing.

### Step 7: Save and Test

1. Click **Save**
2. Click **Test** → **Manually**
3. Send a test invoice email to trigger the flow
4. Check the Fleet Manager **Invoice Processing** page to see the result

## Alternative: Using Multipart Form Data

If you prefer to send the attachment as a file upload instead of base64:

1. Use the **HTTP** action with **Method: POST**
2. Set **URI** to: `https://your-app.railway.app/api/v1/inbound-invoices/webhook`
3. Add a **Parse JSON** action before to extract attachment content
4. Use the **Compose** action to create form data

## Testing Without Power Automate

You can test the system manually:

1. Go to **Admin** → **Invoice Processing** in the Fleet Manager
2. Click **Upload Invoice**
3. Select a PDF or image of an invoice
4. The system will OCR and extract the data

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/inbound-invoices/webhook` | POST | Multipart form upload |
| `/api/v1/inbound-invoices/webhook/json` | POST | JSON with base64 attachment |
| `/api/v1/inbound-invoices/upload` | POST | Manual file upload |
| `/api/v1/inbound-invoices` | GET | List all inbound invoices |
| `/api/v1/inbound-invoices/pending` | GET | Get invoices pending review |
| `/api/v1/inbound-invoices/:id/approve` | POST | Approve and create record |
| `/api/v1/inbound-invoices/:id/reject` | POST | Reject an invoice |

## Troubleshooting

### Invoice not being processed
- Check the Power Automate flow run history for errors
- Verify the API endpoint URL is correct
- Ensure the attachment is a supported format (PDF, PNG, JPG)

### Poor OCR results
- Ensure the invoice image is clear and high resolution
- PDFs with selectable text work better than scanned images
- The system works best with typed/printed invoices, not handwritten

### Wrong forklift matched
- Review the invoice in the Fleet Manager UI
- Manually select the correct forklift
- The system learns from your corrections over time

## Vendor-Specific Tips

### Southern States Toyotalift
- Invoices are typically PDF attachments
- Look for "Reference" field for unit ID matching
- "Make: RAYM" = Raymond equipment

### Other Vendors
- Configure email filters for each vendor
- Test with sample invoices before going live
- Adjust extraction patterns if needed (contact support)

## Support

For issues with the integration, check:
1. Power Automate flow run history
2. Fleet Manager Invoice Processing page for error messages
3. Browser console for JavaScript errors

Contact your system administrator for API access or configuration changes.
