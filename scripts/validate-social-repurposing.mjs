import { access, readFile } from "node:fs/promises";

const core = [
  "government-spending-growth-channel",
  "can-my-business-sell-to-government",
  "public-sector-opportunity-signal",
  "grants-contracts-funded-buyers",
  "find-funded-buyers-before-cold-outreach",
  "sam-gov-is-not-enough",
  "government-buyer-contact-paths",
  "public-sector-sales-pipeline-without-govcon-team",
  "public-sector-deal-flow-for-commercial-companies",
  "what-a-public-sector-opportunity-report-should-include"
].map((slug) => `docs/social-repurposing/articles/core-workflows/${slug}.md`);

const industries = [
  "infrastructure-opportunities-for-construction-companies",
  "clean-energy-public-sector-opportunities",
  "manufacturing-supply-chain-public-sector-demand",
  "nonprofit-community-services-funding-opportunities",
  "use-sample-opportunity-reports-in-outbound",
  "healthcare-public-sector-opportunities",
  "creative-economy-funding-opportunities",
  "education-workforce-opportunity-signals",
  "software-ai-public-sector-demand",
  "marketing-advertising-public-sector-opportunities",
  "government-communications-public-outreach-contracts",
  "website-content-digital-services-government-buyers",
  "industry-pages-paid-report-conversion"
].map((slug) => `docs/social-repurposing/articles/industries/${slug}.md`);

const flagshipPeople = [
  "public-sector-revenue-opportunity-playbook-2026",
  "healthcare-dme-public-sector-opportunity-report-2026",
  "education-workforce-public-sector-opportunity-report-2026",
  "creative-economy-live-events-public-sector-opportunity-report-2026",
  "software-ai-public-sector-opportunity-report-2026"
].map((slug) => `docs/social-repurposing/lead-magnets/flagship-people/${slug}.md`);

const commercial = [
  "infrastructure-construction-public-sector-opportunity-report-2026",
  "clean-energy-facilities-public-sector-opportunity-report-2026",
  "manufacturing-supply-chain-public-sector-opportunity-report-2026",
  "nonprofit-community-services-public-sector-opportunity-report-2026",
  "marketing-advertising-digital-services-public-sector-opportunity-report-2026"
].map((slug) => `docs/social-repurposing/lead-magnets/commercial/${slug}.md`);

const files = [...core, ...industries, ...flagshipPeople, ...commercial];
const allowPartial = process.argv.includes("--allow-partial");
const commonSections = [
  /audience/i,
  /thesis/i,
  /angle/i,
  /proof|caveat/i,
  /LinkedIn/i,
  /X\s*\/\s*Threads|X Thread|Threads Thread/i,
  /carousel/i,
  /video/i,
  /CTA/i
];

const errors = [];
let validated = 0;
for (const file of files) {
  try {
    await access(file);
    const content = await readFile(file, "utf8");
    validated += 1;
    if (content.length < 4_000) errors.push(`${file}: pack is unexpectedly short (${content.length} chars)`);
    for (const section of commonSections) {
      if (!section.test(content)) errors.push(`${file}: missing ${section}`);
    }
  } catch {
    if (!allowPartial) errors.push(`${file}: missing`);
  }
}

if (allowPartial && validated === 0) errors.push("No social repurposing packs were found.");

if (errors.length > 0) {
  console.error(`Social repurposing validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const scope = allowPartial ? `${validated} of ${files.length}` : `${files.length}`;
console.log(`Social repurposing validation passed for ${scope} source assets.`);
