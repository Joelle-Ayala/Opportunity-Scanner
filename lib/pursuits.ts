import { opportunityActionFor } from "./opportunityAction";
import { monitoringOpportunityKey } from "./monitoring/core";
import { parseOutboundUrl } from "./url";
import type { CompanyProfile, ScanRecord, StoredOpportunitySignal } from "./types";
import {
  type CustomerOpportunityPursuit,
  type PursuitApplicationMethod,
  type PursuitStage
} from "./pursuit-contract";

export * from "./pursuit-contract";

export function pursuitApplicationMethod(
  signal: StoredOpportunitySignal,
  profile?: CompanyProfile | null
): PursuitApplicationMethod {
  const action = opportunityActionFor(signal, profile);
  if (action.time_sensitivity === "expired") return "monitor";
  if (signal.source_type === "active_contract") return "procurement_response";
  if (signal.source_type === "active_grant" && signal.revenue_pathway === "direct_apply") {
    return "direct_application";
  }
  if (["inspect_procurement_record", "contact_procurement_office"].includes(action.contact_strategy)) {
    return "vendor_registration";
  }
  if (signal.revenue_pathway === "partner_with_recipient") return "partner_outreach";
  if (
    signal.revenue_pathway === "monitor_policy" ||
    action.contact_strategy === "monitor_source"
  ) {
    return "monitor";
  }
  return "buyer_outreach";
}

export function pursuitStageFor(method: PursuitApplicationMethod): PursuitStage {
  return method === "monitor" ? "monitoring" : "qualifying";
}

function registrationRequirements(method: PursuitApplicationMethod): string {
  if (method === "procurement_response") {
    return "Confirm SAM.gov registration, UEI, solicitation-specific representations, and any required state or local vendor registration before preparing a response.";
  }
  if (method === "direct_application") {
    return "Confirm the eligible applicant type and whether SAM.gov, Grants.gov, a state portal, or another funder account must be active before submission.";
  }
  if (method === "vendor_registration") {
    return "Confirm the buyer's vendor registration path, commodity or NAICS codes, insurance requirements, and procurement contact before outreach.";
  }
  if (method === "monitor") {
    return "No application registration is assumed. Verify that the signal becomes an active funding, procurement, or partner route before treating it as an application.";
  }
  return "No direct application is assumed. Confirm the target organization and the correct business-development contact path before outreach.";
}

function requiredDocuments(method: PursuitApplicationMethod): string[] {
  if (method === "procurement_response") {
    return ["Solicitation compliance checklist", "Capability statement", "Technical response", "Pricing response"];
  }
  if (method === "direct_application") {
    return ["Eligibility checklist", "Project narrative", "Budget and budget narrative", "Timeline and required attachments"];
  }
  if (method === "vendor_registration") {
    return ["Capability statement", "Vendor registration information", "Relevant certifications and insurance"];
  }
  if (method === "partner_outreach") {
    return ["Partner brief", "Relevant proof points", "Proposed role and value exchange"];
  }
  if (method === "buyer_outreach") {
    return ["Account brief", "Relevant proof points", "Outreach draft"];
  }
  return ["Source verification notes", "Trigger and follow-up criteria"];
}

function normalizedDeadline(value: string): string | null {
  const parsed = Date.parse(value);
  if (!value || !Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function pursuitDefaults(input: {
  scan: Pick<ScanRecord, "id" | "company_name" | "company_url">;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile | null;
}): Omit<CustomerOpportunityPursuit, "id" | "customer_account_id" | "created_at" | "updated_at"> {
  const action = opportunityActionFor(input.signal, input.profile);
  const method = pursuitApplicationMethod(input.signal, input.profile);
  let companyContextKey = input.profile?.canonical_domain || input.scan.company_url;
  try {
    companyContextKey = new URL(companyContextKey).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    companyContextKey = companyContextKey.trim().toLowerCase();
  }
  return {
    scan_id: input.scan.id,
    opportunity_id: input.signal.id,
    company_context_key: companyContextKey,
    canonical_opportunity_key: monitoringOpportunityKey(input.signal),
    opportunity_title: input.signal.opportunity_title,
    company_name: input.profile?.company_name || input.scan.company_name || input.scan.company_url,
    source_name: input.signal.source_name,
    source_url: parseOutboundUrl(input.signal.source_url).toString(),
    target_organization: action.target_organization,
    revenue_motion: action.revenue_motion,
    application_method: method,
    stage: pursuitStageFor(method),
    owner_name: "",
    source_verified: false,
    fit_decision: "not_reviewed",
    route_verified: false,
    deadline: normalizedDeadline(action.source_deadline || input.signal.deadline),
    next_step: action.next_best_action,
    eligibility_notes: method === "direct_application"
      ? "Confirm that the company is an eligible applicant before investing in an application. If it is not eligible, identify the grantee or partner sales path instead."
      : "Confirm the opportunity is current, the target is correct, and the revenue motion matches this company before committing resources.",
    registration_requirements: registrationRequirements(method),
    required_documents: requiredDocuments(method),
    notes: "",
    version: 1
  };
}
