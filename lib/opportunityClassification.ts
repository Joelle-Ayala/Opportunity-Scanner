import { assessActionability, signalDate, signalLane } from "./actionability";
import { contactTargetsForSignal } from "./contactTargeting";
import { CompanyProfile, StoredOpportunitySignal } from "./types";

export type EstimatedOpportunityType =
  | "active_opportunity"
  | "historical_market_evidence"
  | "policy_signal"
  | "source_route"
  | "research_only";

export type BuyerPartnerType =
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

export type ContactStrategy =
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

export type TimeSensitivity = "urgent" | "active" | "recent" | "evergreen" | "expired" | "monitor";
export type PursuitDifficulty = "low" | "medium" | "high";

export type OpportunityClassification = {
  estimated_opportunity_type: EstimatedOpportunityType;
  buyer_partner_type: BuyerPartnerType;
  revenue_motion: string;
  source_status: string;
  source_deadline: string;
  source_published_date: string;
  time_sensitivity: TimeSensitivity;
  pursuit_difficulty: PursuitDifficulty;
  actionability_score: number;
  actionability_label: "Strong" | "Medium" | "Research" | "Screened out";
  show_in_report: boolean;
  screening_path: string;
  screening_reason: string;
  next_best_action: string;
  contact_strategy: ContactStrategy;
  recommended_contact_roles: string[];
  source_native_contact_available: boolean;
  manual_research_instruction: string;
  workflow_payload_ready: boolean;
  workflow_payload_reason: string;
  crm_note: string;
  outreach_angle: string;
  follow_up_task: string;
};

const CURRENT_SCAN_DATE = new Date().toISOString().slice(0, 10);

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function comparableDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const usMatch = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function sourceDeadline(signal: StoredOpportunitySignal): string {
  return (
    comparableDate(signal.deadline) ||
    comparableDate(signal.raw_json?.["End Date"]) ||
    comparableDate(signal.raw_json?.["Close Date"]) ||
    comparableDate(signal.raw_json?.["Current End Date"]) ||
    comparableDate(signal.raw_json?.search_hit && (signal.raw_json.search_hit as Record<string, unknown>).closeDate)
  );
}

function sourcePublishedDate(signal: StoredOpportunitySignal): string {
  return (
    comparableDate(signal.raw_json?.["Start Date"]) ||
    comparableDate(signal.raw_json?.["Award Date"]) ||
    comparableDate(signal.raw_json?.search_hit && (signal.raw_json.search_hit as Record<string, unknown>).openDate) ||
    comparableDate(
      signal.raw_json?.detail &&
        ((signal.raw_json.detail as Record<string, unknown>).synopsis as Record<string, unknown> | undefined)
          ?.postingDate
    )
  );
}

function daysUntil(date: string): number | null {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const current = new Date(`${CURRENT_SCAN_DATE}T00:00:00Z`).getTime();
  if (Number.isNaN(target) || Number.isNaN(current)) return null;
  return Math.round((target - current) / (1000 * 60 * 60 * 24));
}

function evidenceText(signal: StoredOpportunitySignal): string {
  return [
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signal.revenue_pathway,
    signal.source_name,
    signal.source_type,
    signalLane(signal)
  ]
    .join(" ")
    .toLowerCase();
}

function playbookIds(profile?: CompanyProfile | null): string[] {
  return profile?.selected_playbooks?.map((playbook) => playbook.playbook_id) ?? [];
}

function profileRejectsSignal(signal: StoredOpportunitySignal, profile?: CompanyProfile | null): boolean {
  if (!profile) return false;
  const lane = signalLane(signal).toLowerCase();
  const rejectedLanes = (profile.rejected_opportunity_lanes ?? []).map((item) => item.toLowerCase().trim());
  if (rejectedLanes.some((rejected) => rejected && lane === rejected)) return true;

  const text = evidenceText(signal);
  return [...(profile.exclude_terms ?? []), ...(profile.negative_keywords ?? [])]
    .map((term) => term.toLowerCase().trim())
    .filter((term) => term.length >= 3)
    .some((term) => text.includes(term));
}

