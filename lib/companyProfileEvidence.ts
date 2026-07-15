import type {
  CompanyOrganizationMetadata,
  CompanyProfile,
  CompanyProfileEvidence,
  CompanyProfileUrl,
  ScrapedPage
} from "./types";
import type { CompanyEnrichmentResult } from "./companyEnrichment";

const MAX_EVIDENCE = 20;
const MAX_SUMMARY_CHARS = 700;
const MAX_CONTEXT_CHARS = 6_000;

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

function canonicalDomain(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? "";
  }
}

function organizationSummary(organization: CompanyOrganizationMetadata): string {
  const address = organization.address
    ? unique([
        organization.address.locality,
        organization.address.region,
        organization.address.country
      ]).join(", ")
    : "";
  return unique([
    organization.legal_name ? `Legal name: ${organization.legal_name}` : undefined,
    organization.name ? `Name: ${organization.name}` : undefined,
    organization.description ? `Description: ${organization.description}` : undefined,
    organization.industry?.length ? `Industry: ${organization.industry.join(", ")}` : undefined,
    organization.founding_date ? `Founded: ${organization.founding_date}` : undefined,
    address ? `Location: ${address}` : undefined
  ]).join(". ").slice(0, MAX_SUMMARY_CHARS);
}

export function buildWebsiteProfileEvidence(
  pages: readonly ScrapedPage[],
  retrievedAt = new Date().toISOString()
): CompanyProfileEvidence[] {
  const evidence: CompanyProfileEvidence[] = [];
  const seen = new Set<string>();

  const add = (item: CompanyProfileEvidence) => {
    const key = `${item.source_url}|${item.summary}`;
    if (!item.summary || seen.has(key) || evidence.length >= MAX_EVIDENCE) return;
    seen.add(key);
    evidence.push(item);
  };

  for (const page of pages) {
    const metadata = page.metadata;
    if (!metadata) continue;

    if (metadata.meta_description) {
      add({
        source_type: "website_structured_data",
        source_name: "Company website meta description",
        source_url: metadata.source_url,
        retrieved_at: retrievedAt,
        fields: ["summary"],
        summary: metadata.meta_description.slice(0, MAX_SUMMARY_CHARS),
        confidence: 0.8
      });
    }

    for (const organization of metadata.organizations ?? []) {
      const fields = unique([
        organization.name ? "company_name" : undefined,
        organization.legal_name ? "legal_name" : undefined,
        organization.description ? "summary" : undefined,
        organization.industry?.length ? "industries" : undefined,
        organization.founding_date ? "founding_date" : undefined,
        organization.address ? "geographies" : undefined,
        organization.same_as?.length ? "company_profile_urls" : undefined
      ]);
      add({
        source_type: "website_structured_data",
        source_name: `Company website ${organization.schema_type} data`,
        source_url: metadata.source_url,
        retrieved_at: retrievedAt,
        fields,
        summary: organizationSummary(organization),
        confidence: 0.9
      });
    }
  }

  return evidence;
}

export function appendWebsiteEvidenceContext(
  rawText: string,
  evidence: readonly CompanyProfileEvidence[]
): string {
  if (evidence.length === 0) return rawText;
  const context = evidence
    .map((item) => `SOURCE: ${item.source_url}\nSTRUCTURED COMPANY EVIDENCE: ${item.summary}`)
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);
  return `${rawText}\n\nVERIFIED FIRST-PARTY COMPANY METADATA\n${context}`;
}

function allOrganizations(pages: readonly ScrapedPage[]): CompanyOrganizationMetadata[] {
  return pages.flatMap((page) => page.metadata?.organizations ?? []);
}

function allProfileUrls(pages: readonly ScrapedPage[]): CompanyProfileUrl[] {
  const urls = new Map<string, CompanyProfileUrl>();
  for (const page of pages) {
    for (const profile of page.metadata?.company_profile_urls ?? []) {
      if (!urls.has(profile.url)) urls.set(profile.url, profile);
    }
  }
  return Array.from(urls.values()).slice(0, 20);
}

