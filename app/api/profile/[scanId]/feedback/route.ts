import { NextResponse } from "next/server";
import {
  getCompanyProfile,
  getScan,
  getStoredOpportunitySignal,
  listProfileFeedbackForScan,
  saveProfileFeedback,
  updateCompanyProfile
} from "@/lib/storage";
import {
  applyProfileFeedbackToProfile,
  buildProfileSearchStrategy,
  feedbackJsonFromSignal
} from "@/lib/profileRefinement";
import { ProfileFeedbackKind } from "@/lib/types";

export const runtime = "nodejs";

const feedbackKinds: ProfileFeedbackKind[] = [
  "confirm_profile",
  "refine_profile",
  "add_focus",
  "exclude_lane",
  "include_term",
  "exclude_term",
  "more_like_this",
  "less_like_this",
  "change_target_geography",
  "change_priority_signal"
];

async function requestPayload(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export async function POST(request: Request, { params }: { params: { scanId: string } }) {
  const scan = await getScan(params.scanId);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const profileRecord = await getCompanyProfile(scan.id);
  if (!profileRecord) {
    return NextResponse.json({ error: "Company profile not found." }, { status: 404 });
  }

  const payload = await requestPayload(request);
  const feedbackKind = stringValue(payload.feedbackKind || payload.feedback_kind) as ProfileFeedbackKind | null;
  if (!feedbackKind || !feedbackKinds.includes(feedbackKind)) {
    return NextResponse.json({ error: "Invalid profile feedback kind." }, { status: 400 });
  }

  const opportunityId = stringValue(payload.opportunityId || payload.opportunity_id);
  const signal = opportunityId ? await getStoredOpportunitySignal(scan.id, opportunityId) : null;
  const signalJson = feedbackJsonFromSignal(signal);
  const feedbackJson = {
    ...signalJson,
    terms: arrayValue(payload.terms).length > 0 ? arrayValue(payload.terms) : signalJson.terms,
    lanes: arrayValue(payload.lanes).length > 0 ? arrayValue(payload.lanes) : signalJson.lanes,
    target_geographies: arrayValue(payload.targetGeographies || payload.target_geographies),
    priority_signals: arrayValue(payload.prioritySignals || payload.priority_signals),
    raw: payload
  };

  const feedback = await saveProfileFeedback({
    scanId: scan.id,
    companyProfileId: profileRecord.id,
    companyUrl: scan.company_url,
    opportunityId,
    feedbackKind,
    value: stringValue(payload.value),
    reason: stringValue(payload.reason),
    feedbackJson
  });

  const feedbackRows = await listProfileFeedbackForScan(scan.id);
  const updatedProfile = applyProfileFeedbackToProfile(profileRecord.profile_json, feedbackRows);
  const updatedProfileRecord = await updateCompanyProfile(profileRecord.id, updatedProfile);

  return NextResponse.json({
    feedback,
    company_profile_id: updatedProfileRecord.id,
    profile: updatedProfileRecord.profile_json,
    search_strategy: buildProfileSearchStrategy(updatedProfileRecord.profile_json),
    refresh_available: true
  });
}