function profileConfirmsSignal(signal: StoredOpportunitySignal, profile?: CompanyProfile | null): boolean {
  if (!profile) return false;
  const lane = signalLane(signal).toLowerCase();
  return (profile.confirmed_opportunity_lanes ?? []).some((confirmed) => confirmed.toLowerCase().trim() === lane);
}

function isCreativeOnlyProfile(profile?: CompanyProfile | null): boolean {
  const ids = playbookIds(profile);
  return ids.includes("music_arts_creative_economy") && !ids.includes("education_workforce_training");
}

function isEducationWorkforceProfile(profile?: CompanyProfile | null): boolean {
  if (!profile) return false;
  const ids = playbookIds(profile);
  if (ids.includes("education_workforce_training")) return true;

  const text = [
    profile.company_name,
    profile.summary,
    ...(profile.industries ?? []),
    ...(profile.keywords ?? []),
    ...(profile.public_sector_search_terms ?? []),
    ...(profile.opportunity_lanes ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return /schoolgig|teacher|teachers|educator|educators|substitute|teacher shortage|teacher recruitment|school staffing|school district hiring|hiring platform|recruiting|recruitment|job board|talent acquisition|applicant tracking/.test(
    text
  );
}

function estimateOpportunityType(signal: StoredOpportunitySignal, deadline: string): EstimatedOpportunityType {
  const text = evidenceText(signal);
  if (signal.source_name === "State/local portal routing" || /source route to check|portal route/.test(text)) {
    return "source_route";
  }
  if (signal.source_type === "policy_signal" || signal.revenue_pathway === "monitor_policy") {
    return "policy_signal";
  }
  if (deadline && deadline < CURRENT_SCAN_DATE) {
    return "research_only";
  }
  if (signal.source_type === "active_grant" || signal.source_type === "active_contract") {
    return "active_opportunity";
  }
  if (signal.source_type === "historical_award" || signal.source_type === "funded_buyer") {
    return "historical_market_evidence";
  }
  if (signal.source_type === "procurement_category" || signal.revenue_pathway === "procurement_bid") {
    return "active_opportunity";
  }
  return "research_only";
}

function buyerPartnerType(signal: StoredOpportunitySignal, type: EstimatedOpportunityType): BuyerPartnerType {
  const text = evidenceText(signal);
  if (type === "policy_signal") return "policy_owner";
  if (signal.revenue_pathway === "direct_apply") return "program_office";
  if (signal.revenue_pathway === "procurement_bid") return "procurement_office";
  if (signal.revenue_pathway === "sell_to_agency") return "agency";
  if (signal.revenue_pathway === "sell_to_grantee") return "grantee";
  if (signal.revenue_pathway === "partner_with_recipient") return "award_recipient";
  if (/prime|contractor/.test(text)) return "prime_vendor";
  if (/distributor|channel/.test(text)) return "distributor";
  if (type === "historical_market_evidence") return "award_recipient";
  if (type === "active_opportunity") return "program_office";
  return "research_target";
}

function sourceStatus(type: EstimatedOpportunityType, deadline: string): string {
  if (type === "source_route") return "Source route";
  if (type === "policy_signal") return "Policy signal";
  if (deadline && deadline < CURRENT_SCAN_DATE) return `Ended ${deadline}`;
  if (type === "active_opportunity" && deadline) return `Open through ${deadline}`;
  if (type === "historical_market_evidence" && deadline) return `Current funded evidence through ${deadline}`;
  if (type === "historical_market_evidence") return "Market evidence";
  return "Needs review";
}

function timeSensitivity(type: EstimatedOpportunityType, deadline: string): TimeSensitivity {
  if (type === "policy_signal") return "monitor";
  if (!deadline) return type === "historical_market_evidence" ? "evergreen" : "monitor";
  const days = daysUntil(deadline);
  if (days === null) return "monitor";
  if (days < 0) return "expired";
  if (days <= 30) return "urgent";
  if (days <= 365) return "active";
  return "evergreen";
}

function sourceNativeContactAvailable(signal: StoredOpportunitySignal): boolean {
  const contacts = signal.raw_json?.pointOfContact;
  if (!Array.isArray(contacts)) return false;
  return contacts.some((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return Boolean(record.email || record.fullName || record.fullname || record.phone || record.title);
  });
}

function contactStrategyFor(input: {
  signal: StoredOpportunitySignal;
  type: EstimatedOpportunityType;
  buyerType: BuyerPartnerType;
  hasSourceContact: boolean;
}): ContactStrategy {
  const { signal, type, buyerType, hasSourceContact } = input;
  const text = evidenceText(signal);

  if (hasSourceContact) return "use_source_native_contact";
  if (type === "policy_signal") return "monitor_source";
  if (type === "source_route" || type === "research_only") return "create_manual_research_task";
  if (signal.source_type === "active_contract" || signal.revenue_pathway === "procurement_bid") {
    return "inspect_procurement_record";
  }
  if (signal.source_type === "active_grant" || signal.revenue_pathway === "direct_apply") {
    return "contact_grants_manager";
  }
  if (buyerType === "agency" || buyerType === "procurement_office") return "contact_procurement_office";
  if (buyerType === "program_office") return "contact_program_office";
  if (buyerType === "award_recipient" || buyerType === "grantee" || buyerType === "funded_buyer") {
    return /llc|inc|corp|company|technologies|systems|solutions/.test(text)
      ? "enrich_company_domain"
      : "contact_award_recipient";
  }
  if (buyerType === "prime_vendor") return "research_prime_or_vendor";
  if (buyerType === "distributor" || buyerType === "channel_partner") return "identify_distributor";
  return "create_manual_research_task";
}

function pursuitDifficulty(type: EstimatedOpportunityType, strategy: ContactStrategy, hasSourceContact: boolean): PursuitDifficulty {
  if (type === "policy_signal" || type === "source_route" || type === "research_only") return "high";
  if (hasSourceContact || strategy === "inspect_procurement_record" || strategy === "use_source_native_contact") return "low";
  if (strategy === "contact_award_recipient" || strategy === "enrich_company_domain") return "medium";
  return "medium";
}

function contactStrategyLabel(strategy: ContactStrategy): string {
  const labels: Record<ContactStrategy, string> = {
    use_source_native_contact: "Use source-native contact",
    inspect_procurement_record: "Inspect procurement record",
    contact_procurement_office: "Contact procurement office",
    contact_program_office: "Contact program office",
    contact_grants_manager: "Contact grants/program manager",
    contact_award_recipient: "Contact award recipient",
    research_prime_or_vendor: "Research prime or awarded vendor",
    identify_distributor: "Identify distributor/channel owner",
    enrich_company_domain: "Enrich company domain",
    monitor_source: "Monitor source",
    create_manual_research_task: "Create manual research task"
  };
  return labels[strategy];
}

function nextBestAction(input: {
  signal: StoredOpportunitySignal;
  type: EstimatedOpportunityType;
  buyerType: BuyerPartnerType;
  strategy: ContactStrategy;
  roles: string[];
  target: string;
}): string {
  const { signal, type, strategy, roles, target } = input;
  const lane = signalLane(signal).toLowerCase();
  const roleText = roles.slice(0, 3).join(", ") || "program owner or procurement contact";

  if (strategy === "inspect_procurement_record") {
    return `Review the source record, confirm eligibility/vendor steps, then route to the procurement owner at ${target}.`;
  }
  if (strategy === "use_source_native_contact") {
    return `Use the source-listed contact first, then validate the buyer or program owner for ${target}.`;
  }
  if (strategy === "contact_grants_manager") {
    return `Use the grant contact for eligibility/program questions, then identify likely applicants or recipients for sales outreach.`;
  }
  if (strategy === "monitor_source") {
    return "Monitor the policy/source for a funding, procurement, or program-office action before creating outreach.";
  }
  if (type === "research_only" || type === "source_route") {
    return "Create a research task to verify a current buyer, source record, or vendor path before outreach.";
  }
  if (/prop 28|arts education|teaching artist|school arts|enrichment/.test(lane)) {
    return `Research ${target}, then route outreach to the ${roleText} with a school arts staffing or enrichment angle.`;
  }
  if (/teacher|educator|school|recruiting|workforce/.test(lane)) {
    return `Research ${target}, then route outreach to the ${roleText} with an educator workforce or hiring support angle.`;
  }
  if (/live performance|concert|event|tourism|placemaking|arts/.test(lane)) {
    return `Find the ${roleText} at ${target} and lead with the relevant programming, event, or partnership fit.`;
  }
  return `Research ${target}, confirm the owner, and create a follow-up task for ${contactStrategyLabel(strategy).toLowerCase()}.`;
}

function manualResearchInstruction(signal: StoredOpportunitySignal, strategy: ContactStrategy, target: string): string {
  if (strategy === "inspect_procurement_record") {
    return `Open the source record, look for solicitation status, vendor registration steps, eligibility, due date, and contracting officer.`;
  }
  if (strategy === "contact_award_recipient" || strategy === "enrich_company_domain") {
    return `Find ${target}'s website and identify the program, partnerships, procurement, HR, or grants owner tied to this award.`;
  }
  if (strategy === "contact_grants_manager") {
    return `Inspect the grant details, source-native contact, eligible applicants, and likely future recipients before outreach.`;
  }
  if (strategy === "monitor_source") {
    return `Track this source for a concrete grant, procurement, or program update before outreach.`;
  }
  return `Verify the source, target organization, decision owner, and current timing before outreach.`;
}

function workflowReady(type: EstimatedOpportunityType, strategy: ContactStrategy, actionability: ReturnType<typeof assessActionability>): {
  ready: boolean;
  reason: string;
} {
  if (actionability.actionability === "unlikely") {
    return { ready: false, reason: "Screened out by actionability rules." };
  }
  if (type === "policy_signal" || type === "source_route" || type === "research_only") {
    return { ready: false, reason: "Needs research before becoming a CRM/workflow opportunity." };
  }
  if (strategy === "monitor_source" || strategy === "create_manual_research_task") {
    return { ready: false, reason: "Manual research is the right next action." };
  }
  return { ready: true, reason: "Ready to become a CRM, Airtable, Slack, or research workflow item." };
}

function actionabilityScore(signal: StoredOpportunitySignal, type: EstimatedOpportunityType, time: TimeSensitivity): number {
  const base = Math.round((signal.relevance_score + signal.confidence_score + signal.novelty_score) / 3);
  let adjustment = 0;
  if (type === "active_opportunity") adjustment += 10;
  if (type === "historical_market_evidence") adjustment += 2;
  if (type === "policy_signal" || type === "source_route" || type === "research_only") adjustment -= 18;
  if (time === "urgent") adjustment += 8;
  if (time === "active") adjustment += 5;
  if (time === "expired") adjustment -= 35;
  return Math.max(0, Math.min(100, base + adjustment));
}

function actionabilityLabel(score: number, show: boolean): OpportunityClassification["actionability_label"] {
  if (!show) return "Screened out";
  if (score >= 78) return "Strong";
  if (score >= 62) return "Medium";
  return "Research";
}

function creativeOnlyScreen(signal: StoredOpportunitySignal, profile?: CompanyProfile | null): {
  show: boolean;
  path: string;
  reason: string;
} | null {
  if (!isCreativeOnlyProfile(profile)) return null;
  const text = evidenceText(signal);
  const deadline = sourceDeadline(signal);
  const liveMusicFit =
    /live music|music performance|musical performance|musician services|performer services|performing artist|artist booking|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services|tourism|placemaking|parks recreation|parks and recreation|public event|cultural programming|downtown activation/.test(
      text
    );
  const clearBuyerFit =
    /city of|county|department of parks|parks recreation|parks and recreation|tourism|downtown|business improvement district|bid programming|public plaza|public space|open streets|night market|neighborhood festival|public venue|cultural affairs|arts commission|symphony|booking|events/.test(
      text
    );
  const tooIndirect =
    /creative workforce|arts workforce|school and district arts programming|arts education|music education|legal services|heritage center|creative tech exchange|talent program|grants for arts projects|policy signal|federal register/.test(
      text
    );

  if (deadline && deadline < CURRENT_SCAN_DATE) {
    return { show: false, path: "Expired or ended", reason: `This record ended on ${deadline}.` };
  }
  if (/undisclosed|domestic unknown|foreign|miscellaneous foreign/.test(text)) {
    return { show: false, path: "Unclear buyer", reason: "The buyer or funded organization is not clear enough." };
  }
  if (!liveMusicFit) {
    return {
      show: false,
      path: "Not a live-music revenue fit",
      reason: "The source does not clearly point to live music, performance, public events, tourism, or event programming."
    };
  }
  if (tooIndirect) {
    return {
      show: false,
      path: "Too indirect",
      reason: "The signal is adjacent to the arts economy, but the immediate live-music sales path is not clear enough."
    };
  }
  if (signal.source_name === "Grants.gov" && signal.revenue_pathway !== "direct_apply") {
    return {
      show: false,
      path: "Grant context, not a buyer lead",
      reason: "The grant may fund the market, but this row does not yet identify who to sell to."
    };
  }
  if (signal.source_type === "historical_award" && !clearBuyerFit) {
    return {
      show: false,
      path: "Buyer path unclear",
      reason: "This award is current enough, but the source does not show a clear event owner or buyer path."
    };
  }
  return {
    show: true,
    path: clearBuyerFit ? "Clear revenue path" : "Revenue path needs validation",
    reason: clearBuyerFit
      ? "Current source evidence points to a buyer, funded recipient, or vendor path for live music or public event programming."
      : "The signal is current and relevant, but outreach ownership should be validated before acting."
  };
}

function educationWorkforceScreen(signal: StoredOpportunitySignal, profile?: CompanyProfile | null): {
  show: boolean;
  path: string;
  reason: string;
} | null {
  if (!isEducationWorkforceProfile(profile)) return null;
  const text = evidenceText(signal);
  const deadline = sourceDeadline(signal);
  const staffingOrHrPath =
    /teacher|teachers|educator|educators|principal|principals|substitute teacher|teacher shortage|teacher recruitment|teacher residency|school staffing|educator workforce|school workforce|district workforce|school district recruiting|district recruiting|school hr|district hr|human resources|applicant tracking|job board|talent acquisition|recruiting platform|hiring platform|workforce hiring/.test(
      text
    );
  const schoolArtsStaffingPath =
    /prop 28|proposition 28|teaching artist|teaching artists|artist educator|artist educators|school arts|arts education staffing|arts enrichment|expanded learning|vapa|visual and performing arts/.test(
      text
    );
  const districtVendorPath =
    /school district|local educational agency|\blea\b|district procurement|district vendor|district contract|department of education procurement|education procurement/.test(
      text
    ) &&
    /staffing|recruiting|hiring|teacher|educator|human resources|hr|applicant tracking|job board|vendor|procurement|arts enrichment|teaching artist|school arts/.test(
      text
    );
  const broadArtsOrCulture =
    /cultural programming|live events|public arts|music education|gospel music|carnegie hall|concert|festival|tourism|placemaking|creative workforce|arts workforce/.test(
      text
    );
  const broadLiteracyOrInstruction =
    /literacy|reading|writing|dyslexia|students with disabilities|developmental delay|quality of instruction|achievement gaps|comprehensive center/.test(
      text
    );

  if (deadline && deadline < CURRENT_SCAN_DATE) {
    return { show: false, path: "Expired or ended", reason: `This record ended on ${deadline}.` };
  }

  if (staffingOrHrPath || schoolArtsStaffingPath || districtVendorPath) {
    return {
      show: true,
      path: "Clear education workforce path",
      reason:
        "The source points to school staffing, educator workforce, district HR/recruiting, school arts staffing, or a district/vendor path."
    };
  }

  if (broadArtsOrCulture) {
    return {
      show: false,
      path: "Broad arts/culture fit only",
      reason:
        "This is arts, culture, music, or public-event evidence, but it does not show a SchoolGig staffing, recruiting, school HR, district, or school arts staffing path."
    };
  }

  if (broadLiteracyOrInstruction) {
    return {
      show: false,
      path: "Education program fit only",
      reason:
        "This education signal is about literacy, instruction, or student services without a clear staffing, recruiting, school HR, or district vendor action."
    };
  }

  return {
    show: false,
    path: "No clear education workforce path",
    reason:
      "The source does not clearly connect to education staffing, school arts staffing, district HR, recruiting, teacher/educator workforce, or a district vendor path."
  };
}

export function classifyOpportunity(
  signal: StoredOpportunitySignal,
  profile?: CompanyProfile | null
): OpportunityClassification {
  const actionability = assessActionability(signal);
  const deadline = sourceDeadline(signal);
  const publishedDate = sourcePublishedDate(signal);
  const type = estimateOpportunityType(signal, deadline);
  const buyerType = buyerPartnerType(signal, type);
  const time = timeSensitivity(type, deadline);
  const hasSourceContact = sourceNativeContactAvailable(signal);
  const strategy = contactStrategyFor({ signal, type, buyerType, hasSourceContact });
  const contactTargets = contactTargetsForSignal(signal);
  const roles = unique(contactTargets.flatMap((target) => target.roles));
  const target = signal.likely_buyer_or_partner || signal.agency_or_funder || "the target organization";
  const workflow = workflowReady(type, strategy, actionability);
  const score = Math.min(100, actionabilityScore(signal, type, time) + (profileConfirmsSignal(signal, profile) ? 8 : 0));
  const educationScreen = educationWorkforceScreen(signal, profile);
  const creativeScreen = creativeOnlyScreen(signal, profile);
  const genericShow = actionability.actionability !== "unlikely" && time !== "expired" && type !== "source_route";
  const rejectedByProfile = profileRejectsSignal(signal, profile);
  const show = rejectedByProfile
    ? false
    : educationScreen
    ? educationScreen.show
    : creativeScreen
    ? creativeScreen.show
    : genericShow;
  const workflowStatus = show
    ? workflow
    : { ready: false, reason: "Screened out before workflow because the opportunity path is not clear enough." };
  const nextAction = nextBestAction({ signal, type, buyerType, strategy, roles, target });
  const manualInstruction = manualResearchInstruction(signal, strategy, target);
  const outreach = contactTargets[0]?.outreachAngle || "Lead with the source record and the relevant business fit.";
  const crmNote = `${signal.opportunity_title}. Type: ${type.replaceAll("_", " ")}. Target: ${target}. Next action: ${nextAction}`;

  return {
    estimated_opportunity_type: type,
    buyer_partner_type: buyerType,
    revenue_motion: signal.revenue_pathway,
    source_status: sourceStatus(type, deadline),
    source_deadline: deadline,
    source_published_date: publishedDate,
    time_sensitivity: time,
    pursuit_difficulty: pursuitDifficulty(type, strategy, hasSourceContact),
    actionability_score: score,
    actionability_label: actionabilityLabel(score, show),
    show_in_report: show,
    screening_path: rejectedByProfile
      ? "Rejected by profile feedback"
      : educationScreen?.path || creativeScreen?.path || (show ? "Move forward" : "Screened out"),
    screening_reason: rejectedByProfile
      ? "This signal matches profile feedback that the user asked to exclude."
      : educationScreen?.reason || creativeScreen?.reason || (show ? actionability.reason : actionability.reason),
    next_best_action: nextAction,
    contact_strategy: strategy,
    recommended_contact_roles: roles,
    source_native_contact_available: hasSourceContact,
    manual_research_instruction: manualInstruction,
    workflow_payload_ready: workflowStatus.ready,
    workflow_payload_reason: workflowStatus.reason,
    crm_note: crmNote,
    outreach_angle: outreach,
    follow_up_task: `${contactStrategyLabel(strategy)}: ${nextAction}`
  };
}

export function classificationLabel(value: string): string {
  return value.replaceAll("_", " ");
}
