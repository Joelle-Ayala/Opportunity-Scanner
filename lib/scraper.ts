import type {
  CompanyOrganizationMetadata,
  CompanyProfilePlatform,
  CompanyProfileUrl,
  CompanyWebsiteAddress,
  CompanyWebsiteMetadata,
  ScrapedPage
} from "./types.ts";
import {
  fetchSafeOutboundUrl,
  HTTP_OUTBOUND_PROTOCOLS,
  sameOriginUrl,
  type SafeOutboundUrlOptions
} from "./url.ts";

const MAX_PAGES = 8;
const MAX_CHARS = 40000;
const PAGE_TIMEOUT_MS = 10000;
const MAX_META_DESCRIPTION_CHARS = 500;
const MAX_ORGANIZATIONS_PER_PAGE = 6;
const MAX_PROFILE_URLS_PER_PAGE = 12;
const MAX_INDUSTRIES_PER_ORGANIZATION = 8;
const MAX_JSON_LD_NODES = 100;
const MAX_JSON_LD_DEPTH = 8;
const MAX_NAME_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 1000;
const MAX_SHORT_VALUE_CHARS = 240;
const MAX_PROFILE_URL_CHARS = 500;
const preferredPathHints = [
  "about",
  "product",
  "products",
  "service",
  "services",
  "solution",
  "solutions",
  "industries",
  "customers",
  "case-studies"
];
const likelyPaths = [
  "/about",
  "/about-us",
  "/products",
  "/product",
  "/services",
  "/solutions",
  "/industries",
  "/customers"
];

const ORGANIZATION_SCHEMA_TYPES = new Set(["Organization", "Corporation", "LocalBusiness"]);

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };

  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#")) {
      const hexadecimal = token[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
      return entity;
    }
    return namedEntities[token.toLowerCase()] ?? entity;
  });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] ?? "");
}

function extractAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (name && name !== "a" && name !== "meta" && name !== "script") {
      attributes[name] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
  }
  return attributes;
}

function compactText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const compact = stripTags(value).replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, maxChars) : undefined;
}

function extractMetaDescription(html: string): string | undefined {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = extractAttributes(match[0]);
    if (attributes.name?.toLowerCase() === "description") {
      return compactText(attributes.content, MAX_META_DESCRIPTION_CHARS);
    }
  }
  return undefined;
}

function normalizedProfileUrl(
  value: unknown,
  base: URL,
  allowGithubRoot = false
): CompanyProfileUrl | null {
  if (typeof value !== "string" || value.length > 2000) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(decodeHtmlEntities(value), base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || url.origin === base.origin || url.username || url.password) {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0]?.toLowerCase();
  let platform: CompanyProfilePlatform | null = null;

  if (hostname === "linkedin.com" && first === "company" && parts.length === 2) {
    platform = "linkedin_company";
  } else if (hostname === "crunchbase.com" && first === "organization" && parts.length === 2) {
    platform = "crunchbase_organization";
  } else if (
    hostname === "github.com" &&
    ((first === "orgs" && parts.length === 2) || (allowGithubRoot && parts.length === 1))
  ) {
    platform = "github_organization";
  } else if (
    hostname === "facebook.com" &&
    parts.length > 0 &&
    !["people", "profile.php", "groups", "events", "sharer", "share"].includes(first ?? "")
  ) {
    platform = "facebook";
  } else if (
    hostname === "instagram.com" &&
    parts.length === 1 &&
    !["accounts", "explore", "p", "reel", "stories"].includes(first ?? "")
  ) {
    platform = "instagram";
  } else if (
    (hostname === "x.com" || hostname === "twitter.com") &&
    parts.length === 1 &&
    !["home", "i", "intent", "search", "share"].includes(first ?? "")
  ) {
    platform = "x";
  } else if (
    (hostname === "youtube.com" || hostname === "youtu.be") &&
    ((first === "channel" && parts.length === 2) ||
      ((first === "c" || first === "user") && parts.length === 2) ||
      (parts.length === 1 && first?.startsWith("@")))
  ) {
    platform = "youtube";
  }

  if (!platform) {
    return null;
  }

  url.protocol = "https:";
  url.hostname = hostname;
  url.port = "";
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  const normalized = url.toString();
  return normalized.length <= MAX_PROFILE_URL_CHARS ? { platform, url: normalized } : null;
}

function uniqueProfileUrls(
  values: unknown[],
  base: URL,
  allowGithubRoot = false
): CompanyProfileUrl[] {
  const profiles = new Map<string, CompanyProfileUrl>();
  for (const value of values) {
    const profile = normalizedProfileUrl(value, base, allowGithubRoot);
    if (profile && !profiles.has(profile.url)) {
      profiles.set(profile.url, profile);
    }
    if (profiles.size >= MAX_PROFILE_URLS_PER_PAGE) {
      break;
    }
  }
  return Array.from(profiles.values());
}

