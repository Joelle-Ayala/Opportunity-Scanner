export const PURSUIT_STAGES = [
  "researching",
  "qualifying",
  "preparing",
  "submitted",
  "won",
  "lost",
  "monitoring"
] as const;

export const PURSUIT_APPLICATION_METHODS = [
  "direct_application",
  "procurement_response",
  "vendor_registration",
  "buyer_outreach",
  "partner_outreach",
  "monitor"
] as const;

export type PursuitStage = (typeof PURSUIT_STAGES)[number];
export type PursuitApplicationMethod = (typeof PURSUIT_APPLICATION_METHODS)[number];
export type PursuitFitDecision = "not_reviewed" | "pursue" | "monitor" | "not_fit";

export type CustomerOpportunityPursuit = {
  id: string;
  customer_account_id: string;
  scan_id: string;
  opportunity_id: string;
  company_context_key: string;
  canonical_opportunity_key: string;
  opportunity_title: string;
  company_name: string;
  source_name: string;
  source_url: string;
  target_organization: string;
  revenue_motion: string;
  application_method: PursuitApplicationMethod;
  stage: PursuitStage;
  owner_name: string;
  source_verified: boolean;
  fit_decision: PursuitFitDecision;
  route_verified: boolean;
  deadline: string | null;
  next_step: string;
  eligibility_notes: string;
  registration_requirements: string;
  required_documents: string[];
  notes: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type PursuitEditableFields = Pick<
  CustomerOpportunityPursuit,
  | "stage"
  | "owner_name"
  | "source_verified"
  | "fit_decision"
  | "route_verified"
  | "deadline"
  | "next_step"
  | "eligibility_notes"
  | "registration_requirements"
  | "required_documents"
  | "notes"
>;

export function pursuitMethodLabel(method: PursuitApplicationMethod): string {
  const labels: Record<PursuitApplicationMethod, string> = {
    direct_application: "Direct application",
    procurement_response: "Procurement notice",
    vendor_registration: "Vendor registration",
    buyer_outreach: "Buyer outreach",
    partner_outreach: "Partner outreach",
    monitor: "Monitor and qualify"
  };
  return labels[method];
}

export function pursuitStageLabel(stage: PursuitStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function sourceActionLabel(method: PursuitApplicationMethod): string {
  if (method === "direct_application") return "Review official instructions";
  if (method === "procurement_response") return "Review procurement notice";
  if (method === "vendor_registration") return "Review procurement source";
  return "Review official source";
}

export function isPursuitStage(value: unknown): value is PursuitStage {
  return typeof value === "string" && PURSUIT_STAGES.includes(value as PursuitStage);
}

export function isPursuitFitDecision(value: unknown): value is PursuitFitDecision {
  return typeof value === "string" && ["not_reviewed", "pursue", "monitor", "not_fit"].includes(value);
}
