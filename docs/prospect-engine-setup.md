# Fleet Shield Prospect Engine — Phase 1 Setup Guide

This guide explains how to set up the daily automated prospecting pipeline for Fleet Shield. Once configured, it will automatically pull 25 pre-scored prospects into Airtable every morning at 7am so you can review and send outreach.

---

## What Gets Built

**Daily flow (fully automatic):**
1. Vibe Prospecting fetches 25 forklift fleet decision-makers
2. Each contact gets enriched with company details
3. The Fleet Shield app scores each contact (A, B, or C) and writes a personalized opener
4. A and B contacts go into your Airtable hit list
5. You get a daily digest email/Slack with today's prospects

---

## Step 1: Airtable Setup

Create a new base called **Fleet Shield Prospects** with this table:

| Field Name     | Field Type     | Notes                              |
|----------------|----------------|------------------------------------|
| Contact Name   | Single line    |                                    |
| Title          | Single line    |                                    |
| Company        | Single line    |                                    |
| Industry       | Single line    |                                    |
| Location       | Single line    |                                    |
| Email          | Email          |                                    |
| Score          | Single select  | Options: A, B, C                   |
| Score Reason   | Long text      |                                    |
| Opener         | Long text      | The personalized first line        |
| Date Added     | Date           | Default to today                   |
| Status         | Single select  | Options: Pending Review, Contacted, Not Qualified |

---

## Step 2: Get Your Fleet Shield Scoring Webhook URL

The Fleet Shield app now has a scoring endpoint. Your Make.com scenario will call this URL:

```
POST https://YOUR-APP-URL/api/v1/prospects/score
```

**Request body (JSON):**
```json
{
  "name": "John Smith",
  "title": "Fleet Manager",
  "company": "Acme Warehousing",
  "industry": "Warehousing",
  "location": "Miami, FL",
  "email": "jsmith@acmeware.com"
}
```

**Response:**
```json
{
  "success": true,
  "score": "A",
  "reason": "Large warehousing operation with fleet manager title",
  "opener": "Hi John — I noticed Acme runs a multi-location distribution network. We help fleet managers like you cut forklift downtime by 30% with predictive maintenance alerts. Worth a quick look?"
}
```

---

## Step 3: Make.com Scenario Setup

Create a new scenario in Make.com with these modules in order:

### Module 1 — Schedule Trigger
- **Type:** Schedule
- **Interval:** Every day at 7:00 AM Eastern

### Module 2 — Vibe Prospecting: Fetch Entities
- **Endpoint:** fetch-entities
- **ICP Filters:**
  - Industries: Warehousing, Distribution, Manufacturing, Logistics, Food & Beverage
  - Titles: VP Operations, Director of Operations, Fleet Manager, Facilities Manager, COO, CEO
  - Company size: 50+ employees
  - Geography: United States
  - Limit: 25

### Module 3 — Vibe Prospecting: Enrich Prospects
- **Input:** Results from Module 2
- Enriches each contact with verified email, phone, LinkedIn, company details

### Module 4 — Iterator
- Loops through all 25 prospects one at a time so the next modules run per-contact

### Module 5 — HTTP: Call Fleet Shield Scoring API
- **URL:** `https://YOUR-APP-URL/api/v1/prospects/score`
- **Method:** POST
- **Body (JSON):**
  - name: `{{contact.name}}`
  - title: `{{contact.title}}`
  - company: `{{contact.company}}`
  - industry: `{{contact.industry}}`
  - location: `{{contact.location}}`
  - email: `{{contact.email}}`

### Module 6 — Filter: A and B Only
- **Condition:** `{{5.score}}` is not equal to `C`
- (This skips C-scored contacts so they never reach Airtable)

### Module 7 — Airtable: Create Record
- **Base:** Fleet Shield Prospects
- **Table:** Prospects
- **Field mapping:**
  - Contact Name → `{{contact.name}}`
  - Title → `{{contact.title}}`
  - Company → `{{contact.company}}`
  - Industry → `{{contact.industry}}`
  - Location → `{{contact.location}}`
  - Email → `{{contact.email}}`
  - Score → `{{5.score}}`
  - Score Reason → `{{5.reason}}`
  - Opener → `{{5.opener}}`
  - Date Added → `{{now}}`
  - Status → `Pending Review`

### Module 8 — Email or Slack: Daily Digest
- Send Kenny a summary of today's prospects
- Include count of A scores, B scores, and a link to the Airtable view

---

## Step 4: Test the Scenario

Before turning it on daily:
1. Run the scenario manually once in Make.com
2. Check that records appear in Airtable with scores and openers
3. Verify the digest email arrives

---

## What Each Score Means

- **A** — High-priority prospect. Likely has a large forklift fleet and the right title. Send the opener directly.
- **B** — Warm prospect. Probably has some forklifts. The opener asks a curiosity question to start a conversation.
- **C** — Not a fit. These are filtered out and never added to Airtable.

---

## Questions?

If anything is unclear or you need help with any step, add a comment to the GitHub issue and Claude will help sort it out.
