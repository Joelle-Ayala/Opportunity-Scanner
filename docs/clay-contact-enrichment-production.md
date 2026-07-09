# Clay Contact Enrichment Production Handoff

Date: July 9, 2026

## Current Status

Opportunity Scanner is already wired for a Clay-first paid contact enrichment path, but production needs a callable Clay workflow/function URL.

Current server behavior:

- Paid users can request `find_contacts` from a full opportunity report.
- Source-native contacts are preferred when present.
- Clay is attempted first when `CLAY_CONTACT_WORKFLOW_URL` or `CLAY_CONTACT_ENRICHMENT_WEBHOOK_URL` is configured.
- Snov.io is used as fallback when Clay is not configured, fails, has no target, or returns fewer useful contacts than the cap.
- Contacts are capped by `OPPORTUNITY_SCANNER_CONTACTS_PER_OPPORTUNITY`, default `5`, hard-capped at `10`.

## Clay Workspace Findings

Workspace:

- `https://app.clay.com/workspaces/364973/home`

Opportunity Scanner workbook:

- `https://app.clay.com/workspaces/364973/workbooks/wb_0thwuuyhXsesGkfVnJp`
- Current status: workbook exists and is named `Opportunity Scanner`.
- Browser inspection showed this workbook is currently a workspace shell with create/import/table options visible, not yet a confirmed production-callable contact workflow.

Relevant existing Clay table:

- `Find key decision makers at any company with just a website URL`
- URL:
  `https://app.clay.com/workspaces/364973/tables/t_ZHY6pGdpY5bY/views/gv_PKWHEpDA6ZoE`

Useful columns detected:

- `company_domain`
- `Enrich Company`
- `Org`
- `Find & Enrich Person from Google Search (1)`
- `Title`
- `Validated Work Email`

Clay MCP test result:

- Company tested: `degy.com`
- Clay returned named DEGY contacts including Caite Kendrick, Nick DiRoma, Sean Sullivan, Paige Moyer, Aislinn Jones, and Jeff Hyman.
- Email enrichment completed for several contacts. Do not publish the returned emails in public repo documentation; use Clay/task results or private outreach packages for actual contact values.

This confirms Clay is a viable contact source for the Jammcard-style vendor/channel motion. The current blocker is production access, not enrichment quality.

## Clay MCP Status

Clay MCP is connected and useful for operator-assisted enrichment inside agent sessions.

Current MCP capabilities observed:

- Can run company/contact searches such as finding decision makers at a company domain.
- Can add contact enrichment data points such as work email when explicitly requested.
- Can return task context with enriched contact values.

Current MCP limitation:

- No custom subroutines are currently exposed by `list_subroutines`.
- The connected MCP is not the same thing as a public production endpoint for the Opportunity Scanner website.
- Do not assume the live Next.js app can call this Codex/ChatGPT MCP connection directly.

Recommended use:

- Use Clay MCP for manual premium report builds and QA enrichment checks.
- Use a Clay Function, webhook, or API endpoint for production paid-user enrichment.

## Production Contract Needed

Create a Clay Function, workflow webhook, or API endpoint that accepts:

```json
{
  "company_domain": "degy.com",
  "company_name": "DEGY Booking International",
  "target_roles": [
    "Director of Business Development",
    "Partnerships Director",
    "Booking Agent",
    "Vice President"
  ],
  "contact_limit": 5,
  "opportunity": {
    "title": "Public event entertainment award",
    "source_name": "USAspending.gov",
    "source_type": "award",
    "source_url": "https://www.usaspending.gov/award/example",
    "evidence_summary": "Public-sector entertainment spend indicates vendor/channel fit.",
    "likely_buyer_or_partner": "DEGY Booking International",
    "agency_or_funder": "Public-sector buyer",
    "revenue_pathway": "Partner with Recipient",
    "next_best_action": "Contact business development or booking leadership."
  }
}
```

Return one of these shapes:

```json
{
  "contacts": [
    {
      "name": "Caite Kendrick",
      "title": "Director of Business Development",
      "email": "caite@degy.com",
      "linkedin_url": "https://www.linkedin.com/in/...",
      "confidence": "high",
      "rationale": "Business development role aligned to public-sector event/channel opportunity."
    }
  ],
  "message": "Clay returned named contact candidates."
}
```

Also acceptable:

- `people`
- `results`
- `rows`
- nested under `data.contacts`, `data.people`, `data.results`, or `data.rows`

Opportunity Scanner normalizes these fields:

- `name`, `full_name`, or `fullName`
- `title`, `job_title`, or `role`
- `email` or `work_email`
- `linkedin_url` or `linkedin`
- `source_url` or `source`
- `confidence`
- `rationale`

## Environment Variables

Set these in Vercel after the Clay endpoint exists:

```bash
CLAY_CONTACT_WORKFLOW_URL=https://...
CLAY_API_KEY=...
OPPORTUNITY_SCANNER_CONTACTS_PER_OPPORTUNITY=5
```

Do not commit real Clay API keys or webhook URLs into the repo.

## Definition Of Done

- Clay endpoint accepts company domain, company name, target roles, contact limit, and opportunity context.
- Endpoint returns up to 5 contacts with role/title/email/LinkedIn where available.
- Vercel production has `CLAY_CONTACT_WORKFLOW_URL` configured.
- Paid report contact enrichment returns `provider: "clay"` or `provider: "clay+snov"` for company/domain targets.
- Source-native contacts still win for SAM.gov and Grants.gov records.
- Public agencies without a useful domain produce source-native/manual contact instructions instead of fake personal contacts.

## Founder-Friendly Summary

Clay is working as an enrichment source. The app is ready to call it for paid users. The remaining setup item is creating or exposing a Clay workflow endpoint that the live website can call from Vercel.
