import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const contentPath = path.join(process.cwd(), "lib", "marketingContent.ts");
const source = fs.readFileSync(contentPath, "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);

  if (start < 0 || end < 0) {
    throw new Error(`Could not locate content between ${startMarker} and ${endMarker}.`);
  }

  return source.slice(start, end);
}

function readPageRecords(startMarker, endMarker) {
  const section = sourceBetween(startMarker, endMarker);
  const records = [];
  const recordPattern = /\n  \{\n    slug: "([^"]+)",([\s\S]*?)(?=\n  \{\n    slug: "|\n\];)/g;

  for (const match of section.matchAll(recordPattern)) {
    const relatedMatch = match[2].match(/relatedResourceSlugs:\s*\[([\s\S]*?)\]/);
    records.push({
      slug: match[1],
      relatedSlugs: relatedMatch ? [...relatedMatch[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]) : null
    });
  }

  if (!records.length) {
    throw new Error(`No page records found after ${startMarker}.`);
  }

  return records;
}

function readPublishedSlugs() {
  const section = sourceBetween("const baseResourceArticles", "const resourceFeaturedImages");
  return new Set([...section.matchAll(/^    slug: "([^"]+)",/gm)].map((match) => match[1]));
}

const publishedSlugs = readPublishedSlugs();
const pageGroups = [
  ["solution", readPageRecords("export const solutionPages", "export const industryPages")],
  ["industry", readPageRecords("export const industryPages", "const baseResourceArticles")]
];
const errors = [];
let pageCount = 0;
let relatedLinkCount = 0;

for (const [pageType, records] of pageGroups) {
  for (const { slug: pageSlug, relatedSlugs } of records) {
    pageCount += 1;

    if (!relatedSlugs || relatedSlugs.length < 3) {
      errors.push(`${pageType} ${pageSlug} must define at least 3 related resource slugs.`);
      continue;
    }

    if (relatedSlugs.length !== 3) {
      errors.push(`${pageType} ${pageSlug} must render exactly 3 related resources.`);
    }

    if (new Set(relatedSlugs).size !== relatedSlugs.length) {
      errors.push(`${pageType} ${pageSlug} contains duplicate related resource slugs.`);
    }

    for (const relatedSlug of relatedSlugs) {
      relatedLinkCount += 1;
      if (!publishedSlugs.has(relatedSlug)) {
        errors.push(`${pageType} ${pageSlug} links to unpublished resource: ${relatedSlug}`);
      }
    }
  }
}

if (errors.length) {
  console.error("Related resource validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Related resource validation passed: ${pageCount} pages, ${relatedLinkCount} valid links, ${publishedSlugs.size} published resources.`
);
