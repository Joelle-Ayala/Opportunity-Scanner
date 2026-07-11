export type OrganizationTargetType =
  | "agency"
  | "funded_buyer"
  | "award_recipient"
  | "distributor_prime_candidate"
  | "grantee_partner_candidate"
  | "provider"
  | "research_only";

export type OrganizationEvidenceRole =
  | "agency"
  | "buyer"
  | "recipient"
  | "prime_awardee"
  | "distributor"
  | "grantee"
  | "eligible_applicant"
  | "provider"
  | "unknown";

export type OrganizationEvidence = {
  sourceName: string;
  sourceUrl: string;
  sourceRecordId?: string;
  field: string;
  value: string;
  role: OrganizationEvidenceRole;
  domain?: string;
  domainField?: string;
};

export type OrganizationTargetResolution = {
  resolutionVersion: "organization-target-v1";
  normalizedOrganizationKey: string;
  displayName: string;
  aliases: string[];
  targetType: OrganizationTargetType;
  isPublicAgency: boolean;
  confidence: {
    level: "high" | "medium" | "low";
    score: number;
    rationale: string;
  };
  evidence: OrganizationEvidence[];
  verifiedDomain?: string;
  verifiedDomainEvidence?: {
    sourceName: string;
    sourceUrl: string;
    sourceRecordId?: string;
    field: string;
    value: string;
  };
  contactRoute:
    | "procurement_office"
    | "program_office"
    | "vendor_registration"
    | "commercial_role_enrichment"
    | "manual_research";
  manualResearchRequired: boolean;
  manualResearchReason?: string;
};

export type EnrichmentEligibility = {
  clayEligible: boolean;
  snovEligible: boolean;
  reason: string;
  verifiedDomain?: string;
  targetRoles: string[];
};

type OpportunitySignalLike = {
  source_name: string;
  source_url: string;
  source_type: string;
  agency_or_funder: string;
  likely_buyer_or_partner: string;
  revenue_pathway: string;
  external_evidence_summary?: string;
  recommended_contact_roles?: string[];
  raw_json?: Record<string, unknown>;
};

const LEGAL_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "lp",
  "ltd",
  "limited",
  "pc",
  "pllc"
]);

const PLACEHOLDER_TARGETS = /^(agency|buyer|recipient|organization) not listed$|^eligible applicants|^future award recipients|^buyer or funded organization$|^needs review$/i;
const PUBLIC_AGENCY_NAME = /\b(city|county|state|town|township|village|borough) of\b|\bdepartment\b|\bagency\b|\badministration\b|\bpublic schools?\b|\bschool district\b|\bunified school district\b|\bcommunity college district\b|\bgovernment\b|\bfederal\b/i;
const DOMAIN_FIELDS = new Set([
  "buyer_domain",
  "buyerDomain",
  "organization_domain",
  "organizationDomain",
  "buyer_website",
  "buyerWebsite",
  "recipient_domain",
  "recipientDomain",
  "recipient_website",
  "recipientWebsite",
  "official_website",
  "officialWebsite",
  "website"
]);
const SOURCE_DOMAINS = /(^|\.)(usaspending\.gov|sam\.gov|grants\.gov|federalregister\.gov|google\.com)$/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function normalizeOrganizationName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

