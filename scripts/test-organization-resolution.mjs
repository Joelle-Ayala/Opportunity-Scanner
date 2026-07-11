import assert from "node:assert/strict";
import {
  enrichmentEligibilityForTarget,
  normalizeOrganizationName,
  resolveOrganizationTargets,
  resolvePrimaryTargetForSignal
} from "../lib/organizationResolution.ts";

const source = (overrides) => ({
  sourceName: "USAspending.gov",
  sourceUrl: "https://www.usaspending.gov/award/example",
  field: "Recipient Name",
  value: "Example Organization",
  role: "recipient",
  ...overrides
});

assert.equal(normalizeOrganizationName("The Acme Medical Supply, LLC"), "acme medical supply");
assert.equal(normalizeOrganizationName("ACME Medical Supply Inc."), "acme medical supply");

const reparel = resolveOrganizationTargets([
  source({ value: "Rehab Distribution Partners, LLC", role: "recipient", field: "Recipient Name" }),
  source({ value: "REHAB DISTRIBUTION PARTNERS INC.", role: "distributor", field: "Award Description", domain: "https://www.rehabdistribution.example/about", domainField: "recipient_website" })
]);
assert.equal(reparel.length, 1, "legal suffix variants must deduplicate");
assert.equal(reparel[0].targetType, "distributor_prime_candidate");
assert.equal(reparel[0].verifiedDomain, "rehabdistribution.example");
assert.equal(enrichmentEligibilityForTarget(reparel[0], ["Distribution Partnerships Director"]).snovEligible, true);

const usaSpendingRecipient = resolvePrimaryTargetForSignal({
  source_name: "USAspending.gov",
  source_url: "https://www.usaspending.gov/award/reparel-example",
  source_type: "historical_award",
  agency_or_funder: "Department of Veterans Affairs",
  likely_buyer_or_partner: "Rehab Distribution Partners LLC",
  revenue_pathway: "sell_to_grantee",
  external_evidence_summary: "Prime contract for medical supply distribution",
  raw_json: {
    "Award ID": "award-1",
    recipient_website: "https://rehabdistribution.example"
  }
});
assert.equal(usaSpendingRecipient?.targetType, "distributor_prime_candidate");
assert.equal(usaSpendingRecipient?.verifiedDomainEvidence?.field, "recipient_website");

const jammcard = resolveOrganizationTargets([
  source({ sourceName: "Grants.gov", sourceUrl: "https://grants.gov/example", value: "Downtown Arts Alliance", role: "grantee" }),
  source({ sourceName: "City Open Data", sourceUrl: "https://city.example.gov/record/1", value: "City of Example Cultural Affairs Department", role: "agency", field: "buyer" })
]);
assert.equal(jammcard.find((item) => item.displayName === "Downtown Arts Alliance")?.targetType, "grantee_partner_candidate");
const cityBuyer = jammcard.find((item) => item.isPublicAgency);
assert.equal(cityBuyer?.targetType, "agency");
assert.equal(cityBuyer?.contactRoute, "procurement_office");
assert.equal(enrichmentEligibilityForTarget(cityBuyer ?? null, ["Cultural Affairs Manager"]).clayEligible, false);

const schoolGig = resolveOrganizationTargets([
  source({ value: "Example Unified School District", role: "buyer", field: "Funded Buyer" }),
  source({ sourceName: "Grants.gov", sourceUrl: "https://grants.gov/example", value: "Future Teachers Network", role: "eligible_applicant", field: "Eligible Applicant", domain: "futureteachers.example", domainField: "official_website" })
]);
assert.equal(schoolGig.find((item) => item.displayName === "Example Unified School District")?.targetType, "agency");
assert.equal(schoolGig.find((item) => item.displayName === "Future Teachers Network")?.targetType, "grantee_partner_candidate");

const missingDomain = resolveOrganizationTargets([source({ value: "Commercial Recipient LLC", role: "recipient" })])[0];
const missingDomainEligibility = enrichmentEligibilityForTarget(missingDomain, ["Program Director"]);
assert.equal(missingDomainEligibility.clayEligible, false);
assert.match(missingDomainEligibility.reason, /No attributable/);

const noRoles = enrichmentEligibilityForTarget(reparel[0], []);
assert.equal(noRoles.snovEligible, false);
assert.match(noRoles.reason, /roles/);

const conflicting = resolveOrganizationTargets([
  source({ value: "City of Example Health Department", role: "agency", field: "Awarding Agency" }),
  source({ value: "CITY OF EXAMPLE HEALTH DEPARTMENT", role: "distributor", field: "Recipient Type" })
])[0];
assert.equal(conflicting.targetType, "research_only");
assert.equal(conflicting.manualResearchRequired, true);
assert.match(conflicting.manualResearchReason ?? "", /conflicts/);

const conflictingDomain = resolveOrganizationTargets([
  source({ value: "Arts Partner Inc", role: "recipient", domain: "artspartner.example", domainField: "recipient_domain" }),
  source({ value: "ARTS PARTNER LLC", role: "recipient", domain: "different.example", domainField: "official_website" })
])[0];
assert.equal(conflictingDomain.verifiedDomain, undefined);
assert.equal(conflictingDomain.manualResearchRequired, true);
assert.match(conflictingDomain.manualResearchReason ?? "", /Conflicting attributable domains/);

const guessedDomain = resolveOrganizationTargets([
  source({ value: "Named Recipient LLC", role: "recipient", domain: "guessed.example", domainField: "inferred_domain" })
])[0];
assert.equal(guessedDomain.verifiedDomain, undefined, "unattributed or inferred domain fields must be rejected");

console.log("PASS organization resolution: 8 evidence-first regression groups");