export function attachWebsiteEvidenceToProfile(
  profile: CompanyProfile,
  pages: readonly ScrapedPage[],
  companyUrl: string,
  evidence: readonly CompanyProfileEvidence[],
  generatedAt = new Date().toISOString()
): CompanyProfile {
  const organizations = allOrganizations(pages);
  const legalName = organizations.find((item) => item.legal_name)?.legal_name;
  const foundingDate = organizations.find((item) => item.founding_date)?.founding_date;
  const industries = unique([
    ...(profile.industries ?? []),
    ...organizations.flatMap((item) => item.industry ?? [])
  ]).slice(0, 20);
  const geographies = unique([
    ...(profile.geographies ?? []),
    ...organizations.flatMap((item) => [
      item.address?.locality,
      item.address?.region,
      item.address?.country
    ])
  ]).slice(0, 20);
  const profileUrls = allProfileUrls(pages);
  const domain = canonicalDomain(companyUrl);

  return {
    ...profile,
    profile_schema_version: 2,
    canonical_domain: domain,
    legal_name: profile.legal_name || legalName,
    founding_date: profile.founding_date || foundingDate,
    industries,
    geographies,
    company_profile_urls: profileUrls,
    company_evidence: evidence.slice(0, MAX_EVIDENCE),
    company_enrichment: {
      status: evidence.length > 0 ? "completed" : "partial",
      canonical_domain: domain,
      sources_attempted: ["company_website"],
      sources_used: evidence.length > 0 ? ["company_website"] : [],
      generated_at: generatedAt,
      warnings: evidence.length > 0 ? [] : ["No structured organization metadata was published by the website."]
    }
  };
}

export function appendExternalCompanyEvidenceContext(
  rawText: string,
  result: CompanyEnrichmentResult
): string {
  if (!result.context) return rawText;
  return `${rawText}\n\nOFFICIAL OR LICENSED COMPANY EVIDENCE\n${result.context.slice(0, MAX_CONTEXT_CHARS)}`;
}

export function attachExternalCompanyEvidenceToProfile(
  profile: CompanyProfile,
  result: CompanyEnrichmentResult
): CompanyProfile {
  const externalEvidence: CompanyProfileEvidence[] = result.evidence
    .filter((item) => item.provider !== "first_party")
    .slice(0, MAX_EVIDENCE)
    .map((item) => ({
      source_type: item.provider === "people_data_labs" ? "licensed_provider" : "official_registry",
      source_name: item.sourceName,
      source_url: item.sourceUrl,
      retrieved_at: item.retrievedAt,
      fields: [item.field],
      summary: `${item.field.replace(/_/g, " ")}: ${item.value}`.slice(0, MAX_SUMMARY_CHARS),
      confidence: item.confidence === "strict_match" ? 0.95 : 0.8
    }));
  const legalName = result.evidence.find((item) => item.field === "legal_name")?.value;
  const foundingDate = result.evidence.find((item) => item.field === "founded")?.value;
  const runsAttempted = result.providerRuns.filter((run) => run.attempted);
  const used = result.providerRuns.filter((run) => run.status === "matched");
  const warnings = result.providerRuns
    .filter((run) => run.status === "timeout" || run.status === "error")
    .map((run) => `${run.sourceName}: ${run.errorMessage || run.status}`)
    .slice(0, 6);

  return {
    ...profile,
    legal_name: profile.legal_name || legalName,
    founding_date: profile.founding_date || foundingDate,
    company_evidence: [...(profile.company_evidence ?? []), ...externalEvidence].slice(0, MAX_EVIDENCE),
    company_enrichment: {
      status: warnings.length > 0 ? "partial" : "completed",
      canonical_domain: profile.canonical_domain ?? "",
      sources_attempted: unique([
        ...(profile.company_enrichment?.sources_attempted ?? []),
        ...runsAttempted.map((run) => run.provider)
      ]),
      sources_used: unique([
        ...(profile.company_enrichment?.sources_used ?? []),
        ...used.map((run) => run.provider)
      ]),
      generated_at:
        result.providerRuns.at(-1)?.completedAt ??
        profile.company_enrichment?.generated_at ??
        new Date().toISOString(),
      warnings: unique([...(profile.company_enrichment?.warnings ?? []), ...warnings])
    }
  };
}
