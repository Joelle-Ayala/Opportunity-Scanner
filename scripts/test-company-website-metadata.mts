import assert from "node:assert/strict";
import {
  extractCompanyWebsiteMetadata,
  scrapeCompanyWebsite
} from "../lib/scraper.ts";
import type { OutboundDnsLookup } from "../lib/url.ts";

const PAGE_URL = "https://company.public.test/";
const PUBLIC_IPV4 = "93.184.216.34";

const organizationGraph = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Not an organization" },
    {
      "@type": ["Thing", "Organization"],
      name: "Acme Public Systems",
      description: "Public-sector tools &amp; services",
      legalName: "Acme Public Systems, Inc.",
      foundingDate: "2014-03-02",
      industry: ["GovTech", "Data services"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "12 Main Street",
        addressLocality: "Albany",
        addressRegion: "NY",
        postalCode: "12207",
        addressCountry: { "@type": "Country", name: "US" }
      },
      sameAs: [
        "https://www.linkedin.com/company/acme-public/?trk=website",
        "https://www.linkedin.com/in/acme-founder/",
        "https://www.crunchbase.com/organization/acme-public",
        "https://github.com/acme-public",
        "https://unrecognized.example/acme"
      ]
    }
  ]
};

const extractionHtml = `
  <html>
    <head>
      <meta content="Evidence-led &amp; practical" name="description">
      <script type="application/ld+json">{"@type":"Organization",broken}</script>
      <script TYPE="application/ld+json; charset=utf-8">
        ${JSON.stringify([
          organizationGraph,
          { "@type": "Corporation", name: "Acme Holdings" },
          { "@type": "LocalBusiness", name: "Acme Albany" }
        ])}
      </script>
    </head>
    <body>
      <a href="https://linkedin.com/in/acme-founder">Founder</a>
      <a href="https://github.com/acme-founder">Personal GitHub</a>
      <a href="https://facebook.com/acmepublic">Facebook</a>
      <a href="https://instagram.com/acmepublic/">Instagram</a>
      <a href="https://x.com/acmepublic?ref=site">X</a>
      <a href="https://youtube.com/@acmepublic">YouTube</a>
    </body>
  </html>
`;

const metadata = extractCompanyWebsiteMetadata(extractionHtml, PAGE_URL);
assert.ok(metadata);
assert.equal(metadata.source_url, PAGE_URL);
assert.equal(metadata.meta_description, "Evidence-led & practical");
assert.equal(metadata.organizations?.length, 3, "malformed JSON-LD must not block valid blocks");

const organization = metadata.organizations?.[0];
assert.deepEqual(organization, {
  schema_type: "Organization",
  name: "Acme Public Systems",
  description: "Public-sector tools & services",
  legal_name: "Acme Public Systems, Inc.",
  founding_date: "2014-03-02",
  industry: ["GovTech", "Data services"],
  address: {
    street_address: "12 Main Street",
    locality: "Albany",
    region: "NY",
    postal_code: "12207",
    country: "US"
  },
  same_as: [
    {
      platform: "linkedin_company",
      url: "https://linkedin.com/company/acme-public"
    },
    {
      platform: "crunchbase_organization",
      url: "https://crunchbase.com/organization/acme-public"
    },
    {
      platform: "github_organization",
      url: "https://github.com/acme-public"
    }
  ]
});

const profileUrls = metadata.company_profile_urls ?? [];
assert.deepEqual(
  profileUrls.map((profile) => profile.platform),
  [
    "facebook",
    "instagram",
    "x",
    "youtube",
    "linkedin_company",
    "crunchbase_organization",
    "github_organization"
  ]
);
assert.equal(
  profileUrls.some((profile) => profile.url.includes("/in/") || profile.url.includes("acme-founder")),
  false,
  "personal profiles must be excluded"
);

const cappedOrganizations = Array.from({ length: 10 }, (_, index) => ({
  "@type": "Organization",
  name: `${index}-${"n".repeat(240)}`,
  description: "d".repeat(1200),
  legalName: "l".repeat(300),
  foundingDate: "f".repeat(300),
  industry: Array.from({ length: 12 }, (__, industryIndex) => `Industry ${industryIndex}`)
}));
const cappedProfiles = Array.from(
  { length: 16 },
  (_, index) => `<a href="https://linkedin.com/company/acme-${index}">Profile</a>`
).join("");
const capped = extractCompanyWebsiteMetadata(
  `<meta name="description" content="${"m".repeat(700)}">
   <script type="application/ld+json">${JSON.stringify(cappedOrganizations)}</script>
   ${cappedProfiles}`,
  PAGE_URL
);
assert.ok(capped);
assert.equal(capped.meta_description?.length, 500);
assert.equal(capped.organizations?.length, 6);
assert.equal(capped.organizations?.[0]?.name?.length, 200);
assert.equal(capped.organizations?.[0]?.description?.length, 1000);
assert.equal(capped.organizations?.[0]?.legal_name?.length, 240);
assert.equal(capped.organizations?.[0]?.founding_date?.length, 240);
assert.equal(capped.organizations?.[0]?.industry?.length, 8);
assert.equal(capped.company_profile_urls?.length, 12);

const fetchCalls: string[] = [];
const lookup: OutboundDnsLookup = async (hostname) => {
  assert.equal(hostname, "company.public.test", "crawl DNS must remain on the company origin");
  return [{ address: PUBLIC_IPV4 }];
};
const crawlHtml = `
  <html>
    <head><title>Acme Public Systems</title></head>
    <body>
      ${"Company products, services, customers, and public-sector capabilities. ".repeat(4)}
      <a href="/about">About</a>
      <a href="https://linkedin.com/company/acme-public">LinkedIn</a>
      <a href="https://linkedin.com/in/acme-founder">Founder</a>
    </body>
  </html>
`;
const scraped = await scrapeCompanyWebsite(PAGE_URL, {
  lookup,
  fetchImpl: async (input, init) => {
    const url = new URL(String(input));
    fetchCalls.push(url.toString());
    assert.equal(init?.redirect, "manual");
    return url.pathname === "/"
      ? new Response(crawlHtml, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        })
      : new Response("", {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
  }
});

assert.equal(scraped.pages.length, 1);
assert.deepEqual(scraped.pages[0]?.metadata?.company_profile_urls, [
  { platform: "linkedin_company", url: "https://linkedin.com/company/acme-public" }
]);
assert.ok(fetchCalls.length > 1, "the existing same-origin crawl should continue");
assert.equal(
  fetchCalls.every((url) => new URL(url).origin === "https://company.public.test"),
  true,
  "external metadata URLs must never be fetched"
);

let expiredDeadlineFetches = 0;
const expired = await scrapeCompanyWebsite(PAGE_URL, {
  deadlineAtMs: Date.now() - 1,
  lookup,
  fetchImpl: async () => {
    expiredDeadlineFetches += 1;
    return new Response(crawlHtml, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});
assert.deepEqual(expired, { pages: [], rawText: "" });
assert.equal(expiredDeadlineFetches, 0, "an expired crawl deadline must prevent all fetches");

console.log(
  "PASS company website metadata: JSON-LD, provenance, caps, profile safety, and same-origin crawl"
);
