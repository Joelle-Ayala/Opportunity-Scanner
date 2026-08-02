import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [jsonSource, componentSource, guidelinesSource] = await Promise.all([
  source("content/real-scan-findings.json"),
  source("components/resources/real-scan-findings.tsx"),
  source("CONTENT_GUIDELINES.md")
]);

const data = JSON.parse(jsonSource);

assert.equal(data._policy.classification, "evidence");
assert.equal(
  Object.keys(data)[0],
  "_policy",
  "The strict-JSON policy block must remain the first documented field"
);
assert.deepEqual(data._policy.rules, [
  'These are historical award records = funded-buyer evidence. NEVER render or write urgency ("closing soon", "deadline") from this data.',
  "Scanned companies are anonymized exactly as the asset file specifies; award recipients and amounts are public record and cited as-is."
]);
assert.equal(
  data.label,
  "From real scans — public records surfaced by Opportunity Scanner"
);
assert.equal(data.as_of, "2026-07-26");
assert.equal(data.as_of_display, "July 26, 2026");

assert.deepEqual(Object.keys(data.verticals), [
  "creative-economy",
  "education-workforce",
  "healthcare-dme"
]);

const expectedVerticals = {
  "creative-economy": {
    company: "a musician-booking marketplace",
    signals: 28,
    agencies: 9,
    systems: 3,
    narrative:
      "Federal money funds live programming through at least three distinct routes - direct event contractors, cultural institutions, and workforce programs - each implying a different partner/sell motion.",
    findings: [
      [
        "John F. Kennedy Center for the Performing Arts",
        24000000,
        "Dept. of Education",
        "arts and culture grant"
      ],
      [
        "Hargrove, LLC",
        9267988,
        "Dept. of State",
        "cultural programming and live events"
      ],
      [
        "Isom Events LLC",
        1152925,
        "Dept. of the Interior",
        "city/county live performance work"
      ],
      [
        "Chevo Studios Inc.",
        381588,
        "Dept. of the Interior",
        "creative workforce development"
      ]
    ]
  },
  "education-workforce": {
    company: "an arts-educator staffing platform born out of California Prop 28",
    signals: 21,
    agencies: 11,
    systems: 2,
    narrative:
      "Educator-workforce money flows to staffing intermediaries, not only districts - a services company can enter as a recipient partner, not just a district vendor. Prop 28 (California) is a live state-level driver for arts-educator demand.",
    findings: [
      [
        "Westat, Inc.",
        9954119,
        "Dept. of Education",
        "K-12 hiring, teacher staffing, and educator workforce work"
      ],
      [
        "FM Talent Source, LLC",
        547714,
        "Dept. of Education",
        "arts education and teaching-artist staffing"
      ]
    ]
  },
  "healthcare-dme": {
    company: "a compression-garment and recovery products brand",
    signals: 14,
    agencies: 5,
    systems: 2,
    narrative:
      "DME demand shows up in three tiers - reimbursement infrastructure (nine figures), VA clinical purchasing (eight figures), and direct agency supply buys (five-six figures). The surprising buyer (NASA) is the shareable hook.",
    findings: [
      [
        "Peraton Enterprise Solutions",
        95922714,
        "HHS",
        "DME, Medicare, and reimbursement infrastructure"
      ],
      [
        "Valiant Construction LLC",
        17139378,
        "Dept. of Veterans Affairs",
        "award adjacent to prosthetics and orthotics purchasing"
      ],
      [
        "BSN Medical Inc.",
        133587,
        "NASA",
        "funded-buyer signal"
      ]
    ]
  }
};

for (const [verticalKey, expected] of Object.entries(expectedVerticals)) {
  const vertical = data.verticals[verticalKey];

  assert.equal(vertical.anonymized_company, expected.company);
  assert.equal(vertical.aggregate.sourced_signals, expected.signals);
  assert.equal(vertical.aggregate.distinct_federal_agencies, expected.agencies);
  assert.equal(vertical.aggregate.source_system_count, expected.systems);
  assert.equal(vertical.narrative, expected.narrative);
  assert.deepEqual(
    vertical.findings.map((finding) => [
      finding.recipient,
      finding.amount,
      finding.agency,
      finding.evidence
    ]),
    expected.findings
  );

  for (const finding of vertical.findings) {
    for (const field of [
      "recipient",
      "amount",
      "agency",
      "source_system",
      "implication"
    ]) {
      assert.notEqual(
        finding[field],
        undefined,
        `${verticalKey} finding must include ${field}`
      );
    }
  }
}

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

const dataKeys = collectKeys(data);
for (const prohibitedKey of ["deadline", "close_date", "urgency", "closing_soon"]) {
  assert.equal(
    dataKeys.includes(prohibitedKey),
    false,
    `Historical evidence must not define ${prohibitedKey}`
  );
}

for (const componentRequirement of [
  /export function RealScanFindings/,
  /limit\?: 2 \| 3/,
  /\.findings\.slice\(0, limit\)/,
  /realScanData\.label/,
  /realScanData\.as_of/,
  /finding\.recipient/,
  /finding\.amount_display/,
  /finding\.agency/,
  /finding\.source_system/,
  /finding\.implication/
]) {
  assert.match(componentSource, componentRequirement);
}

assert.match(componentSource, /DATA FRESHNESS POLICY/);
assert.doesNotMatch(componentSource, /"use client"/);

for (const guidelineRequirement of [
  "at least one real datapoint",
  "explicitly labeled as a framework piece",
  "A quick-answer box is mandatory",
  "Never use stock imagery",
  "HTML comment"
]) {
  assert.match(guidelinesSource, new RegExp(guidelineRequirement));
}

console.log("Real scan findings foundation checks passed.");