function extractLinkedCompanyProfiles(html: string, base: URL): CompanyProfileUrl[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const href = extractAttributes(match[0]).href;
    if (href) {
      hrefs.push(href);
    }
  }
  return uniqueProfileUrls(hrefs, base);
}

function schemaType(value: unknown): CompanyOrganizationMetadata["schema_type"] | null {
  const values = Array.isArray(value) ? value : [value];
  for (const candidate of values) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalized = candidate.split(/[\/#]/).filter(Boolean).at(-1);
    if (normalized && ORGANIZATION_SCHEMA_TYPES.has(normalized)) {
      return normalized as CompanyOrganizationMetadata["schema_type"];
    }
  }
  return null;
}

function stringValues(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (candidate): candidate is string => typeof candidate === "string"
  );
}

function addressText(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    return compactText((value as Record<string, unknown>).name, MAX_SHORT_VALUE_CHARS);
  }
  return compactText(value, MAX_SHORT_VALUE_CHARS);
}

function extractAddress(value: unknown): CompanyWebsiteAddress | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "string") {
    const streetAddress = compactText(candidate, MAX_SHORT_VALUE_CHARS);
    return streetAddress ? { street_address: streetAddress } : undefined;
  }
  if (typeof candidate !== "object" || candidate === null) {
    return undefined;
  }

  const record = candidate as Record<string, unknown>;
  const address: CompanyWebsiteAddress = {
    street_address: compactText(record.streetAddress, MAX_SHORT_VALUE_CHARS),
    locality: compactText(record.addressLocality, MAX_SHORT_VALUE_CHARS),
    region: compactText(record.addressRegion, MAX_SHORT_VALUE_CHARS),
    postal_code: compactText(record.postalCode, MAX_SHORT_VALUE_CHARS),
    country: addressText(record.addressCountry)
  };
  return Object.values(address).some(Boolean) ? address : undefined;
}

function organizationMetadata(
  value: Record<string, unknown>,
  base: URL
): CompanyOrganizationMetadata | null {
  const type = schemaType(value["@type"]);
  if (!type) {
    return null;
  }

  const industries = stringValues(value.industry)
    .map((industry) => compactText(industry, MAX_SHORT_VALUE_CHARS))
    .filter((industry): industry is string => Boolean(industry))
    .slice(0, MAX_INDUSTRIES_PER_ORGANIZATION);
  const sameAs = uniqueProfileUrls(stringValues(value.sameAs), base, true);
  const organization: CompanyOrganizationMetadata = {
    schema_type: type,
    name: compactText(value.name, MAX_NAME_CHARS),
    description: compactText(value.description, MAX_DESCRIPTION_CHARS),
    legal_name: compactText(value.legalName, MAX_SHORT_VALUE_CHARS),
    founding_date: compactText(value.foundingDate, MAX_SHORT_VALUE_CHARS),
    industry: industries.length > 0 ? industries : undefined,
    address: extractAddress(value.address),
    same_as: sameAs.length > 0 ? sameAs : undefined
  };
  return organization;
}

function extractOrganizations(html: string, base: URL): CompanyOrganizationMetadata[] {
  const organizations: CompanyOrganizationMetadata[] = [];
  let visitedNodes = 0;

  const visit = (value: unknown, depth: number): void => {
    if (
      depth > MAX_JSON_LD_DEPTH ||
      visitedNodes >= MAX_JSON_LD_NODES ||
      organizations.length >= MAX_ORGANIZATIONS_PER_PAGE
    ) {
      return;
    }
    visitedNodes += 1;

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
      }
      return;
    }
    if (typeof value !== "object" || value === null) {
      return;
    }

    const record = value as Record<string, unknown>;
    const organization = organizationMetadata(record, base);
    if (organization) {
      organizations.push(organization);
    }
    for (const nested of Object.values(record)) {
      if (typeof nested === "object" && nested !== null) {
        visit(nested, depth + 1);
      }
    }
  };

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (organizations.length >= MAX_ORGANIZATIONS_PER_PAGE || visitedNodes >= MAX_JSON_LD_NODES) {
      break;
    }
    const attributes = extractAttributes(`<script ${match[1] ?? ""}>`);
    if (attributes.type?.split(";", 1)[0]?.trim().toLowerCase() !== "application/ld+json") {
      continue;
    }
    try {
      visit(JSON.parse(match[2] ?? ""), 0);
    } catch {
      continue;
    }
  }
  return organizations;
}

