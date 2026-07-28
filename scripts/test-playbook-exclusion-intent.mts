import assert from "node:assert/strict";
import { applyPlaybooksToProfile, matchPlaybooks } from "../lib/playbooks.ts";
import { generateCompanyProfile } from "../lib/profile.ts";
import type { CompanyProfile, ScanInput } from "../lib/types.ts";

const reparelProfile: CompanyProfile = {
  company_name: "Reparel",
  website: "https://reparel.com",
  summary:
    "Reparel provides medical compression garments, orthopedic bracing, and rehabilitation supplies for recovery and mobility.",
  products_services: [
    "medical compression garments",
    "orthopedic braces",
    "rehabilitation supplies"
  ],
  target_customers: ["Healthcare", "B2B"],
  industries: ["healthcare", "rehabilitation", "durable medical equipment"],
  geographies: ["United States"],
  keywords: ["compression", "orthotics", "rehabilitation", "medical supplies"],
  public_sector_search_terms: [],
  translated_public_sector_terms: [],
  negative_keywords: [],
  possible_naics: [],
  possible_psc: [],
  possible_soc: [],
  policy_sensitive_categories: [],
  opportunity_lanes: [],
  lane_search_terms: {},
  opportunity_categories: [],
  selected_playbooks: [],
  activated_source_categories: [],
  planned_source_categories: [],
  likely_revenue_motions: [],
  suggested_contact_roles: [],
  report_guidance: []
};

const input: ScanInput = {
  companyUrl: "https://reparel.com",
  companyName: "Reparel",
  industry: "Healthcare / Rehab / DME",
  customerType: "Healthcare",
  opportunityFocus:
    "Find VA prosthetics and orthotics purchasing, rehabilitation supply procurement, and funded healthcare buyer opportunities.",
  includeTerms:
    "compression garments, orthotic supplies, rehabilitation supplies, durable medical equipment",
  excludeTerms: "music, arts, education staffing",
  prioritySignals: ["procurement", "awards"],
  reportType: "deep"
};

const matches = matchPlaybooks(reparelProfile, input);
assert.equal(matches[0]?.playbook_id, "healthcare_rehab_dme");
assert.equal(
  matches.some((playbook) => playbook.playbook_id === "music_arts_creative_economy"),
  false,
  "creative exclusions must not activate the creative-economy playbook"
);
assert.equal(
  matches.some((playbook) => playbook.playbook_id === "education_workforce_training"),
  false,
  "education exclusions must not activate the education-workforce playbook"
);

const applied = applyPlaybooksToProfile(reparelProfile, input);
assert.deepEqual(
  applied.selected_playbooks.map((playbook) => playbook.playbook_id),
  ["healthcare_rehab_dme"]
);
assert.equal(
  applied.public_sector_search_terms.some((term) =>
    /^(music|arts|education staffing)$/i.test(term)
  ),
  false,
  "excluded phrases must not become positive public-sector search terms"
);

const originalApiKey = process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_KEY;

try {
  const generated = await generateCompanyProfile(
    input,
    "Reparel makes compression recovery garments, orthopedic braces, and rehabilitation products for medical providers, DME suppliers, and recovery channels."
  );

  assert.deepEqual(
    generated.selected_playbooks.map((playbook) => playbook.playbook_id),
    ["healthcare_rehab_dme"],
    "the generated Reparel profile must stay healthcare-only"
  );
  assert.equal(
    [...generated.public_sector_search_terms, ...generated.opportunity_lanes].some((term) =>
      /\b(music|arts|education staffing)\b/i.test(term)
    ),
    false,
    "excluded phrases must not become generated search terms or opportunity lanes"
  );
  assert.ok(generated.negative_keywords.includes("music"));
  assert.ok(generated.negative_keywords.includes("arts"));
  assert.ok(generated.negative_keywords.includes("education staffing"));
} finally {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
}

console.log("PASS playbook exclusion intent: Reparel stays healthcare-only");
