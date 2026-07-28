import { signalLane } from "./actionability";
import { opportunityActionFor } from "./opportunityAction";
import { classificationLabel } from "./opportunityClassification";
import type { CompanyProfile, StoredOpportunitySignal } from "./types";
import { classifyOpportunityRecord } from "./opportunityRecordClassification";

export type WorkflowPayload = {
  scanId: string;
  opportunityId: string;
  opportunity: string;
  targetOrganization: string;
  targetAccount?: string;
  source: string;
  signalType: string;
  recordClass: "current" | "evidence";
  currentValidatedAt?: string;
  awardYear?: number;
  periodEnd?: string;
  opportunityType?: string;
  buyerPartnerType?: string;
  revenueMotion: string;
  actionability: string;
  actionabilityScore?: number;
  contactPath: string;
  contactStrategy?: string;
  recommendedContactRoles?: string[];
  nextStep: string;
  nextBestAction?: string;
  manualResearchInstruction?: string;
  crmNote: string;
  outreachAngle: string;
  followUpTask?: string;
  timeSensitivity?: string;
  pursuitDifficulty?: string;
  workflowPayloadReady?: boolean;
  workflowPayloadReason?: string;
  sourceStatus?: string;
  sourceDeadline?: string;
  sourceEvidence?: string;
  sourceUrl?: string;
};

export function opportunityHeadline(signal: StoredOpportunitySignal): string {
  const match = signal.opportunity_title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (match) {
    const [, recipient, amount] = match;
    return `${signalLane(signal)}: ${recipient} funded ${amount}`;
  }
  return signal.opportunity_title;
}

export function revenueMotionLabel(signal: StoredOpportunitySignal): string {
  const labels: Record<StoredOpportunitySignal["revenue_pathway"], string> = {
    direct_apply: "Direct Apply",
    sell_to_grantee: "Sell to Funded Buyer",
    sell_to_agency: "Sell to Agency",
    partner_with_recipient: "Partner with Recipient",
    monitor_policy: "Monitor Policy",
    build_channel_campaign: "Channel / Distributor Motion",
    procurement_bid: "Sell to Agency",
    reimbursement_strategy: "Research Only"
  };
  return labels[signal.revenue_pathway] ?? "Research Only";
}

export function sourceTypeLabel(signal: StoredOpportunitySignal): string {
  const labels: Record<StoredOpportunitySignal["source_type"], string> = {
    active_grant: "Active funding",
    active_contract: "Active procurement",
    historical_award: "Historical market evidence",
    funded_buyer: "Funded buyer",
    policy_signal: "Policy signal",
    procurement_category: "Procurement signal",
    reimbursement_signal: "Reimbursement signal",
    tax_incentive: "Tax incentive",
    workforce_funding: "Workforce funding"
  };
  return labels[signal.source_type] ?? signal.source_type.replaceAll("_", " ");
}

export function buildWorkflowPayload({
  scanId,
  signal,
  profile,
  includeSourceUrl
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile;
  includeSourceUrl: boolean;
}): WorkflowPayload {
  const classification = opportunityActionFor(signal, profile);
  const record = classifyOpportunityRecord({
    recordClass: signal.record_class,
    currentValidatedAt: signal.current_validated_at,
    sourceName: signal.source_name,
    sourceType: signal.source_type,
    deadline: signal.deadline,
    awardYear: signal.award_year,
    periodEnd: signal.period_end
  });
  const target = signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review";
  const evidenceNextStep = `Research ${target} and verify the current procurement or partnership path before outreach.`;

  return {
    scanId,
    opportunityId: signal.id,
    opportunity: opportunityHeadline(signal),
    targetOrganization: target,
    targetAccount: target,
    source: signal.source_name,
    signalType: sourceTypeLabel(signal),
    recordClass: record.recordClass,
    currentValidatedAt:
      record.recordClass === "current" ? record.currentValidatedAt ?? undefined : undefined,
    awardYear: record.awardYear ?? undefined,
    periodEnd: record.periodEnd ?? undefined,
    opportunityType: classification.estimated_opportunity_type,
    buyerPartnerType: classification.buyer_partner_type,
    revenueMotion: revenueMotionLabel(signal),
    actionability: classification.actionability_label,
    actionabilityScore: classification.actionability_score,
    contactPath: classificationLabel(classification.contact_strategy),
    contactStrategy: classification.contact_strategy,
    recommendedContactRoles: classification.recommended_contact_roles,
    nextStep: record.recordClass === "current" ? classification.next_best_action : evidenceNextStep,
    nextBestAction: record.recordClass === "current" ? classification.next_best_action : evidenceNextStep,
    manualResearchInstruction: classification.manual_research_instruction,
    crmNote:
      record.recordClass === "current"
        ? classification.crm_note
        : `${target} received public funding${record.awardYear ? ` in ${record.awardYear}` : ""}. Use this as historical buyer-budget evidence and verify present needs before outreach.`,
    outreachAngle:
      record.recordClass === "current"
        ? classification.outreach_angle
        : `Reference the historical funded work as context and ask how ${target} is handling the same need now.`,
    followUpTask: classification.follow_up_task,
    timeSensitivity: record.recordClass === "current" ? classification.time_sensitivity : "historical",
    pursuitDifficulty: classification.pursuit_difficulty,
    workflowPayloadReady: classification.workflow_payload_ready,
    workflowPayloadReason: classification.workflow_payload_reason,
    sourceStatus: record.recordClass === "current" ? classification.source_status : "Funded-buyer evidence",
    sourceDeadline: record.recordClass === "current" ? record.deadline ?? undefined : undefined,
    sourceEvidence: signal.external_evidence_summary,
    sourceUrl: includeSourceUrl ? signal.source_url : undefined
  };
}
