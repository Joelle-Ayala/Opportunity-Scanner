import type { OrganizationTargetResolution } from "./organizationResolution";

export type CustomerType =
  | "B2B"
  | "B2C"
  | "Government"
  | "Healthcare"
  | "Education"
  | "Nonprofit"
  | "Other";

export type ReportType = "quick" | "deep";
export type ReportAccess = "free" | "unlocked" | "admin";

export type PlaybookSourceCategory = {
  name: string;
  status: "active" | "planned";
};

export type SelectedPlaybook = {
  playbook_id: string;
  name: string;
  match_score: number;
  matched_terms: string[];
  source_categories_to_activate: string[];
  planned_source_categories: string[];
  likely_revenue_motions: string[];
  suggested_contact_roles: string[];
  report_guidance: string;
};

export type ScanInput = {
  companyUrl: string;
  companyName?: string;
  headquartersState?: string;
  targetStates?: string;
  industry?: string;
  customerType?: CustomerType;
  email?: string;
  reportType: ReportType;
  opportunityFocus?: string;
  includeTerms?: string;
  excludeTerms?: string;
  prioritySignals?: string[];
};

export type ScanRecord = {
  id: string;
  company_url: string;
  company_name?: string | null;
  headquarters_state?: string | null;
  target_states?: string | null;
  industry?: string | null;
  customer_type?: string | null;
  email?: string | null;
  status: "queued" | "scraping" | "profiling" | "discovering" | "completed" | "failed";
  report_type: ReportType;
  report_access?: ReportAccess | null;
  opportunity_focus?: string | null;
  include_terms?: string | null;
  exclude_terms?: string | null;
  priority_signals?: string[] | null;
  selected_playbooks?: SelectedPlaybook[] | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
};

export type ScrapedPage = {
  url: string;
  title: string;
  text: string;
};

export type CompanyProfile = {
  company_name: string;
  website: string;
  summary: string;
  products_services: string[];
  inferred_products_services?: string[];
  target_customers: string[];
  inferred_target_customers?: string[];
  industries: string[];
  geographies: string[];
  keywords: string[];
  inferred_public_sector_lanes?: string[];
  inferred_buyer_partner_types?: string[];
  inferred_revenue_motions?: string[];
  public_sector_search_terms: string[];
  translated_public_sector_terms: string[];
  include_terms?: string[];
  exclude_terms?: string[];
  target_geographies?: string[];
  priority_signals?: string[];
  good_fit_examples?: string[];
  bad_fit_examples?: string[];
  confirmed_opportunity_lanes?: string[];
  rejected_opportunity_lanes?: string[];
  profile_confidence_score?: number;
  profile_assumptions_summary?: string;
  negative_keywords: string[];
  possible_naics: string[];
  possible_psc: string[];
  possible_soc: string[];
  policy_sensitive_categories: string[];
  opportunity_lanes: string[];
  lane_search_terms: Record<string, string[]>;
  opportunity_categories: string[];
  selected_playbooks: SelectedPlaybook[];
  activated_source_categories: string[];
  planned_source_categories: string[];
  likely_revenue_motions: string[];
  suggested_contact_roles: string[];
  report_guidance: string[];
};

export type CompanyProfileRecord = {
  id: string;
  scan_id: string;
  profile_json: CompanyProfile;
  raw_text: string;
  scraped_pages: ScrapedPage[];
  created_at: string;
};

export type NormalizedOpportunityAction = {
  estimated_opportunity_type:
    | "active_opportunity"
    | "historical_market_evidence"
    | "policy_signal"
    | "source_route"
    | "research_only";
  buyer_partner_type:
    | "agency"
    | "procurement_office"
    | "program_office"
    | "funded_buyer"
    | "award_recipient"
    | "prime_vendor"
    | "distributor"
    | "grantee"
    | "channel_partner"
    | "policy_owner"
    | "research_target";
  revenue_motion: string;
  target_organization: string;
  source_status: string;
  source_deadline: string;
  source_published_date: string;
  time_sensitivity: "urgent" | "active" | "recent" | "evergreen" | "expired" | "monitor";
  pursuit_difficulty: "low" | "medium" | "high";
  actionability_score: number;
  actionability_label: "Strong" | "Medium" | "Research" | "Screened out";
  show_in_report: boolean;
  screening_path: string;
  screening_reason: string;
  next_best_action: string;
  contact_strategy:
    | "use_source_native_contact"
    | "inspect_procurement_record"
    | "contact_procurement_office"
    | "contact_program_office"
    | "contact_grants_manager"
    | "contact_award_recipient"
    | "research_prime_or_vendor"
    | "identify_distributor"
    | "enrich_company_domain"
    | "monitor_source"
    | "create_manual_research_task";
  recommended_contact_roles: string[];
  source_native_contact_available: boolean;
  manual_research_instruction: string;
  workflow_payload_ready: boolean;
  workflow_payload_reason: string;
  crm_note: string;
  outreach_angle: string;
  follow_up_task: string;
};

