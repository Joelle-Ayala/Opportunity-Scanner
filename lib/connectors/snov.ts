import { primaryContactTarget } from "../contactTargeting";
import { StoredOpportunitySignal } from "../types";

type SnovTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type SnovDomainEmail = {
  email?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  sourcePage?: string;
  type?: string;
  status?: string;
};

type SnovDomainResponse = {
  success?: boolean;
  domain?: string;
  webmail?: boolean;
  result?: number;
  lastId?: number;
  emails?: SnovDomainEmail[];
};

export type ContactEnrichmentResult = {
  provider: "snov";
  status: "completed" | "needs_domain" | "not_configured" | "failed";
  organization: string;
  domain?: string;
  target_roles: string[];
  contacts: Array<{
    name: string;
    title: string;
    email: string;
    source_url?: string;
    confidence: "high" | "medium" | "low";
    rationale: string;
  }>;
  message: string;
};

export function isSnovConfigured(): boolean {
  return Boolean(process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET);
}

async function getAccessToken(): Promise<string> {
  const response = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SNOV_CLIENT_ID ?? "",
      client_secret: process.env.SNOV_CLIENT_SECRET ?? ""
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Snov auth failed: HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  const data = JSON.parse(text) as SnovTokenResponse;
  if (!data.access_token) {
    throw new Error("Snov auth failed: no access token returned");
  }

  return data.access_token;
}

function cleanDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

function isUsefulDomain(domain: string): boolean {
  return Boolean(domain) && !/(^|\.)?(usaspending|sam|grants|regulations|federalregister|opengov|google)\./i.test(domain);
}

function domainFromSignal(signal: StoredOpportunitySignal): string {
  const raw = signal.raw_json ?? {};
  const nestedRaw = typeof raw.raw_json === "object" && raw.raw_json ? (raw.raw_json as Record<string, unknown>) : {};
  const candidates = [
    raw.buyer_domain,
    raw.buyerDomain,
    raw.organization_domain,
    raw.organizationDomain,
    raw.website,
    raw.buyer_website,
    raw.buyerWebsite,
    nestedRaw.buyer_domain,
    nestedRaw.buyerDomain,
    nestedRaw.website,
    nestedRaw.buyer_website
  ]
    .filter((value): value is string => typeof value === "string")
    .map(cleanDomain)
    .filter(isUsefulDomain);

  return candidates[0] ?? "";
}

function contactFitScore(contact: SnovDomainEmail, roles: string[]): number {
  const title = (contact.position ?? "").toLowerCase();
  let score = 30;

  for (const role of roles) {
    for (const token of role.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length >= 4)) {
      if (title.includes(token)) {
        score += 18;
      }
    }
  }

  if (/director|manager|coordinator|procurement|contract|buyer|program|events|arts|culture|tourism|parks|grants|workforce|talent|hr|human resources/.test(title)) {
    score += 24;
  }

  if (/assistant|intern|student|volunteer/.test(title)) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeContact(contact: SnovDomainEmail, roles: string[]) {
  const score = contactFitScore(contact, roles);
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return {
    name,
    title: contact.position ?? "",
    email: contact.email ?? "",
    source_url: contact.sourcePage,
    confidence: score >= 72 ? "high" as const : score >= 52 ? "medium" as const : "low" as const,
    rationale:
      score >= 52
        ? "Title appears aligned with the opportunity's recommended buyer or program-owner roles."
        : "Email is associated with the domain, but title alignment is weak and should be reviewed."
  };
}

async function findDomainEmails(domain: string, accessToken: string): Promise<SnovDomainResponse> {
  const params = new URLSearchParams({
    access_token: accessToken,
    domain,
    type: "all",
    limit: "10"
  });
  const response = await fetch(`https://api.snov.io/v1/get-domain-emails-with-info?${params}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Snov domain lookup failed: HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  return JSON.parse(text) as SnovDomainResponse;
}

export async function enrichContactsWithSnov(signal: StoredOpportunitySignal): Promise<ContactEnrichmentResult> {
  const target = primaryContactTarget(signal);
  const domain = domainFromSignal(signal);

  if (!isSnovConfigured()) {
    return {
      provider: "snov",
      status: "not_configured",
      organization: target.organization,
      target_roles: target.roles,
      contacts: [],
      message: "Snov credentials are not configured."
    };
  }

  if (!domain) {
    return {
      provider: "snov",
      status: "needs_domain",
      organization: target.organization,
      target_roles: target.roles,
      contacts: [],
      message:
        "The opportunity has a target organization and contact roles, but no verified organization domain yet. Resolve the buyer/recipient website before running Snov contact lookup."
    };
  }

  try {
    const accessToken = await getAccessToken();
    const data = await findDomainEmails(domain, accessToken);
    const contacts = (data.emails ?? [])
      .filter((item) => item.email)
      .map((item) => normalizeContact(item, target.roles))
      .filter((item) => item.confidence !== "low")
      .slice(0, 5);

    return {
      provider: "snov",
      status: "completed",
      organization: target.organization,
      domain,
      target_roles: target.roles,
      contacts,
      message: contacts.length
        ? `Found ${contacts.length} role-aligned contact candidate(s) on ${domain}.`
        : `Snov returned domain emails for ${domain}, but none were role-aligned enough to recommend without review.`
    };
  } catch (error) {
    return {
      provider: "snov",
      status: "failed",
      organization: target.organization,
      domain,
      target_roles: target.roles,
      contacts: [],
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
