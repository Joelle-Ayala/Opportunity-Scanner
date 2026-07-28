import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { classifyOpportunityRecord } from "../lib/opportunityRecordClassification.ts";

const source = await readFile(
  new URL("../lib/outreachPackage.ts", import.meta.url),
  "utf8"
);
const executableSource = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const unsafeClassification = {
  next_best_action: "Apply before the deadline closes tomorrow.",
  outreach_angle: "Tell them this current opportunity is closing soon.",
  crm_note: "URGENT: Current opportunity deadline is tomorrow.",
  recommended_contact_roles: ["Program Director"],
  revenue_motion: "sell_to_funded_buyer",
  contact_strategy: "contact_award_recipient",
  workflow_payload_ready: true,
  workflow_payload_reason: "Ready"
};

const moduleUnderTest = { exports: {} };
const requireForTest = (specifier: string) => {
  const modules: Record<string, unknown> = {
    "./actionability": { signalLane: () => "Healthcare and rehab" },
    "./contactTargeting": {
      contactTargetsForSignal: () => [
        {
          organization: "Recipient Health",
          roles: ["Program Director"],
          outreachAngle: "Ask about current needs."
        }
      ]
    },
    "./opportunityAction": { opportunityActionFor: () => unsafeClassification },
    "./opportunityClassification": {
      classificationLabel: (value: string) => value
    },
    "./opportunityRecordClassification": { classifyOpportunityRecord },
    "./storage": {
      listOpportunityEnrichmentRequests: async () => []
    }
  };
  if (!(specifier in modules)) throw new Error(`Unexpected dependency: ${specifier}`);
  return modules[specifier];
};

new Function("require", "module", "exports", executableSource)(
  requireForTest,
  moduleUnderTest,
  moduleUnderTest.exports
);

const { buildOutreachPackage } = moduleUnderTest.exports as {
  buildOutreachPackage: (input: Record<string, unknown>) => Promise<Array<Record<string, string>>>;
};

const baseSignal = {
  id: "evidence-1",
  opportunity_title: "Recipient Health received $547,714: workforce support",
  source_type: "historical_award",
  source_name: "USAspending",
  source_url: "https://example.test/award",
  agency_or_funder: "Department of Health",
  likely_buyer_or_partner: "Recipient Health",
  deadline: "2022-12-31",
  award_year: 2022,
  period_end: "2022-12-31",
  external_evidence_summary: "This current opportunity closes tomorrow.",
  revenue_pathway: "sell_to_grantee",
  raw_json: {}
};

const [evidenceRow] = await buildOutreachPackage({
  scan: { id: "scan-1", company_name: "Example Vendor" },
  profile: { company_name: "Example Vendor" },
  signals: [baseSignal]
});

const evidenceCopy = [
  evidenceRow.opportunityContext,
  evidenceRow.firstEmailSubject,
  evidenceRow.firstEmailBody,
  evidenceRow.followUp1,
  evidenceRow.crmNote,
  evidenceRow.workflowNote
].join("\n");

assert.match(evidenceCopy, /Recipient Health received \$547,714 in public funding in 2022/);
assert.match(evidenceCopy, /present (healthcare and rehab|needs|priorities)/i);
assert.match(evidenceCopy, /historical/i);
assert.doesNotMatch(evidenceCopy, /\bclosing soon\b/i);
assert.doesNotMatch(evidenceCopy, /\bdeadline\b/i);
assert.doesNotMatch(evidenceCopy, /\bcurrent\b/i);
assert.doesNotMatch(evidenceCopy, /\bapply before\b/i);

const currentDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const [currentRow] = await buildOutreachPackage({
  scan: { id: "scan-1", company_name: "Example Vendor" },
  profile: { company_name: "Example Vendor" },
  signals: [
    {
      ...baseSignal,
      id: "current-1",
      record_class: "current",
      current_validated_at: new Date().toISOString(),
      source_type: "active_contract",
      source_name: "SAM.gov",
      deadline: currentDeadline,
      award_year: null,
      period_end: null,
      external_evidence_summary: "Verified live solicitation."
    }
  ]
});

assert.match(currentRow.firstEmailBody, /public-sector funding or activity/i);
assert.match(currentRow.opportunityContext, /Apply before the deadline closes tomorrow/);

console.log("Class-safe outreach package verification passed.");
