import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PURSUIT_APPLICATION_METHODS,
  PURSUIT_STAGES,
  isPursuitStage,
  pursuitApplicationMethod,
  pursuitDefaults,
  pursuitMethodLabel,
  pursuitStageFor,
  sourceActionLabel
} from "../lib/pursuits.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");

function normalizedAction(overrides = {}) {
  return {
    estimated_opportunity_type: "active_opportunity",
    buyer_partner_type: "agency",
    revenue_motion: "Direct Apply",
    target_organization: "Example Public Agency",
    source_status: "Open",
    source_deadline: "2026-09-30T17:00:00-04:00",
    source_published_date: "2026-07-01",
    time_sensitivity: "active",
    pursuit_difficulty: "medium",
    actionability_score: 84,
    actionability_label: "Strong",
    show_in_report: true,
    screening_path: "current_source",
    screening_reason: "The official source supports an active route.",
    next_best_action: "Confirm eligibility and review the official instructions.",
    contact_strategy: "contact_grants_manager",
    recommended_contact_roles: ["Program Manager"],
    source_native_contact_available: false,
    manual_research_instruction: "Confirm applicant eligibility on the official source.",
    workflow_payload_ready: true,
    workflow_payload_reason: "The source and next action are clear.",
    crm_note: "Source-backed public-sector opportunity.",
    outreach_angle: "Lead with relevant delivery experience.",
    follow_up_task: "Complete the eligibility review.",
    ...overrides
  };
}

function opportunity(overrides = {}, actionOverrides = {}) {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    created_at: "2026-07-22T12:00:00.000Z",
    opportunity_title: "Example public-sector opportunity",
    source_type: "active_grant",
    source_name: "Grants.gov",
    source_url: "https://Grants.gov/opportunity/123?b=2&a=1#summary",
    agency_or_funder: "Example Public Agency",
    deadline: "2026-09-30",
    geography: "Federal",
    external_evidence_summary: "Official opportunity instructions and deadline.",
    why_it_matters: "The company may have a direct route to public funding.",
    who_benefits: "Eligible applicants",
    likely_buyer_or_partner: "Example Public Agency",
    revenue_pathway: "direct_apply",
    relevance_score: 88,
    novelty_score: 78,
    confidence_score: 86,
    reasoning: ["Official source is active."],
    recommended_action: "Review eligibility.",
    actionability: "yes",
    actionability_reason: "A current source and deadline are present.",
    best_next_step: "Review eligibility.",
    human_review_required: false,
    query_used: "example grant",
    raw_json: {},
    normalized_action: normalizedAction(actionOverrides),
    ...overrides
  };
}

function assertBefore(text, earlier, later, message) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);
  assert.ok(earlierIndex >= 0, `Missing contract marker: ${earlier}`);
  assert.ok(laterIndex >= 0, `Missing contract marker: ${later}`);
  assert.ok(earlierIndex < laterIndex, message);
}

assert.deepEqual(PURSUIT_APPLICATION_METHODS, [
  "direct_application",
  "procurement_response",
  "vendor_registration",
  "buyer_outreach",
  "partner_outreach",
  "monitor"
]);
assert.deepEqual(PURSUIT_STAGES, [
  "researching",
  "qualifying",
  "preparing",
  "submitted",
  "won",
  "lost",
  "monitoring"
]);
assert.equal(isPursuitStage("submitted"), true);
assert.equal(isPursuitStage("applying"), false);

const direct = opportunity();
assert.equal(pursuitApplicationMethod(direct), "direct_application");
assert.equal(pursuitStageFor("direct_application"), "qualifying");
assert.equal(pursuitMethodLabel("direct_application"), "Direct application");
assert.equal(sourceActionLabel("direct_application"), "Review official instructions");

const procurement = opportunity(
  { source_type: "active_contract", revenue_pathway: "procurement_bid", source_name: "SAM.gov" },
  { revenue_motion: "Direct Apply", contact_strategy: "inspect_procurement_record" }
);
assert.equal(pursuitApplicationMethod(procurement), "procurement_response");
assert.equal(sourceActionLabel("procurement_response"), "Review procurement notice");

