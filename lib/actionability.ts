import type { StoredOpportunitySignal } from "./types";

const CURRENT_ACTION_DATE = new Date().toISOString().slice(0, 10);

export type ActionabilityAssessment = {
  actionability: "yes" | "maybe" | "unlikely";
  reason: string;
  bestNextStep: string;
};

function signalText(signal: StoredOpportunitySignal): string {
  return [
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signal.geography,
    signal.raw_json?.["Place of Performance State Code"],
    signal.raw_json?.["Place of Performance State"],
    signal.raw_json?.["Recipient State Code"]
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeLaneForEvidence(lane: string, signal: StoredOpportunitySignal): string {
  if (!lane.toLowerCase().includes("prop 28")) return lane;
  const text = signalText(signal);
  if (/\bprop(?:osition)?\s*28\b/.test(text)) return lane;

  return "Arts education and teaching artist staffing";
}

export function signalLane(signal: StoredOpportunitySignal): string {
  const laneReason = signal.reasoning.find((item) => item.startsWith("Inferred lane:"));
  const lane = laneReason?.replace("Inferred lane:", "").trim() || signal.revenue_pathway.replaceAll("_", " ");
  return normalizeLaneForEvidence(lane, signal);
}

export function signalDate(signal: StoredOpportunitySignal, field: "Start Date" | "End Date"): string {
  const value = signal.raw_json?.[field];
  return typeof value === "string" ? value : "";
}

function comparableDate(value: string): string {
  if (!value) return "";
  const isoMatch = value.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const usMatch = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function signalEvidence(signal: StoredOpportunitySignal): string {
  return [
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signalLane(signal)
  ]
    .join(" ")
    .toLowerCase();
}

export function directRevenueFitScore(signal: StoredOpportunitySignal): number {
  const lane = signalLane(signal).toLowerCase();
  const evidence = signalEvidence(signal);
  const endDate = signal.deadline || signalDate(signal, "End Date");
  let score = signal.relevance_score + signal.confidence_score + signal.novelty_score;

  if (endDate >= CURRENT_ACTION_DATE) score += 45;
  else if (endDate >= "2025-01-01") score += 18;
  else if (endDate) score -= 35;

  if (/live music|music performance|musical performance|musician services|performer services|performing artist|artist booking|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services/.test(evidence)) {
    score += 80;
  }

  if (/city of|county|department of parks|parks recreation|tourism|downtown|business improvement district|bid programming|partnership|alliance|conservancy|greenway|public plaza|public space|open streets|night market|neighborhood festival|public venue|cultural affairs|arts commission|school district|university|academy|military band/.test(evidence)) {
    score += 36;
  }

  if (/event entertainment|musician services|live music|public concerts|summer concert|public event production|public space activation|downtown activation|district event programming/.test(evidence)) {
    score += 25;
  }

  if (
    lane.includes("school and district arts programming") ||
    lane.includes("creative workforce") ||
    lane.includes("arts and culture grants")
  ) {
    score -= 18;
  }

  if (/visual arts|museum visit|graphic artist|workforce development|former incarcerated|case management|exhibition only/.test(evidence)) {
    score -= 45;
  }

  if (signal.source_type === "policy_signal") score -= 80;
  if (signal.revenue_pathway === "monitor_policy") score -= 60;

  return score;
}

export function sortByDirectRevenueFit(signals: StoredOpportunitySignal[]): StoredOpportunitySignal[] {
  return [...signals].sort((a, b) => directRevenueFitScore(b) - directRevenueFitScore(a));
}

export function isDirectRevenueReadySignal(signal: StoredOpportunitySignal): boolean {
  return directRevenueFitScore(signal) >= 330;
}

export function isRelevantPriorExample(signal: StoredOpportunitySignal): boolean {
  return false;
}

function isRelevantPriorExampleDisabled(signal: StoredOpportunitySignal): boolean {
  const lane = signalLane(signal).toLowerCase();
  const text = signalEvidence(signal);
  const endDate = signal.deadline || signalDate(signal, "End Date");
  const directCategory =
    lane.includes("medical and rehabilitation supply") ||
    lane.includes("prosthetics") ||
    lane.includes("orthotics") ||
    lane.includes("live performance") ||
    lane.includes("public concerts") ||
    lane.includes("arts and culture") ||
    lane.includes("arts programming") ||
    lane.includes("creative workforce") ||
    lane.includes("public event production") ||
    lane.includes("tourism") ||
    lane.includes("placemaking") ||
    lane.includes("state arts council") ||
    lane.includes("teacher staffing") ||
    lane.includes("educator workforce") ||
    lane.includes("education workforce") ||
    lane.includes("recruiting technology") ||
    text.includes("prosthetic") ||
    text.includes("orthotic") ||
    text.includes("rehabilitation supplies") ||
    text.includes("physical therapy supplies") ||
    text.includes("live music") ||
    text.includes("public concerts") ||
    text.includes("teaching artists") ||
    text.includes("arts education") ||
    text.includes("event entertainment") ||
    text.includes("teacher recruitment") ||
    text.includes("educator workforce") ||
    text.includes("applicant tracking");
  const indirectOrInfrastructure =
    lane.includes("infrastructure") ||
    signal.revenue_pathway === "monitor_policy" ||
    text.includes("software") ||
    text.includes("information technology") ||
    text.includes("case management") ||
    text.includes("public health infrastructure");

  return (
    !isMoveForwardSignal(signal) &&
    signal.source_type === "historical_award" &&
    directCategory &&
    !indirectOrInfrastructure &&
    Boolean(endDate) &&
    endDate >= "2022-01-01" &&
    endDate < CURRENT_ACTION_DATE
  );
}

function bestNextStepForLane(lane: string): string {
  if (
    lane.includes("arts education") ||
    lane.includes("teaching artist") ||
    lane.includes("school arts") ||
    lane.includes("enrichment")
  ) {
    return "Research the recipient and agency, then decide whether outreach should go to the VAPA lead, arts education program owner, expanded learning lead, district HR, or procurement contact.";
  }

  if (
    lane.includes("live performance") ||
    lane.includes("public concerts") ||
    lane.includes("arts") ||
    lane.includes("creative") ||
    lane.includes("tourism") ||
    lane.includes("placemaking") ||
    lane.includes("event production")
  ) {
    return "Validate whether outreach should go to the funded organization, cultural affairs office, events team, school arts program, or procurement contact.";
  }

  if (
    lane.includes("teacher") ||
    lane.includes("educator") ||
    lane.includes("school") ||
    lane.includes("recruiting") ||
    lane.includes("workforce")
  ) {
    return "Research the recipient and agency, then decide whether outreach should go to district HR, the funded program lead, procurement, or an implementation partner.";
  }

  if (
    lane.includes("medical") ||
    lane.includes("rehab") ||
    lane.includes("dme") ||
    lane.includes("prosthetic") ||
    lane.includes("orthotic") ||
    lane.includes("distributor")
  ) {
    return "Research the recipient and agency, then decide whether outreach should go to the distributor, procurement office, or clinical influencer.";
  }

  return "Research the recipient and agency, then decide whether outreach should go to the funded organization, procurement office, or implementation partner.";
}

function isCreativeLane(lane: string, evidence = ""): boolean {
  return (
    lane.includes("live performance") ||
    lane.includes("public concerts") ||
    lane.includes("arts") ||
    lane.includes("creative") ||
    lane.includes("tourism") ||
    lane.includes("placemaking") ||
    lane.includes("event production") ||
    lane.includes("event entertainment") ||
    lane.includes("performer") ||
    lane.includes("music") ||
    /live music|music performance|musical performance|musician services|concert|event entertainment|performer services|artist booking|festival entertainment/.test(
      evidence
    )
  );
}

export function assessActionability(signal: StoredOpportunitySignal): ActionabilityAssessment {
  const lane = signalLane(signal).toLowerCase();
  const evidence = [
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner
  ]
    .join(" ")
    .toLowerCase();
  const endDate = comparableDate(signal.deadline || signalDate(signal, "End Date"));
  const startDate = comparableDate(signalDate(signal, "Start Date"));
  const currentDate = CURRENT_ACTION_DATE;
  const recentStart = startDate >= "2024-01-01";
  const stillActive = Boolean(endDate && endDate >= currentDate);
  const expired = Boolean(endDate && endDate < currentDate);
  const infrastructureOnly = lane.includes("infrastructure") || signal.revenue_pathway === "monitor_policy";
  const directProcurementLane =
    lane.includes("medical and rehabilitation supply") ||
    lane.includes("medical retail") ||
    lane.includes("distributor") ||
    lane.includes("channel") ||
    lane.includes("prosthetics") ||
    lane.includes("orthotics") ||
    lane.includes("teacher staffing") ||
    lane.includes("educator workforce") ||
    lane.includes("education workforce") ||
    lane.includes("prop 28") ||
    lane.includes("arts education") ||
    lane.includes("teaching artist") ||
    lane.includes("school arts") ||
    lane.includes("enrichment") ||
    lane.includes("recruiting technology") ||
    lane.includes("funded-buyer") ||
    lane.includes("creative workforce") ||
    lane.includes("music-industry") ||
    lane.includes("entertainment procurement") ||
    lane.includes("live performance") ||
    lane.includes("public concerts") ||
    lane.includes("arts and culture") ||
    lane.includes("arts programming") ||
    lane.includes("public event production") ||
    lane.includes("tourism") ||
    lane.includes("placemaking") ||
    lane.includes("downtown") ||
    lane.includes("state arts council") ||
    lane.includes("library and community") ||
    lane.includes("cultural programming") ||
    lane.includes("live events") ||
    lane.includes("public arts");

  if (infrastructureOnly) {
    return {
      actionability: "unlikely",
      reason: "This is infrastructure or policy context, not a buyer/channel the company can reasonably pursue now.",
      bestNextStep: "Do not surface as a lead; use only for background market mapping."
    };
  }

  if (expired) {
    return {
      actionability: "unlikely",
      reason: "This record has already ended, so it should not be shown as an actionable opportunity.",
      bestNextStep: "Hide from the actionable report; use only for internal pattern research."
    };
  }

  if (directProcurementLane && signal.relevance_score >= 72 && signal.confidence_score >= 70 && stillActive) {
    return {
      actionability: "yes",
      reason: "Current or active spending in a directly adjacent buyer, channel, procurement, or funded-recipient pathway.",
      bestNextStep: bestNextStepForLane(lane)
    };
  }

  if (directProcurementLane && signal.relevance_score >= 68 && signal.confidence_score >= 70 && recentStart) {
    return {
      actionability: "maybe",
      reason: "Recent adjacent spending suggests a possible pathway, but the buyer/channel fit needs validation.",
      bestNextStep: bestNextStepForLane(lane)
    };
  }

  if (isCreativeLane(lane, evidence) && directProcurementLane && signal.relevance_score >= 64 && signal.confidence_score >= 70 && recentStart) {
    return {
      actionability: "maybe",
      reason: "Recent live-music, performance, event, or arts spending suggests a possible buyer or partner pathway, even if the award is smaller or more targeted.",
      bestNextStep: bestNextStepForLane(lane)
    };
  }

  return {
    actionability: "unlikely",
    reason: "The signal is too indirect, old, or weakly matched to recommend as a move-forward opportunity.",
    bestNextStep: "Hide from the report unless a human analyst promotes it after review."
  };
}

export function isMoveForwardSignal(signal: StoredOpportunitySignal): boolean {
  return assessActionability(signal).actionability !== "unlikely";
}
