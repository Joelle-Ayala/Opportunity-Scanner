import { classifyOpportunity } from "./opportunityClassification";
import { CompanyProfile, NormalizedOpportunityAction, OpportunitySignal, StoredOpportunitySignal } from "./types";

function targetOrganization(signal: OpportunitySignal): string {
  return signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review";
}

function hasNormalizedAction(value: unknown): value is NormalizedOpportunityAction {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<NormalizedOpportunityAction>;
  return Boolean(
    record.estimated_opportunity_type &&
      record.buyer_partner_type &&
      record.contact_strategy &&
      record.next_best_action &&
      typeof record.actionability_score === "number"
  );
}

export function normalizeOpportunityAction(
  signal: OpportunitySignal | StoredOpportunitySignal,
  profile?: CompanyProfile | null
): NormalizedOpportunityAction {
  const classification = classifyOpportunity(signal as StoredOpportunitySignal, profile);
  return {
    estimated_opportunity_type: classification.estimated_opportunity_type,
    buyer_partner_type: classification.buyer_partner_type,
    revenue_motion: classification.revenue_motion,
    target_organization: targetOrganization(signal),
    source_status: classification.source_status,
    source_deadline: classification.source_deadline,
    source_published_date: classification.source_published_date,
    time_sensitivity: classification.time_sensitivity,
    pursuit_difficulty: classification.pursuit_difficulty,
    actionability_score: classification.actionability_score,
    actionability_label: classification.actionability_label,
    show_in_report: classification.show_in_report,
    screening_path: classification.screening_path,
    screening_reason: classification.screening_reason,
    next_best_action: classification.next_best_action,
    contact_strategy: classification.contact_strategy,
    recommended_contact_roles: classification.recommended_contact_roles,
    source_native_contact_available: classification.source_native_contact_available,
    manual_research_instruction: classification.manual_research_instruction,
    workflow_payload_ready: classification.workflow_payload_ready,
    workflow_payload_reason: classification.workflow_payload_reason,
    crm_note: classification.crm_note,
    outreach_angle: classification.outreach_angle,
    follow_up_task: classification.follow_up_task
  };
}

export function opportunityActionFor(
  signal: OpportunitySignal | StoredOpportunitySignal,
  profile?: CompanyProfile | null
): NormalizedOpportunityAction {
  if (hasNormalizedAction(signal.normalized_action)) {
    return signal.normalized_action;
  }

  return normalizeOpportunityAction(signal, profile);
}

export function withNormalizedOpportunityAction(
  signal: OpportunitySignal,
  profile?: CompanyProfile | null
): OpportunitySignal {
  const normalizedAction = normalizeOpportunityAction(signal, profile);
  return {
    ...signal,
    normalized_action: normalizedAction,
    ...normalizedAction
  };
}