const indirectGrant = opportunity(
  { source_type: "active_grant", revenue_pathway: "sell_to_grantee" },
  { revenue_motion: "Sell to Funded Buyer", contact_strategy: "contact_program_office" }
);
assert.equal(
  pursuitApplicationMethod(indirectGrant),
  "buyer_outreach",
  "an active grant must not become a direct application unless the company is the applicant"
);

const vendorRegistration = opportunity(
  { source_type: "procurement_category", revenue_pathway: "sell_to_agency" },
  { revenue_motion: "Sell to Agency", contact_strategy: "contact_procurement_office" }
);
assert.equal(pursuitApplicationMethod(vendorRegistration), "vendor_registration");

const partner = opportunity(
  { source_type: "funded_buyer", revenue_pathway: "partner_with_recipient" },
  { revenue_motion: "Partner with Recipient", contact_strategy: "contact_award_recipient" }
);
assert.equal(pursuitApplicationMethod(partner), "partner_outreach");

const buyer = opportunity(
  { source_type: "funded_buyer", revenue_pathway: "sell_to_grantee" },
  { revenue_motion: "Sell to Funded Buyer", buyer_partner_type: "funded_buyer", contact_strategy: "contact_program_office" }
);
assert.equal(pursuitApplicationMethod(buyer), "buyer_outreach");

const expired = opportunity(
  { source_type: "active_contract", revenue_pathway: "procurement_bid" },
  {
    time_sensitivity: "expired",
    estimated_opportunity_type: "research_only",
    contact_strategy: "inspect_procurement_record"
  }
);
assert.equal(pursuitApplicationMethod(expired), "monitor", "expired records must never resolve to an application route");
assert.equal(pursuitStageFor("monitor"), "monitoring");

const defaults = pursuitDefaults({
  scan: {
    id: "11111111-1111-4111-8111-111111111111",
    company_name: "Fallback Company",
    company_url: "https://www.fallback.example/path"
  },
  signal: direct,
  profile: {
    canonical_domain: "https://www.Acme.example/about",
    company_name: "Acme Services"
  }
});
assert.equal(defaults.company_context_key, "acme.example");
assert.equal(defaults.canonical_opportunity_key, "url:https://grants.gov/opportunity/123?a=1&b=2");
assert.equal(defaults.application_method, "direct_application");
assert.equal(defaults.stage, "qualifying");
assert.equal(defaults.deadline, "2026-09-30");
assert.equal(defaults.company_name, "Acme Services");
assert.equal(defaults.owner_name, "");
assert.equal(defaults.notes, "");
assert.match(defaults.eligibility_notes, /eligible applicant/i);
assert.match(defaults.registration_requirements, /Grants\.gov/i);
assert.deepEqual(defaults.required_documents, [
  "Eligibility checklist",
  "Project narrative",
  "Budget and budget narrative",
  "Timeline and required attachments"
]);

const noDeadline = pursuitDefaults({
  scan: { id: "11111111-1111-4111-8111-111111111111", company_name: null, company_url: "fallback.example" },
  signal: opportunity({ deadline: "not verified" }, { source_deadline: "" })
});
assert.equal(noDeadline.deadline, null);
assert.equal(noDeadline.company_context_key, "fallback.example");

const [
  migration,
  createRoute,
  updateRoute,
  pursuitRepository,
  reportPage,
  opportunityPage,
  pursuitWorkspace,
  pursuitActionLink,
  productAnalytics,
  dashboardPage,
  customerDashboard,
  dashboardShell,
  pursuitList
] = await Promise.all([
  source("db/customer-opportunity-pursuits.sql"),
  source("app/api/opportunities/pursuits/route.ts"),
  source("app/api/opportunities/pursuits/[pursuitId]/route.ts"),
  source("lib/dashboard/pursuits.ts"),
  source("app/reports/[id]/page.tsx"),
  source("app/opportunities/[id]/page.tsx"),
  source("components/pursuit-workspace.tsx"),
  source("components/pursuit-action-link.tsx"),
  source("lib/productAnalytics.ts"),
  source("app/dashboard/page.tsx"),
  source("components/dashboard/customer-dashboard.tsx"),
  source("components/dashboard/dashboard-shell.tsx"),
  source("components/dashboard/pursuit-list.tsx")
]);

