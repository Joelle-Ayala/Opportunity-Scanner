import { NextResponse } from "next/server";
import { getCompanyProfile, getScan, listScanOpportunitySignals } from "@/lib/storage";
import { signalLane } from "@/lib/actionability";
import { primaryContactTarget } from "@/lib/contactTargeting";
import { opportunityActionFor } from "@/lib/opportunityAction";
import { classificationLabel } from "@/lib/opportunityClassification";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { hasFullReportAccess } from "@/lib/access";

export const runtime = "nodejs";

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function sourceLabel(signal: Awaited<ReturnType<typeof listScanOpportunitySignals>>[number]): string {
  const endDate =
    signal.deadline || (typeof signal.raw_json?.["End Date"] === "string" ? signal.raw_json["End Date"] : "");

  if (signal.source_type === "historical_award" && endDate >= new Date().toISOString().slice(0, 10)) {
    return `${signal.source_name} - current funded program`;
  }

  return `${signal.source_name} - ${signal.source_type.replaceAll("_", " ")}`;
}

function opportunityHeadline(signal: Awaited<ReturnType<typeof listScanOpportunitySignals>>[number]): string {
  const match = signal.opportunity_title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (match) {
    const [, recipient, amount] = match;
    return `${signalLane(signal)}: ${recipient} funded ${amount}`;
  }

  return signal.opportunity_title;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const scan = await getScan(params.id);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found." }, { status: 404 });
  }

  const access = new URL(request.url).searchParams.get("access") ?? undefined;
  if (!hasFullReportAccess(access, scan)) {
    return NextResponse.json({ error: "Full report access is required to export this scan." }, { status: 403 });
  }

  const profileRecord = await getCompanyProfile(params.id);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
  const signals = await listScanOpportunitySignals(params.id);
  const sortedSignals = signals
    .filter((signal) => opportunityActionFor(signal, profile).show_in_report)
    .sort(
      (a, b) =>
        opportunityActionFor(b, profile).actionability_score -
        opportunityActionFor(a, profile).actionability_score
    );
  const rows = [
    [
      "Signal",
      "Lane",
      "Opportunity Type",
      "Source",
      "Source Status",
      "Time Sensitivity",
      "Pursuit Difficulty",
      "Buyer / Partner",
      "Buyer / Partner Type",
      "Revenue Motion",
      "Primary Contact Target",
      "Contact Name",
      "Contact Title",
      "Contact Email",
      "Contact Phone",
      "Suggested Contact Roles",
      "Contact Strategy",
      "Contact Rationale",
      "Outreach Angle",
      "Contact Search URL",
      "Actionability",
      "Actionability Score",
      "Workflow Ready",
      "Workflow Reason",
      "Relevance",
      "Novelty",
      "Confidence",
      "Query",
      "Next Step",
      "Manual Research Instruction",
      "Follow Up Task",
      "URL"
    ],
    ...sortedSignals.map((signal) => {
      const classification = opportunityActionFor(signal, profile);
      const contactTarget = primaryContactTarget(signal);
      return [
        opportunityHeadline(signal),
        signalLane(signal),
        classificationLabel(classification.estimated_opportunity_type),
        sourceLabel(signal),
        classification.source_status,
        classificationLabel(classification.time_sensitivity),
        classification.pursuit_difficulty,
        signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review",
        classificationLabel(classification.buyer_partner_type),
        classificationLabel(classification.revenue_motion),
        contactTarget.organization,
        contactTarget.name || "",
        contactTarget.title || "",
        contactTarget.email || "",
        contactTarget.phone || "",
        classification.recommended_contact_roles.join("; ") || contactTarget.roles.join("; "),
        classificationLabel(classification.contact_strategy),
        contactTarget.why,
        classification.outreach_angle || contactTarget.outreachAngle,
        contactTarget.searchUrl,
        classification.actionability_label,
        classification.actionability_score,
        classification.workflow_payload_ready ? "Yes" : "No",
        classification.workflow_payload_reason,
        signal.relevance_score,
        signal.novelty_score,
        signal.confidence_score,
        signal.query_used,
        classification.next_best_action,
        classification.manual_research_instruction,
        classification.follow_up_task,
        signal.source_url
      ];
    })
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="opportunity-scan-${params.id}.csv"`
    }
  });
}
