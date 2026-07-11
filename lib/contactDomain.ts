import { StoredOpportunitySignal } from "./types";
import { resolvePrimaryTargetForSignal } from "./organizationResolution";

export function cleanDomain(value: string): string {
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

export function isUsefulContactDomain(domain: string): boolean {
  return Boolean(domain) && !/(^|\.)?(usaspending|sam|grants|regulations|federalregister|opengov|google)\./i.test(domain);
}

export function domainFromSignal(signal: StoredOpportunitySignal): string {
  const resolvedDomain = resolvePrimaryTargetForSignal(signal)?.verifiedDomain;
  if (resolvedDomain) {
    return resolvedDomain;
  }

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
    raw.recipient_domain,
    raw.recipientDomain,
    nestedRaw.buyer_domain,
    nestedRaw.buyerDomain,
    nestedRaw.organization_domain,
    nestedRaw.website,
    nestedRaw.buyer_website
  ]
    .filter((value): value is string => typeof value === "string")
    .map(cleanDomain)
    .filter(isUsefulContactDomain);

  return candidates[0] ?? "";
}