assert.match(migration, /create table if not exists customer_opportunity_pursuits/i);
assert.match(migration, /customer_account_id uuid not null references customer_accounts\(id\) on delete cascade/i);
assert.match(migration, /foreign key \(scan_id, opportunity_id\)[\s\S]*references scan_opportunities\(scan_id, opportunity_id\)[\s\S]*on delete restrict/i);
assert.match(migration, /unique \(customer_account_id, company_context_key, canonical_opportunity_key\)/i);
assert.match(migration, /version integer not null default 1 check \(version > 0\)/i);
assert.match(migration, /alter table customer_opportunity_pursuits enable row level security/i);
assert.match(migration, /revoke all on customer_opportunity_pursuits from anon, authenticated/i);
assert.match(migration, /grant all on customer_opportunity_pursuits to service_role/i);
for (const stage of PURSUIT_STAGES) assert.match(migration, new RegExp(`'${stage}'`));
for (const method of PURSUIT_APPLICATION_METHODS) assert.match(migration, new RegExp(`'${method}'`));

assert.match(createRoute, /isSameOriginRequest\(request, config\.appOrigin\)/);
assert.match(createRoute, /resolveCustomerSession\(config, cookies\(\)\)/);
assert.match(createRoute, /if \(!session\?\.user\.email\)/);
assert.match(createRoute, /getScan\(scanId\)/);
assert.match(createRoute, /getCompletedReportReadiness\(scan\)/);
assert.match(createRoute, /startCustomerPursuit\(\{[\s\S]*authUserId: session\.user\.id[\s\S]*signal/s);
assertBefore(createRoute, "isSameOriginRequest", "request.formData()", "same-origin validation must happen before form parsing");
assertBefore(createRoute, "resolveCustomerSession", "startCustomerPursuit", "authentication must happen before pursuit creation");

assert.match(pursuitRepository, /customer_scan_ownership/);
assert.match(pursuitRepository, /hasCustomerServerReportAccess/);
assert.match(pursuitRepository, /throw new PursuitError\("REPORT_ACCESS_REQUIRED"\)/);
assert.match(pursuitRepository, /PURSUIT_CONFLICT/);
assert.match(pursuitRepository, /customer_account_id: `eq\.\$\{account\.id\}`/);
assert.match(pursuitRepository, /onConflict: "customer_account_id,company_context_key,canonical_opportunity_key"/);
assertBefore(pursuitRepository, "await requireOwnedReport", "dashboardInsert<CustomerOpportunityPursuit>", "full account ownership must be checked before insert");
assert.match(pursuitRepository, /version: `eq\.\$\{input\.expectedVersion\}`/);
assert.match(pursuitRepository, /version: current\.version \+ 1/);
assert.match(pursuitRepository, /version: `eq\.\$\{canonical\.version\}`/);
assert.match(pursuitRepository, /version: canonical\.version \+ 1/);
assert.match(pursuitRepository, /application_method: defaults\.application_method/);
assert.match(pursuitRepository, /await requireOwnedReport\(input\.authUserId, account\.id, canonicalScan\)/);
assert.match(pursuitRepository, /const routeChanged = canonical\.application_method !== defaults\.application_method/);
assertBefore(pursuitRepository, "const routeChanged = canonical.application_method", "if (!routeChanged) return canonical", "accessible canonical pursuits must compare refreshed route metadata before returning");

assert.match(updateRoute, /isSameOriginRequest\(request, config\.appOrigin\)/);
assert.match(updateRoute, /if \(!session\?\.user\.email\)/);
assert.match(updateRoute, /isPursuitStage\(stage\)/);
assert.match(updateRoute, /updateCustomerPursuit\(\{[\s\S]*authUserId: session\.user\.id[\s\S]*pursuitId: params\.pursuitId/s);
assert.match(updateRoute, /expectedVersion: Number\(form\.get\("expectedVersion"\)\)/);
assert.match(updateRoute, /error instanceof PursuitError/);
assert.match(updateRoute, /The pursuit could not be saved\. Please try again\./);

const primaryActionStart = reportPage.indexOf("function PrimaryActionButton");
const primaryActionEnd = reportPage.indexOf("function OpportunityProfileModule", primaryActionStart);
const primaryAction = reportPage.slice(primaryActionStart, primaryActionEnd);
assert.match(primaryAction, /`\/opportunities\/\$\{signal\.id\}\?scanId=\$\{scanId\}/);
assert.doesNotMatch(primaryAction, /href\s*=\s*signal\.source_url/);
assert.doesNotMatch(primaryAction, /target=\{opensSource/);
assert.match(reportPage, /Qualify application/);
assert.match(reportPage, /View action path/);
assertBefore(reportPage, 'signal.revenue_pathway === "partner_with_recipient"', 'classification.buyer_partner_type === "award_recipient"', "partner routes must win before generic recipient research");

assert.match(opportunityPage, /loadCustomerPursuitForOpportunity/);
assert.match(opportunityPage, /pursuitApplicationMethod\(signal, profile\)/);
assert.match(opportunityPage, /<PursuitWorkspace/);
assertBefore(opportunityPage, "<PursuitWorkspace", "Why This Is Actionable", "the pursuit workspace must precede secondary opportunity analysis");
assert.match(opportunityPage, /role="status" aria-live="polite"/);
assert.match(opportunityPage, /role="alert"/);

assert.match(pursuitWorkspace, /action="\/api\/opportunities\/pursuits" method="post"/);
assert.match(pursuitWorkspace, /action=\{`\/api\/opportunities\/pursuits\/\$\{pursuit\.id\}`\} method="post"/);
assert.match(pursuitWorkspace, /Sign in to track/);
assert.match(pursuitWorkspace, /<PursuitActionLink/);
assert.match(pursuitWorkspace, /Start pursuit/);
assert.match(pursuitWorkspace, /Save pursuit/);
assert.match(pursuitWorkspace, /name="stage"/);
assert.match(pursuitWorkspace, /name="deadline"/);
assert.match(pursuitWorkspace, /name="requiredDocuments"/);
assert.match(pursuitWorkspace, /name="expectedVersion" value=\{pursuit\.version\}/);
assert.match(pursuitWorkspace, /Full report access required/);
assert.match(pursuitActionLink, /target="_blank"/);
assert.match(pursuitActionLink, /rel="noreferrer"/);
assert.match(pursuitActionLink, /opens in a new tab/);
assert.match(pursuitActionLink, /action: "review_source", report_tier: "full"/);
assert.match(createRoute, /console\.info\("product\.pursuit_changed", \{ changeType: "started" \}\)/);
assert.match(updateRoute, /console\.info\("product\.pursuit_changed", \{ changeType: "saved" \}\)/);
assert.doesNotMatch(productAnalytics, /pursuit_changed/);
assert.match(productAnalytics, /"review_source"/);

assert.match(dashboardShell, /DashboardTabId = [^;]*"pursuits"/);
assert.match(customerDashboard, /\{ id: "pursuits", label: "Pursuits", count: pursuits\.pursuits\.length \}/);
assert.match(customerDashboard, /activeTab === "pursuits" \? <PursuitList/);
assert.match(dashboardPage, /loadCustomerPursuits\(session\.user\.id\)/);
assert.match(dashboardPage, /searchParams\?\.tab === "pursuits" \? "pursuits"/);
assert.match(dashboardPage, /eyebrow: "Next pursuit action"/);
assert.match(dashboardPage, /label: "Active pursuits"/);
assert.match(dashboardPage, /pursuits=\{\{ pursuits \}\}/);
assert.match(pursuitList, /No pursuits started/);
assert.match(pursuitList, /\/dashboard\?tab=pursuits|\/dashboard\?tab=reports/);
assert.match(pursuitList, /\/opportunities\/\$\{pursuit\.opportunity_id\}\?scanId=\$\{pursuit\.scan_id\}/);

console.log("Pursuit workflow verification passed: resolver/defaults plus migration, authorization, report routing, opportunity workspace, and dashboard contracts.");
