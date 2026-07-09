import { primaryContactTarget } from "../contactTargeting";
import { domainFromSignal } from "../contactDomain";
import { StoredOpportunitySignal } from "../types";

type ClayContactCandidate = {
  name?: unknown;
  full_name?: unknown;
  fullName?: unknown;
  title?: unknown;
  job_title?: unknown;
  role?: unknown;
  email?: unknown;
  work_email?: unknown;
  linkedin_url?: unknown;
  linkedin?: unknown;
  source_url?: unknown;
  source?: unknown;
  confidence?: unknown;
  rationale?: unknown;
};

type ClayWorkflowResponse = {
  contacts?: unknown;
  people?: unknown;
  results?: unknown;
  rows?: unknown;
  data?: unknown;
  message?: unknown;
};

export type ClayContactEnrichmentResult = {
  provider: "clay";
  status: "completed" | "needs_target" | "not_configured" | "failed";
  organization: string;
  domain?: string;
  target_roles: string[];
  contacts: Array<{
    name: string;
    title: string;
    email: string;
    linkedin_url?: string;
    source_url?: string;
    confidence: "high" | "medium" | "low";
    rationale: string;
  }>;
  message: string;
};

function contactLimit(): number {
  const configured = Number(process.env.OPPORTUNITY_SCANNER_CONTACTS_PER_OPPORTUNITY ?? 5);
  if (!Number.isFinite(configured)) {
    return 5;
  }
  return Math.max(1, Math.min(10, Math.floor(configured)));
}

export function isClayContactWorkflowConfigured(): boolean {
  return Boolean(process.env.CLAY_CONTACT_WORKFLOW_URL || process.env.CLAY_CONTACT_ENRICHMENT_WEBHOOK_URL);
}

function workflowUrl(): string {
  return process.env.CLAY_CONTACT_WORKFLOW_URL || process.env.CLAY_CONTACT_ENRICHMENT_WEBHOOK_URL || "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function responseContactArrays(data: ClayWorkflowResponse): unknown[] {
  const nested = typeof data.data === "object" && data.data ? (data.data as ClayWorkflowResponse) : {};
  return [
    data.contacts,
    data.people,
    data.results,
    data.rows,
    nested.contacts,
    nested.people,
    nested.results,
    nested.rows
  ].filter(Array.isArray);
}

function normalizeConfidence(value: unknown, hasEmail: boolean): "high" | "medium" | "low" {
  const text = stringValue(value).toLowerCase();
  if (text === "high" || text === "medium" || text === "low") {
    return text;
  }
  return hasEmail ? "medium" : "low";
}

function normalizeContact(contact: ClayContactCandidate) {
  const email = stringValue(contact.email) || stringValue(contact.work_email);
  const linkedinUrl = stringValue(contact.linkedin_url) || stringValue(contact.linkedin);
  return {
    name: stringValue(contact.name) || stringValue(contact.full_name) || stringValue(contact.fullName),
    title: stringValue(contact.title) || stringValue(contact.job_title) || stringValue(contact.role),
    email,
    linkedin_url: linkedinUrl || undefined,
    source_url: stringValue(contact.source_url) || stringValue(contact.source) || undefined,
    confidence: normalizeConfidence(contact.confidence, Boolean(email)),
    rationale:
      stringValue(contact.rationale) ||
      (email
        ? "Clay returned this as a named contact/email candidate for the target organization."
        : "Clay returned this as a named role candidate. Use LinkedIn/manual routing if email is missing.")
  };
}

function flattenContacts(data: ClayWorkflowResponse) {
  return responseContactArrays(data)
    .flatMap((items) => items)
    .filter((item): item is ClayContactCandidate => typeof item === "object" && item !== null)
    .map(normalizeContact)
    .filter((contact) => contact.name || contact.email || contact.linkedin_url)
    .slice(0, contactLimit());
}

export async function enrichContactsWithClay(signal: StoredOpportunitySignal): Promise<ClayContactEnrichmentResult> {
  const target = primaryContactTarget(signal);
  const domain = domainFromSignal(signal);
  const url = workflowUrl();

  if (!isClayContactWorkflowConfigured()) {
    return {
      provider: "clay",
      status: "not_configured",
      organization: target.organization,
      domain: domain || undefined,
      target_roles: target.roles,
      contacts: [],
      message: "Clay contact workflow URL is not configured."
    };
  }

  if (!domain && (!target.organization || target.organization === "Buyer or funded organization")) {
    return {
      provider: "clay",
      status: "needs_target",
      organization: target.organization,
      target_roles: target.roles,
      contacts: [],
      message: "Clay needs a target company domain, organization name, or LinkedIn company URL before contact enrichment."
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (process.env.CLAY_API_KEY) {
      headers.Authorization = `Bearer ${process.env.CLAY_API_KEY}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        company_domain: domain || undefined,
        company_name: target.organization,
        target_roles: target.roles.slice(0, 6),
        contact_limit: contactLimit(),
        opportunity: {
          title: signal.opportunity_title,
          source_name: signal.source_name,
          source_type: signal.source_type,
          source_url: signal.source_url,
          evidence_summary: signal.external_evidence_summary,
          likely_buyer_or_partner: signal.likely_buyer_or_partner,
          agency_or_funder: signal.agency_or_funder,
          revenue_pathway: signal.revenue_pathway,
          next_best_action: signal.next_best_action || signal.best_next_step
        }
      })
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Clay workflow failed: HTTP ${response.status}: ${text.slice(0, 160)}`);
    }

    const data = (text ? JSON.parse(text) : {}) as ClayWorkflowResponse;
    const contacts = flattenContacts(data);
    return {
      provider: "clay",
      status: "completed",
      organization: target.organization,
      domain: domain || undefined,
      target_roles: target.roles,
      contacts,
      message: contacts.length
        ? `Clay returned ${contacts.length} named contact candidate(s). Verify before automated sending.`
        : stringValue(data.message) || "Clay workflow completed but returned no usable contacts."
    };
  } catch (error) {
    return {
      provider: "clay",
      status: "failed",
      organization: target.organization,
      domain: domain || undefined,
      target_roles: target.roles,
      contacts: [],
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
