import type { ScrapedPage } from "./types.ts";
import {
  fetchSafeOutboundUrl,
  HTTP_OUTBOUND_PROTOCOLS,
  sameOriginUrl,
  type SafeOutboundUrlOptions
} from "./url.ts";

const MAX_PAGES = 8;
const MAX_CHARS = 40000;
const PAGE_TIMEOUT_MS = 10000;
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

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(match?.[1] ?? "");
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

async function fetchPage(url: string, outboundOptions: ScraperOutboundOptions): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
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
        ...outboundOptions,
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
  }
}

export async function scrapeCompanyWebsite(
  startUrl: string,
  outboundOptions: ScraperOutboundOptions = {}
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
    const url = queue.shift();
    if (!url || visited.has(url)) {
      continue;
    }
    visited.add(url);

    try {
      const html = await fetchPage(url, outboundOptions);
      if (!html) {
        continue;
      }

      const text = stripTags(html).slice(0, 10000);
      if (text.length < 120) {
        continue;
      }

      pages.push({
        url,
        title: extractTitle(html),
        text
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
      continue;
    }
  }

  return { pages, rawText: rawText.trim() };
}
