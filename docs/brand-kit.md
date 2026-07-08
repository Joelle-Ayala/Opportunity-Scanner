# Opportunity Scanner Brand Kit

## Brand Position

Opportunity Scanner is the operating layer for public-sector opportunity intelligence. It should feel like a serious B2B SaaS product, an intelligence dashboard, and an action workspace for revenue teams.

The product should say: we found credible public-sector opportunities, why they matter, and what to do next.

It should not feel like a generic grant finder, a raw government search portal, or an AI-written research memo.

## Brand Attributes

- Clear
- Credible
- Action-oriented
- Source-backed
- Practical
- Executive-ready

## Visual System

Primary colors:

- Ink: `#14213D`
- Field: `#F6F7F9`
- Line: `#D9DEE7`
- Accent: `#0E7C86`

Supporting colors:

- Signal: `#2E9D70`
- Review: `#C7861D`
- Ember: `#D95D39`
- Steel: `#42526E`
- Mist: `#E9F4F3`
- Cream: `#FBFAF7`

Use accent colors to communicate product meaning: signal for high actionability, review for follow-up or timing, ember for priority attention, and teal for primary actions.

## Typography

Use a quiet system sans-serif stack. Headings should be confident and compact. Dashboard, table, and form text should prioritize scanability over marketing drama.

Avoid oversized copy in dense panels. Use hero-scale type only on the homepage first viewport.

## UI Principles

- Put the scan form and product value in the first viewport.
- Treat the Opportunity Action Table as the core product surface.
- Use cards for repeated items and specific panels, not for every page section.
- Keep internal/debug concepts out of customer surfaces.
- Prefer labels like “High Actionability,” “Workflow ready,” and “Contact path” over raw scores or internal field names.
- Show source credibility without exposing connector plumbing.

## Component Rules

- Buttons: primary actions use Accent with white text; secondary actions use white backgrounds with Line borders; destructive or warning actions use Review or Red.
- Badges: use Signal for high actionability, Accent/Mist for informational labels, Review for timing or review states, and Slate/Steel for neutral metadata.
- Panels: customer-facing panels use white backgrounds, Line borders, 8px radii, and subtle shadows only when the panel is a primary action surface.
- Tables: desktop tables should prioritize opportunity, target, revenue motion, contact path, and next action. Mobile should use cards instead of horizontal table scanning.
- Locked states: preview real value, then route to a clear request/access path. Do not show paid-only source links, CRM notes, or workflow payloads.
- Report hierarchy: executive summary first, Opportunity Action Table second, supporting profile/source context after the table.
- Admin/debug: keep raw JSON, query strategy, and connector mechanics in admin-only views.

## Voice

Write like an operator briefing a founder or revenue leader:

- “Here is the opportunity.”
- “Here is why it matters.”
- “Here is who to contact or research.”
- “Here is the next best action.”

Avoid generic phrases like “AI-powered insights” unless the sentence also explains a concrete business development action.