export function cleanVerifiedDomain(value: string): string {
  const candidate = value.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isPublicAgencyEvidence(evidence: OrganizationEvidence[]): boolean {
  return evidence.some((item) => item.role === "agency") || evidence.some((item) => PUBLIC_AGENCY_NAME.test(item.value));
}

function chooseDisplayName(evidence: OrganizationEvidence[]): string {
  return [...new Set(evidence.map((item) => item.value.trim()).filter(Boolean))].sort((a, b) => {
    const aLegal = normalizeOrganizationName(a) !== a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const bLegal = normalizeOrganizationName(b) !== b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (aLegal !== bLegal) return aLegal ? 1 : -1;
    return a.length - b.length || a.localeCompare(b);
  })[0] ?? "Organization needs research";
}

function targetTypeFor(evidence: OrganizationEvidence[], isPublicAgency: boolean): {
  type: OrganizationTargetType;
  conflict?: string;
} {
  const roles = new Set(evidence.map((item) => item.role));
  const commercialRole = roles.has("distributor") || roles.has("provider") || roles.has("prime_awardee");
  if (isPublicAgency && commercialRole) {
    return { type: "research_only", conflict: "Evidence conflicts between a public-agency identity and a commercial provider, distributor, or prime role." };
  }
  if (isPublicAgency) return { type: "agency" };
  if (roles.has("distributor") || roles.has("prime_awardee")) return { type: "distributor_prime_candidate" };
  if (roles.has("provider")) return { type: "provider" };
  if (roles.has("grantee") || roles.has("eligible_applicant")) return { type: "grantee_partner_candidate" };
  if (roles.has("recipient")) return { type: "award_recipient" };
  if (roles.has("buyer")) return { type: "funded_buyer" };
  return { type: "research_only" };
}

function domainResolution(evidence: OrganizationEvidence[]): {
  domain?: string;
  source?: OrganizationTargetResolution["verifiedDomainEvidence"];
  conflict?: string;
} {
  const candidates = evidence.flatMap((item) => {
    if (!item.domain || !item.domainField || !DOMAIN_FIELDS.has(item.domainField) || !item.sourceName || !item.sourceUrl) return [];
    const domain = cleanVerifiedDomain(item.domain);
    if (!domain || SOURCE_DOMAINS.test(domain)) return [];
    return [{ domain, source: { sourceName: item.sourceName, sourceUrl: item.sourceUrl, sourceRecordId: item.sourceRecordId, field: item.domainField, value: item.domain } }];
  });
  const domains = unique(candidates.map((item) => item.domain));
  if (domains.length > 1) return { conflict: `Conflicting attributable domains require review: ${domains.join(", ")}.` };
  const selected = candidates.find((item) => item.domain === domains[0]);
  return selected ? { domain: selected.domain, source: selected.source } : {};
}

export function resolveOrganizationTargets(evidence: OrganizationEvidence[]): OrganizationTargetResolution[] {
  const groups = new Map<string, OrganizationEvidence[]>();
  for (const item of evidence) {
    const value = item.value.trim();
    const key = normalizeOrganizationName(value);
    if (!key || PLACEHOLDER_TARGETS.test(value) || !item.sourceName || !item.sourceUrl) continue;
    groups.set(key, [...(groups.get(key) ?? []), { ...item, value }]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const isPublicAgency = isPublicAgencyEvidence(items);
      const classification = targetTypeFor(items, isPublicAgency);
      const domains = domainResolution(items);
      const targetType = classification.type;
      const uncertain = targetType === "research_only" || Boolean(classification.conflict) || Boolean(domains.conflict);
      const evidenceCount = new Set(items.map((item) => `${item.sourceName}|${item.sourceUrl}|${item.field}|${item.role}`)).size;
      const score = uncertain ? 35 : Math.min(95, 62 + Math.min(18, (evidenceCount - 1) * 8) + (domains.domain ? 10 : 0));
      const sourceText = items.map((item) => `${item.field} ${item.value}`).join(" ").toLowerCase();
      const contactRoute = uncertain
        ? "manual_research"
        : isPublicAgency
        ? /grant|program|fund/.test(sourceText)
          ? "program_office"
          : /vendor|registration/.test(sourceText)
          ? "vendor_registration"
          : "procurement_office"
        : "commercial_role_enrichment";
      const manualResearchReason = classification.conflict || domains.conflict || (targetType === "research_only"
        ? "The source identifies an organization but does not establish a supported buyer, recipient, partner, provider, distributor, prime, grantee, or agency role."
        : undefined);

      return {
        resolutionVersion: "organization-target-v1",
        normalizedOrganizationKey: key,
        displayName: chooseDisplayName(items),
        aliases: [...new Set(items.map((item) => item.value))].sort((a, b) => a.localeCompare(b)),
        targetType,
        isPublicAgency,
        confidence: {
          level: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
          score,
          rationale: uncertain
            ? manualResearchReason || "The organization needs manual verification."
            : `${evidenceCount} attributable source reference${evidenceCount === 1 ? "" : "s"} support the ${targetType.replaceAll("_", " ")} classification.`
        },
        evidence: items,
        verifiedDomain: domains.domain,
        verifiedDomainEvidence: domains.source,
        contactRoute,
        manualResearchRequired: uncertain,
        manualResearchReason
      };
    });
}

function rawDomainEvidence(raw: Record<string, unknown>): { domain?: string; field?: string } {
  const nested = typeof raw.raw_json === "object" && raw.raw_json ? raw.raw_json as Record<string, unknown> : {};
  for (const record of [raw, nested]) {
    for (const field of DOMAIN_FIELDS) {
      const value = text(record[field]);
      if (value) return { domain: value, field };
    }
  }
  return {};
}

function inferredPrimaryRole(signal: OpportunitySignalLike, organization: string): OrganizationEvidenceRole {
  if (organization === signal.agency_or_funder || signal.revenue_pathway === "sell_to_agency" || signal.revenue_pathway === "procurement_bid") return "agency";
  if (signal.source_type === "historical_award") {
    const context = `${signal.external_evidence_summary ?? ""} ${signal.raw_json?.["Award Type"] ?? ""}`.toLowerCase();
    if (/distributor|distribution|prime contract|prime award/.test(context)) return "prime_awardee";
    if (/provider|clinical service|health care service/.test(context)) return "provider";
    return "recipient";
  }
  if (signal.source_type === "funded_buyer") return "buyer";
  if (signal.source_type === "active_grant" && signal.revenue_pathway === "partner_with_recipient") return "eligible_applicant";
  return "unknown";
}

export function resolvePrimaryTargetForSignal(signal: OpportunitySignalLike): OrganizationTargetResolution | null {
  const organization = text(signal.likely_buyer_or_partner) || text(signal.agency_or_funder);
  if (!organization || PLACEHOLDER_TARGETS.test(organization)) return null;
  const raw = signal.raw_json ?? {};
  const domain = rawDomainEvidence(raw);
  const sourceRecordId = text(raw["Award ID"]) || text(raw.noticeId) || text(raw.id);
  return resolveOrganizationTargets([{
    sourceName: signal.source_name,
    sourceUrl: signal.source_url,
    sourceRecordId: sourceRecordId || undefined,
    field: organization === signal.agency_or_funder ? "agency_or_funder" : "likely_buyer_or_partner",
    value: organization,
    role: inferredPrimaryRole(signal, organization),
    domain: domain.domain,
    domainField: domain.field
  }])[0] ?? null;
}

export function enrichmentEligibilityForTarget(
  target: OrganizationTargetResolution | null,
  targetRoles: string[]
): EnrichmentEligibility {
  const roles = unique(targetRoles.map((role) => role.trim()));
  if (!target) return { clayEligible: false, snovEligible: false, reason: "No source-supported organization target is resolved.", targetRoles: roles };
  if (target.manualResearchRequired || target.targetType === "research_only") {
    return { clayEligible: false, snovEligible: false, reason: target.manualResearchReason || "The target requires manual research.", verifiedDomain: target.verifiedDomain, targetRoles: roles };
  }
  if (target.isPublicAgency || target.targetType === "agency") {
    return { clayEligible: false, snovEligible: false, reason: `Public agencies route to the ${target.contactRoute.replaceAll("_", " ")}, not personal-email enrichment.`, verifiedDomain: target.verifiedDomain, targetRoles: roles };
  }
  if (!target.verifiedDomain) {
    return { clayEligible: false, snovEligible: false, reason: "No attributable official/source domain is available for this commercial target.", targetRoles: roles };
  }
  if (roles.length === 0) {
    return { clayEligible: false, snovEligible: false, reason: "Target roles must be defined before contact enrichment.", verifiedDomain: target.verifiedDomain, targetRoles: roles };
  }
  return { clayEligible: true, snovEligible: true, reason: "A non-agency target, attributable domain, and target roles are verified.", verifiedDomain: target.verifiedDomain, targetRoles: roles };
}
