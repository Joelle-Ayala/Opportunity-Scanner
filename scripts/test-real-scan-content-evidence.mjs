import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [jsonSource, componentSource, guidelinesSource, peopleIndustriesSource] = await Promise.all([
  source("content/real-scan-findings.json"),
  source("components/resources/real-scan-findings.tsx"),
  source("CONTENT_GUIDELINES.md"),
  source("lib/resourceArticleRefreshes/peopleIndustries.ts")
]);

const data = JSON.parse(jsonSource);
const expectedVerticals = [
  "creative-economy",
  "education-workforce",
  "healthcare-dme"
];

assert.equal(data._policy.classification, "evidence");
assert.deepEqual(Object.keys(data.verticals), expectedVerticals);
assert.equal(
  data.label,
  "From real scans — public records surfaced by Opportunity Scanner"
);
assert.equal(data.as_of, "2026-07-26");
assert.equal(data.as_of_display, "July 26, 2026");

assert.deepEqual(
  {
    company: data.verticals["creative-economy"].anonymized_company,
    signals: data.verticals["creative-economy"].aggregate.sourced_signals,
    agencies: data.verticals["creative-economy"].aggregate.distinct_federal_agencies,
    systems: data.verticals["creative-economy"].aggregate.source_system_count,
    amounts: data.verticals["creative-economy"].findings.map((finding) => finding.amount)
  },
  {
    company: "a musician-booking marketplace",
    signals: 28,
    agencies: 9,
    systems: 3,
    amounts: [24000000, 9267988, 1152925, 381588]
  }
);

assert.deepEqual(
  {
    company: data.verticals["education-workforce"].anonymized_company,
    signals: data.verticals["education-workforce"].aggregate.sourced_signals,
    agencies: data.verticals["education-workforce"].aggregate.distinct_federal_agencies,
    systems: data.verticals["education-workforce"].aggregate.source_system_count,
    amounts: data.verticals["education-workforce"].findings.map((finding) => finding.amount)
  },
  {
    company: "an arts-educator staffing platform born out of California Prop 28",
    signals: 21,
    agencies: 11,
    systems: 2,
    amounts: [9954119, 547714]
  }
);

assert.deepEqual(
  {
    company: data.verticals["healthcare-dme"].anonymized_company,
    signals: data.verticals["healthcare-dme"].aggregate.sourced_signals,
    agencies: data.verticals["healthcare-dme"].aggregate.distinct_federal_agencies,
    systems: data.verticals["healthcare-dme"].aggregate.source_system_count,
    amounts: data.verticals["healthcare-dme"].findings.map((finding) => finding.amount)
  },
  {
    company: "a compression-garment and recovery products brand",
    signals: 14,
    agencies: 5,
    systems: 2,
    amounts: [95922714, 17139378, 133587]
  }
);

assert.deepEqual(data.cross_site_aggregates, {
  opportunities_surfaced: 178,
  source_system_count: 3,
  source_systems: ["USAspending", "Grants.gov", "Federal Register"],
  distinct_agencies_per_scan: {
    minimum: 5,
    maximum: 11,
    display: "5-11 distinct agencies per scan"
  },
  award_evidence_range: {
    minimum: 23000,
    maximum: 95922714,
    display: "$23K to $95.9M"
  }
});

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }

  return keys;
}

const prohibitedDataKeys = ["deadline", "close_date", "urgency", "closing_soon"];
const dataKeys = collectKeys(data);
for (const key of prohibitedDataKeys) {
  assert.equal(dataKeys.includes(key), false, `Historical evidence must not define ${key}`);
}

for (const vertical of Object.values(data.verticals)) {
  for (const finding of vertical.findings) {
    assert.equal(
      Number.isInteger(finding.award_year),
      true,
      `${finding.recipient} must carry a verified award year`
    );
    assert.match(
      finding.source_url,
      /^https:\/\/www\.usaspending\.gov\/award\//,
      `${finding.recipient} must link to its public award record`
    );
  }
}