export type OpportunitySignal = {
  opportunity_title: string;
  source_type:
    | "active_grant"
    | "active_contract"
    | "historical_award"
    | "funded_buyer"
    | "policy_signal"
    | "procurement_category"
    | "reimbursement_signal"
    | "tax_incentive"
    | "workforce_funding";
  source_name: string;
  source_url: string;
  agency_or_funder: string;
  deadline: string;
  geography: string;
  external_evidence_summary: string;
  why_it_matters: string;
  who_benefits: string;
  likely_buyer_or_partner: string;
  revenue_pathway:
    | "direct_apply"
    | "sell_to_grantee"
    | "sell_to_agency"
    | "partner_with_recipient"
    | "monitor_policy"
    | "build_channel_campaign"
    | "procurement_bid"
    | "reimbursement_strategy";
  relevance_score: number;
  novelty_score: number;
  confidence_score: number;
  reasoning: string[];
  recommended_action: string;
  actionability: "yes" | "maybe" | "unlikely";
  actionability_reason: string;
  best_next_step: string;
  human_review_required: boolean;
  query_used: string;
  raw_json: Record<string, unknown>;
  normalized_action?: NormalizedOpportunityAction;
  target_resolution?: OrganizationTargetResolution;
  estimated_opportunity_type?: NormalizedOpportunityAction["estimated_opportunity_type"];
  buyer_partner_type?: NormalizedOpportunityAction["buyer_partner_type"];
  revenue_motion?: string;
  target_organization?: string;
  source_status?: string;
  source_deadline?: string;
  source_published_date?: string;
  time_sensitivity?: NormalizedOpportunityAction["time_sensitivity"];
  pursuit_difficulty?: NormalizedOpportunityAction["pursuit_difficulty"];
  actionability_score?: number;
  actionability_label?: NormalizedOpportunityAction["actionability_label"];
  show_in_report?: boolean;
  screening_path?: string;
  screening_reason?: string;
  next_best_action?: string;
  contact_strategy?: NormalizedOpportunityAction["contact_strategy"];
  recommended_contact_roles?: string[];
  source_native_contact_available?: boolean;
  manual_research_instruction?: string;
  workflow_payload_ready?: boolean;
  workflow_payload_reason?: string;
  crm_note?: string;
  outreach_angle?: string;
  follow_up_task?: string;
};

export type SourceResultRecord = {
  id: string;
  scan_id: string;
  source_name: string;
  source_type: string;
  query_used?: string | null;
  title?: string | null;
  url?: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
};

export type OpportunityRecord = {
  id: string;
  source: string;
  source_id?: string | null;
  title: string;
  url?: string | null;
  agency?: string | null;
  category?: string | null;
  deadline?: string | null;
  geography?: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
};

export type ScanOpportunityRecord = {
  id: string;
  scan_id: string;
  opportunity_id: string;
  relevance_score: number;
  novelty_score: number;
  confidence_score: number;
  reasoning_json: string[];
  recommended_action?: string | null;
  human_review_required: boolean;
  hidden?: boolean;
  created_at: string;
};

export type StoredOpportunitySignal = OpportunitySignal & {
  id: string;
  created_at: string;
};

export type ReportFeedbackKind = "more_like_this" | "less_like_this";

export type ReportFeedbackRecord = {
  id: string;
  scan_id: string;
  opportunity_id?: string | null;
  feedback_kind: ReportFeedbackKind;
  reason?: string | null;
  created_at: string;
};

export type ProfileFeedbackKind =
  | "confirm_profile"
  | "refine_profile"
  | "add_focus"
  | "exclude_lane"
  | "include_term"
  | "exclude_term"
  | "more_like_this"
  | "less_like_this"
  | "change_target_geography"
  | "change_priority_signal";

export type ProfileFeedbackRecord = {
  id: string;
  scan_id: string;
  company_profile_id?: string | null;
  company_url?: string | null;
  opportunity_id?: string | null;
  feedback_kind: ProfileFeedbackKind;
  value?: string | null;
  reason?: string | null;
  feedback_json: Record<string, unknown>;
  created_at: string;
};

export type OpportunityEnrichmentType =
  | "find_contacts"
  | "find_similar_awards"
  | "search_active_bids"
  | "search_grants"
  | "find_buyer_website"
  | "generate_outreach";

export type OpportunityEnrichmentRequestRecord = {
  id: string;
  scan_id: string;
  opportunity_id: string;
  enrichment_type: OpportunityEnrichmentType;
  status: "requested" | "completed" | "failed";
  result_json: Record<string, unknown>;
  created_at: string;
};

export type LeadMagnetCaptureRecord = {
  id: string;
  lead_magnet_slug: string;
  name: string;
  email: string;
  company?: string | null;
  website?: string | null;
  source?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  marketing_consent: boolean;
  consented_at: string | null;
  created_at: string;
};