export function extractCompanyWebsiteMetadata(
  html: string,
  pageUrl: string
): CompanyWebsiteMetadata | undefined {
  const base = new URL(pageUrl);
  const metaDescription = extractMetaDescription(html);
  const organizations = extractOrganizations(html, base);
  const linkedProfiles = extractLinkedCompanyProfiles(html, base);
  const allProfiles = uniqueProfileUrls(
    [
      ...linkedProfiles.map((profile) => profile.url),
      ...organizations.flatMap((organization) =>
        (organization.same_as ?? []).map((profile) => profile.url)
      )
    ],
    base,
    true
  );

  if (!metaDescription && organizations.length === 0 && allProfiles.length === 0) {
    return undefined;
  }
  return {
    source_url: pageUrl,
    meta_description: metaDescription,
    organizations: organizations.length > 0 ? organizations : undefined,
    company_profile_urls: allProfiles.length > 0 ? allProfiles : undefined
  };
}

function extractLinks(html: string, base: URL): string[] {
  const links = Array.from(html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => sameOriginUrl(base, match[1]))
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(links))
    .filter((url) => !/\.(pdf|jpg|jpeg|png|gif|webp|zip|docx?|xlsx?)($|\?)/i.test(url))
    .sort((a, b) => scoreLink(b) - scoreLink(a));
}

function scoreLink(url: string): number {
  const lower = url.toLowerCase();
  return preferredPathHints.reduce((score, hint) => score + (lower.includes(hint) ? 1 : 0), 0);
}

export type ScraperOutboundOptions = Pick<
  SafeOutboundUrlOptions,
  "fetchImpl" | "lookup" | "maxRedirects"
>;

export type ScraperExecutionOptions = ScraperOutboundOptions & {
  signal?: AbortSignal;
  deadlineAtMs?: number;
  pageTimeoutMs?: number;
};

function remainingTimeMs(deadlineAtMs: number | undefined): number {
  return deadlineAtMs === undefined ? Number.POSITIVE_INFINITY : Math.max(0, deadlineAtMs - Date.now());
}

async function fetchPage(url: string, options: ScraperExecutionOptions): Promise<string> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (options.signal?.aborted) {
    controller.abort();
  } else {
    options.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeoutMs = Math.max(
    1,
    Math.min(PAGE_TIMEOUT_MS, options.pageTimeoutMs ?? PAGE_TIMEOUT_MS, remainingTimeMs(options.deadlineAtMs))
  );
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchSafeOutboundUrl(
      url,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "OpportunityScanner/0.1 (+https://example.com)"
        }
      },
      {
        fetchImpl: options.fetchImpl,
        lookup: options.lookup,
        maxRedirects: options.maxRedirects,
        allowedProtocols: HTTP_OUTBOUND_PROTOCOLS
      }
    );

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) {
      return "";
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

export async function scrapeCompanyWebsite(
  startUrl: string,
  options: ScraperExecutionOptions = {}
): Promise<{
  pages: ScrapedPage[];
  rawText: string;
}> {
  const base = new URL(startUrl);
  const queue = [
    base.toString(),
    ...likelyPaths.map((pathname) => new URL(pathname, base.origin).toString())
  ];
  const visited = new Set<string>();
  const pages: ScrapedPage[] = [];
  let rawText = "";

  while (queue.length > 0 && pages.length < MAX_PAGES && rawText.length < MAX_CHARS) {
    if (options.signal?.aborted || remainingTimeMs(options.deadlineAtMs) <= 0) {
      break;
    }

    const url = queue.shift();
    if (!url || visited.has(url)) {
      continue;
    }
    visited.add(url);

    try {
      const html = await fetchPage(url, options);
      if (!html) {
        continue;
      }

      const text = stripTags(html).slice(0, 10000);
      if (text.length < 120) {
        continue;
      }

      const metadata = extractCompanyWebsiteMetadata(html, url);
      pages.push({
        url,
        title: extractTitle(html),
        text,
        ...(metadata ? { metadata } : {})
      });
      rawText = `${rawText}\n\nURL: ${url}\nTITLE: ${extractTitle(html)}\n${text}`.slice(
        0,
        MAX_CHARS
      );

      for (const link of extractLinks(html, base)) {
        if (!visited.has(link) && queue.length < MAX_PAGES * 3) {
          queue.push(link);
        }
      }
    } catch {
      if (options.signal?.aborted || remainingTimeMs(options.deadlineAtMs) <= 0) {
        break;
      }
      continue;
    }
  }

  return { pages, rawText: rawText.trim() };
}