const articleEvidence = [
  {
    company: "a compression-garment and recovery products brand",
    aggregate: "14 sourced signals across five federal agencies and two source systems",
    findings: [
      ["Peraton Enterprise Solutions", "$95,922,714", "2018"],
      ["Valiant Construction LLC", "$17,139,378", "2021"],
      ["BSN Medical Inc.", "$133,587", "2019"]
    ],
    socialSeed: "In 2019, BSN Medical Inc. received a $133,587 medical-supply award from NASA."
  },
  {
    company: "a musician-booking marketplace",
    aggregate: "28 sourced signals across nine federal agencies and three source systems",
    findings: [
      ["John F. Kennedy Center for the Performing Arts", "$24,000,000", "2018"],
      ["Hargrove, LLC", "$9,267,988", "2022"],
      ["Isom Events LLC", "$1,152,925", "2018"],
      ["Chevo Studios Inc.", "$381,588", "2023"]
    ],
    socialSeed: "In 2018, the Kennedy Center received a $24,000,000 arts and culture grant"
  },
  {
    company: "an arts-educator staffing platform born out of California Prop 28",
    aggregate: "21 sourced signals across 11 federal agencies and two source systems",
    findings: [
      ["Westat, Inc.", "$9,954,119", "2011"],
      ["FM Talent Source, LLC", "$547,714", "2018"]
    ],
    socialSeed: "In 2011, Westat, Inc. received $9,954,119 from the Department of Education"
  }
];

for (const article of articleEvidence) {
  assert.match(peopleIndustriesSource, new RegExp(article.company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(peopleIndustriesSource, new RegExp(article.aggregate));
  assert.match(peopleIndustriesSource, new RegExp(article.socialSeed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const [recipient, amount, awardYear] of article.findings) {
    const evidencePattern = new RegExp(
      `${recipient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"\\n]*${amount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"\\n]*${awardYear}`
    );
    assert.match(
      peopleIndustriesSource,
      evidencePattern,
      `${recipient} article evidence must carry its exact amount and award year`
    );
  }
}

for (const removedIllustrativeExample of [
  "An illustrative DME row might begin",
  "An illustrative event-production row might say",
  "An illustrative training-company row might pair"
]) {
  assert.doesNotMatch(
    peopleIndustriesSource,
    new RegExp(removedIllustrativeExample),
    `Replace hypothetical article example: ${removedIllustrativeExample}`
  );
}

assert.match(
  peopleIndustriesSource,
  /These awards proved[\s\S]*They did not establish a current purchase, open opportunity, or response date\./
);
assert.match(
  peopleIndustriesSource,
  /These records supported funded-buyer, contractor, and partner research\.[\s\S]*They did not establish that any recipient was currently purchasing or accepting proposals\./
);
assert.match(
  peopleIndustriesSource,
  /These records supported funded-buyer and recipient-partner research; they did not establish a current staffing request, open application, or purchasing cycle\./
);

assert.match(componentSource, /DATA FRESHNESS POLICY/);
assert.match(componentSource, /export function getRealScanVertical/);
assert.match(componentSource, /export function getRealScanFindings/);
assert.match(componentSource, /export function getCrossSiteAggregates/);
assert.match(componentSource, /Historical award/);
assert.doesNotMatch(componentSource, /"use client"/);

for (const requiredRule of [
  "at least one real datapoint",
  "explicitly labeled as a framework piece",
  "A quick-answer box is mandatory",
  "Never use stock imagery",
  "HTML comment"
]) {
  assert.match(guidelinesSource, new RegExp(requiredRule));
}

const tsconfigPath = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
assert.equal(tsconfig.error, undefined, "tsconfig.json must be readable");

const parsedConfig = ts.parseJsonConfigFileContent(
  tsconfig.config,
  ts.sys,
  fileURLToPath(root)
);
const componentPath = fileURLToPath(
  new URL("../components/resources/real-scan-findings.tsx", import.meta.url)
);
const peopleIndustriesPath = fileURLToPath(
  new URL("../lib/resourceArticleRefreshes/peopleIndustries.ts", import.meta.url)
);
const program = ts.createProgram({
  rootNames: [componentPath, peopleIndustriesPath],
  options: {
    ...parsedConfig.options,
    incremental: false,
    noEmit: true
  }
});
const diagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) =>
    [componentPath, peopleIndustriesPath].includes(diagnostic.file?.fileName || "")
  );

assert.deepEqual(
  diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  ),
  [],
  "The real scan findings component and people/industries article refreshes must typecheck"
);

console.log("Real scan content evidence checks passed.");
