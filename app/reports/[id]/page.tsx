import { notFound } from "next/navigation";
import { Badge, CompanyLogo, LockedBadge, OpportunityScannerLogo } from "@/components/brand";
import { SendToWorkflowModal, WorkflowPayload } from "@/components/workflow";
import { getCompanyProfile, getScan, listScanOpportunitySignals } from "@/lib/storage";
import { CompanyProfile, ScanRecord, StoredOpportunitySignal } from "@/lib/types";
import { signalLane } from "@/lib/actionability";
import { contactDiscoverySummary, contactTargetsForSignal } from "@/lib/contactTargeting";
import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { classificationLabel, classifyOpportunity } from "@/lib/opportunityClassification";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { sourceCatalog } from "@/lib/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function opportunityHeadline(signal: StoredOpportunitySignal): string {
  const match = signal.opportunity_title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (match) {
    const [, recipient, amount] = match;
    return `${signalLane(signal)}: ${recipient} funded ${amount}`;
  }
  return signal.opportunity_title;
}

function hostname(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function companyLogoUrl(companyUrl: string): string | null {
  const host = hostname(companyUrl);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : null;
}

function revenueMotionLabel(signal: StoredOpportunitySignal): string {
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

function sourceTypeLabel(signal: StoredOpportunitySignal): string {
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

function primaryActionLabel(signal: StoredOpportunitySignal, profile?: CompanyProfile): string {
  const classification = classifyOpportunity(signal, profile);
  if (signal.source_type === "active_contract" || classification.contact_strategy === "inspect_procurement_record") {
    return "Review solicitation";
  }
  if (signal.source_type === "active_grant" || signal.revenue_pathway === "direct_apply") {
    return "Check eligibility";
  }
  if (signal.revenue_pathway === "sell_to_grantee" || classification.buyer_partner_type === "funded_buyer") {
    return "Research buyer";
  }
  if (classification.buyer_partner_type === "award_recipient") {
    return "Research recipient";
  }
  if (signal.revenue_pathway === "partner_with_recipient") {
    return "Map partner path";
  }
  if (signal.revenue_pathway === "monitor_policy" || classification.contact_strategy === "monitor_source") {
    return "Monitor signal";
  }
  return "Validate fit";
}

function workflowPayload(
  scanId: string,
  signal: StoredOpportunitySignal,
  profile: CompanyProfile | undefined,
  isPaid: boolean
): WorkflowPayload {
  const classification = classifyOpportunity(signal, profile);
  return {
    scanId,
    opportunityId: signal.id,
    opportunity: opportunityHeadline(signal),
    targetOrganization: signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review",
    targetAccount: signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review",
    source: signal.source_name,
    signalType: sourceTypeLabel(signal),
    opportunityType: classification.estimated_opportunity_type,
    buyerPartnerType: classification.buyer_partner_type,
    revenueMotion: revenueMotionLabel(signal),
    actionability: classification.actionability_label,
    actionabilityScore: classification.actionability_score,
    contactPath: classificationLabel(classification.contact_strategy),
    contactStrategy: classification.contact_strategy,
    recommendedContactRoles: classification.recommended_contact_roles,
    nextStep: classification.next_best_action,
    nextBestAction: classification.next_best_action,
    manualResearchInstruction: classification.manual_research_instruction,
    crmNote: classification.crm_note,
    outreachAngle: classification.outreach_angle,
    followUpTask: classification.follow_up_task,
    timeSensitivity: classification.time_sensitivity,
    pursuitDifficulty: classification.pursuit_difficulty,
    workflowPayloadReady: classification.workflow_payload_ready,
    workflowPayloadReason: classification.workflow_payload_reason,
    sourceStatus: classification.source_status,
    sourceDeadline: classification.source_deadline,
    sourceEvidence: signal.external_evidence_summary,
    sourceUrl: isPaid ? signal.source_url : undefined
  };
}

function visibleSignalCount(total: number): number {
  if (total >= 5) return 3;
  if (total >= 3) return 2;
  return total;
}

function badgeTone(value: string): "green" | "blue" | "amber" | "slate" {
  if (/strong|ready|active|low/.test(value)) return "green";
  if (/medium|historical|recent/.test(value)) return "blue";
  if (/urgent|research|monitor|high/.test(value)) return "amber";
  return "slate";
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function buildExecutiveSummary(signals: StoredOpportunitySignal[], profile?: CompanyProfile) {
  const summarySignals = signals.length > 0 ? signals : [];
  const sorted = [...summarySignals].sort(
    (a, b) =>
      b.relevance_score + b.confidence_score + b.novelty_score -
      (a.relevance_score + a.confidence_score + a.novelty_score)
  );
  const best = sorted[0];
  const topLane = best ? signalLane(best) : "No strong lane yet";
  const confidence =
    sorted.length > 0
      ? Math.round(sorted.reduce((sum, signal) => sum + signal.confidence_score, 0) / sorted.length)
      : 0;

  return {
    best,
    topSignalPattern: best ? best.external_evidence_summary : "No sourced pattern yet.",
    topLane,
    confidence,
    bestNextAction: best ? classifyOpportunity(best, profile).next_best_action : "Run a broader scan or review source coverage."
  };
}

function ReportHeader({
  scan,
  profile,
  totalSignals,
  visibleSignals,
  lockedSignals,
  isPaid
}: {
  scan: ScanRecord;
  profile?: CompanyProfile;
  totalSignals: number;
  visibleSignals: number;
  lockedSignals: number;
  isPaid: boolean;
}) {
  const companyName = profile?.company_name || scan.company_name || hostname(scan.company_url);

  return (
    <header className="rounded-lg border border-line bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <OpportunityScannerLogo />
        <div className="flex flex-wrap gap-2">
          <a href="/" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink">
            Run New Scan
          </a>
          {isPaid ? (
            <a
              href={`/api/reports/${scan.id}/export`}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Download Report
            </a>
          ) : (
            <span className="rounded-md border border-line bg-field px-3 py-2 text-sm font-semibold text-muted">
              Download locked
            </span>
          )}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <CompanyLogo name={companyName} logoUrl={companyLogoUrl(scan.company_url)} />
        <div>
          <h1 className="text-3xl font-semibold text-ink">{companyName}</h1>
          <p className="mt-1 text-sm text-muted">{scan.company_url}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Scan date</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {new Date(scan.completed_at || scan.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">External signals found</p>
          <p className="mt-1 text-sm font-semibold text-ink">{totalSignals}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Visible signals</p>
          <p className="mt-1 text-sm font-semibold text-ink">{visibleSignals}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Locked signals</p>
          <p className="mt-1 text-sm font-semibold text-ink">{isPaid ? 0 : lockedSignals}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Status</p>
          <p className="mt-1 text-sm font-semibold text-ink">{scan.status}</p>
        </div>
      </div>
    </header>
  );
}

function ExecutiveSummaryCard({
  signals,
  profile
}: {
  signals: StoredOpportunitySignal[];
  profile?: CompanyProfile;
}) {
  const summary = buildExecutiveSummary(signals, profile);
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Executive Summary</h2>
        <Badge tone={summary.confidence >= 75 ? "green" : "blue"}>Overall confidence {summary.confidence || "TBD"}</Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <div className="rounded-md border border-line bg-field p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted">Top signal pattern</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{summary.topSignalPattern}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <p className="text-xs font-semibold uppercase text-muted">Strongest lane</p>
          <p className="mt-2 text-sm font-semibold text-ink">{summary.topLane}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <p className="text-xs font-semibold uppercase text-muted">Best next action</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{summary.bestNextAction}</p>
        </div>
      </div>
    </section>
  );
}

function ContactRoles({ signal }: { signal: StoredOpportunitySignal }) {
  const roles = [...new Set(contactTargetsForSignal(signal).flatMap((target) => target.roles))].slice(0, 8);
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <Badge key={role}>{role}</Badge>
      ))}
    </div>
  );
}

function ContactEnrichmentStatus({ signal }: { signal: StoredOpportunitySignal }) {
  const summary = contactDiscoverySummary(signal);
  const label = summary.verifiedContacts > 0 ? "Contacts found" : "Contact path suggested";
  return (
    <div>
      <Badge tone={summary.verifiedContacts > 0 ? "green" : "blue"}>{label}</Badge>
      <p className="mt-1 text-xs leading-5 text-muted">{summary.detailLabel}</p>
    </div>
  );
}

function FindContactsButton({
  scanId,
  opportunityId,
  locked = false
}: {
  scanId: string;
  opportunityId: string;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <button
        disabled
        className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500"
      >
        Find Contacts
      </button>
    );
  }

  return (
    <form action="/api/opportunities/enrich" method="post">
      <input type="hidden" name="scanId" value={scanId} />
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <input type="hidden" name="enrichmentType" value="find_contacts" />
      <button className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent">
        Find Contacts
      </button>
    </form>
  );
}

function PrimaryActionButton({
  scanId,
  signal,
  profile,
  isPaid
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile;
  isPaid: boolean;
}) {
  const classification = classifyOpportunity(signal, profile);
  const label = primaryActionLabel(signal, profile);
  const opensSource =
    isPaid &&
    signal.source_url &&
    ["Review solicitation", "Check eligibility", "Monitor signal"].includes(label);
  const href = opensSource ? signal.source_url : `/opportunities/${signal.id}?scanId=${scanId}`;

  return (
    <a
      href={href}
      target={opensSource ? "_blank" : undefined}
      rel={opensSource ? "noreferrer" : undefined}
      className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      title={classification.manual_research_instruction}
    >
      {label}
    </a>
  );
}

function OpportunityProfileModule({
  scan,
  profile
}: {
  scan: ScanRecord;
  profile?: CompanyProfile;
}) {
  const products = (profile?.inferred_products_services ?? profile?.products_services ?? []).slice(0, 8);
  const terms = unique([
    ...(profile?.include_terms ?? []),
    ...(profile?.public_sector_search_terms ?? []),
    ...(profile?.translated_public_sector_terms ?? [])
  ]).slice(0, 10);
  const lanes = (profile?.confirmed_opportunity_lanes?.length
    ? profile.confirmed_opportunity_lanes
    : profile?.inferred_public_sector_lanes ?? profile?.opportunity_lanes ?? []
  ).slice(0, 8);
  const buyerTypes = unique([
    ...(profile?.inferred_target_customers ?? profile?.target_customers ?? []),
    ...(profile?.inferred_buyer_partner_types ?? []),
    ...(profile?.inferred_revenue_motions ?? profile?.likely_revenue_motions ?? []),
    ...(profile?.suggested_contact_roles ?? [])
  ]).slice(0, 10);
  const priorities = (scan.priority_signals ?? []).map((item) => item.replaceAll("_", " "));
  const lowPriority = unique([
    ...(profile?.negative_keywords ?? []),
    ...(scan.exclude_terms ? scan.exclude_terms.split(",").map((item) => item.trim()) : [])
  ]).slice(0, 8);

  function ChipList({ items, empty }: { items: string[]; empty: string }) {
    return items.length > 0 ? (
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item}>{item}</Badge>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-muted">{empty}</p>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Opportunity Profile Used For This Scan</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            We translated your website into public-sector buying language. These assumptions shaped
            the opportunity scan.
          </p>
        </div>
        <a
          href={`/profiles/${scan.id}`}
          className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Refine Profile
        </a>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Products / services inferred</h3>
          <ChipList items={products} empty="No product assumptions saved yet." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Public-sector search terms</h3>
          <ChipList items={terms} empty="No public-sector terms saved yet." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Opportunity lanes</h3>
          <ChipList items={lanes} empty="No opportunity lanes saved yet." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Likely buyer / partner types</h3>
          <ChipList items={buyerTypes} empty="No buyer or partner assumptions saved yet." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Priority signals</h3>
          <ChipList items={priorities} empty="No explicit priority signals selected." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Excluded or low-priority lanes</h3>
          <ChipList items={lowPriority} empty="No excluded lanes saved yet." />
        </div>
      </div>
    </section>
  );
}

function OpportunityDetail({
  scanId,
  signal,
  isPaid,
  profile
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  isPaid: boolean;
  profile?: CompanyProfile;
}) {
  const classification = classifyOpportunity(signal, profile);
  const buyer = signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review";

  return (
    <div className="grid gap-4 border-t border-line bg-field p-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Why it matters</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{signal.why_it_matters}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Evidence / source summary</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{signal.external_evidence_summary}</p>
          {isPaid ? (
            <a href={signal.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-accent">
              Open source record
            </a>
          ) : (
            <div className="mt-3">
              <LockedBadge />
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Suggested contact roles</h3>
          <div className="mt-2">
            <ContactRoles signal={signal} />
          </div>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Buyer / partner type</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {classificationLabel(classification.buyer_partner_type)} for {buyer}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">CRM note</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{isPaid ? classification.crm_note : "Unlock to copy CRM-ready notes."}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Outreach angle</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{isPaid ? classification.outreach_angle : "Unlock to view the recommended outreach angle."}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Recommended next step</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{classification.next_best_action}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{classification.manual_research_instruction}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryActionButton scanId={scanId} signal={signal} profile={profile} isPaid={isPaid} />
            <SendToWorkflowModal payload={workflowPayload(scanId, signal, profile, isPaid)} locked={!isPaid} />
            <FindContactsButton
              scanId={scanId}
              opportunityId={signal.id}
              locked={!isPaid || !["enrich_company_domain", "contact_award_recipient"].includes(classification.contact_strategy)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunityActionTable({
  scanId,
  signals,
  isPaid,
  profile
}: {
  scanId: string;
  signals: StoredOpportunitySignal[];
  isPaid: boolean;
  profile?: CompanyProfile;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Opportunity Action Table</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Here are the opportunity signals, target paths, and actions to move each one forward.
          </p>
        </div>
        <Badge tone="blue">{signals.length} visible</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1280px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-field text-xs uppercase text-muted">
              <th className="px-4 py-3 font-semibold">Opportunity</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Target organization</th>
              <th className="px-4 py-3 font-semibold">Revenue motion</th>
              <th className="px-4 py-3 font-semibold">Next best action</th>
              <th className="px-4 py-3 font-semibold">Contact strategy</th>
              <th className="px-4 py-3 font-semibold">Source / status</th>
              <th className="px-4 py-3 font-semibold">Workflow</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => {
              const classification = classifyOpportunity(signal, profile);
              return (
                <tr key={signal.id} className="border-b border-line align-top last:border-0">
                  <td className="max-w-[300px] px-4 py-4">
                    <details>
                      <summary className="cursor-pointer font-semibold leading-6 text-ink hover:text-accent">
                        {opportunityHeadline(signal)}
                      </summary>
                      <div className="mt-3 w-[1180px] max-w-[calc(100vw-4rem)]">
                        <OpportunityDetail
                          scanId={scanId}
                          signal={signal}
                          isPaid={isPaid}
                          profile={profile}
                        />
                      </div>
                    </details>
                  </td>
                  <td className="max-w-[190px] px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={badgeTone(classification.estimated_opportunity_type)}>
                        {classificationLabel(classification.estimated_opportunity_type)}
                      </Badge>
                      <Badge tone={badgeTone(classification.time_sensitivity)}>
                        {classificationLabel(classification.time_sensitivity)}
                      </Badge>
                      <Badge tone={badgeTone(classification.pursuit_difficulty)}>
                        {classification.pursuit_difficulty} difficulty
                      </Badge>
                    </div>
                  </td>
                  <td className="max-w-[180px] px-4 py-4 text-slate-700">
                    {signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review"}
                    <p className="mt-2 text-xs leading-5 text-muted">{classificationLabel(classification.buyer_partner_type)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone="blue">{revenueMotionLabel(signal)}</Badge>
                  </td>
                  <td className="max-w-[310px] px-4 py-4 text-slate-700">
                    <Badge tone={badgeTone(classification.actionability_label)}>{classification.actionability_label}</Badge>
                    <p className="mt-2 leading-6">{classification.next_best_action}</p>
                    <p className="mt-2 text-xs leading-5 text-muted">Actionability {classification.actionability_score}/100</p>
                  </td>
                  <td className="max-w-[210px] px-4 py-4">
                    <p className="font-semibold text-ink">{classificationLabel(classification.contact_strategy)}</p>
                    <ContactEnrichmentStatus signal={signal} />
                  </td>
                  <td className="max-w-[210px] px-4 py-4 text-slate-700">
                    <p className="font-semibold text-ink">{signal.source_name}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{classification.source_status}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{sourceTypeLabel(signal)}</p>
                  </td>
                  <td className="min-w-[190px] px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <PrimaryActionButton scanId={scanId} signal={signal} profile={profile} isPaid={isPaid} />
                      <SendToWorkflowModal payload={workflowPayload(scanId, signal, profile, isPaid)} locked={!isPaid} />
                      <FindContactsButton
                        scanId={scanId}
                        opportunityId={signal.id}
                        locked={!isPaid || !["enrich_company_domain", "contact_award_recipient"].includes(classification.contact_strategy)}
                      />
                      <p className="text-xs leading-5 text-muted">{classification.workflow_payload_reason}</p>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isPaid ? (
        <p className="border-t border-line bg-field px-5 py-4 text-sm text-muted">
          Unlock Full Scan to send opportunities to Zapier, Make, n8n, HubSpot workflows, Airtable, or your CRM.
        </p>
      ) : null}
    </section>
  );
}

function OpportunitySignalCard({
  scanId,
  signal,
  isPaid,
  profile
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  isPaid: boolean;
  profile?: CompanyProfile;
}) {
  const classification = classifyOpportunity(signal, profile);
  return (
    <article className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={badgeTone(classification.actionability_label)}>{classification.actionability_label}</Badge>
        <Badge tone={badgeTone(classification.estimated_opportunity_type)}>
          {classificationLabel(classification.estimated_opportunity_type)}
        </Badge>
        <Badge tone="blue">{revenueMotionLabel(signal)}</Badge>
        <Badge>{signalLane(signal)}</Badge>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-7 text-ink">{opportunityHeadline(signal)}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-700">{signal.external_evidence_summary}</p>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <p><span className="font-semibold text-ink">Target:</span> {signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review"}</p>
        <p><span className="font-semibold text-ink">Contact path:</span> {classificationLabel(classification.contact_strategy)}</p>
        <p><span className="font-semibold text-ink">Timing:</span> {classification.source_status}</p>
      </div>
      <p className="mt-4 rounded-md border border-line bg-field px-3 py-2 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-ink">Next best action:</span> {classification.next_best_action}
      </p>
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-ink">Suggested contact roles</h4>
        <div className="mt-2">
          <ContactRoles signal={signal} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {isPaid ? (
          <a href={signal.source_url} target="_blank" rel="noreferrer" className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
            Open source
          </a>
        ) : (
          <LockedBadge />
        )}
        <a href={`/opportunities/${signal.id}?scanId=${scanId}`} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
          Open detail
        </a>
      </div>
    </article>
  );
}

function LockedOpportunityCard({ signal, profile }: { signal: StoredOpportunitySignal; profile?: CompanyProfile }) {
  const classification = classifyOpportunity(signal, profile);
  return (
    <article className="rounded-lg border border-dashed border-line bg-white p-5">
      <div className="flex flex-wrap gap-2">
        <Badge>{signalLane(signal)}</Badge>
        <Badge>{classificationLabel(classification.estimated_opportunity_type)}</Badge>
        <Badge tone={badgeTone(classification.time_sensitivity)}>
          {classificationLabel(classification.time_sensitivity)}
        </Badge>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">Additional workflow-ready opportunity</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Unlock the full report to see the target, source link, contact strategy, CRM note, outreach angle, and workflow payload.
      </p>
      <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
        <p>{classificationLabel(classification.buyer_partner_type)} locked</p>
        <p>{classification.source_status}</p>
        <p>{classificationLabel(classification.contact_strategy)} locked</p>
      </div>
      <a href="?unlock=placeholder" className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        Unlock Full Pipeline
      </a>
    </article>
  );
}

function UnlockCTA() {
  const items = [
    "all prioritized public-sector signals",
    "buyer/partner targets",
    "source-backed evidence",
    "contact paths",
    "CRM-ready notes",
    "outreach angles",
    "workflow-ready payloads",
    "PDF/export"
  ];
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Unlock the full opportunity pipeline</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-900">
            Get all prioritized public-sector signals, buyer/partner targets, source-backed
            evidence, contact paths, CRM-ready notes, outreach angles, and workflow-ready payloads.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {items.map((item) => (
              <Badge key={item} tone="blue">{item}</Badge>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-white p-4 text-center">
          <p className="text-3xl font-semibold text-ink"><span>$</span>99</p>
          <a href="?unlock=placeholder" className="mt-3 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Unlock for $99
          </a>
        </div>
      </div>
    </section>
  );
}

function BuyerPartnerTable({ signals }: { signals: StoredOpportunitySignal[] }) {
  const buyers = signals.slice(0, 12);
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Buyer / Partner Targets</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-field text-xs uppercase text-muted">
              <th className="px-3 py-3">Target</th>
              <th className="px-3 py-3">Lane</th>
              <th className="px-3 py-3">Contact roles</th>
              <th className="px-3 py-3">Motion</th>
            </tr>
          </thead>
          <tbody>
            {buyers.map((signal) => (
              <tr key={signal.id} className="border-b border-line last:border-0">
                <td className="px-3 py-3 font-semibold text-ink">{signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review"}</td>
                <td className="px-3 py-3 text-slate-700">{signalLane(signal)}</td>
                <td className="px-3 py-3 text-slate-700">{contactTargetsForSignal(signal)[0]?.roles.slice(0, 3).join(", ")}</td>
                <td className="px-3 py-3 text-slate-700">{revenueMotionLabel(signal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionPlan({ signals }: { signals: StoredOpportunitySignal[] }) {
  const topSignals = signals.slice(0, 3);
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Recommended Action Plan</h2>
      <ol className="mt-4 grid gap-3 text-sm leading-6 text-slate-700">
        <li className="rounded-md border border-line bg-field p-4">
          <span className="font-semibold text-ink">1. Prioritize the highest actionability rows.</span> Start with signals that have a clear buyer, source evidence, and near-term timing.
        </li>
        <li className="rounded-md border border-line bg-field p-4">
          <span className="font-semibold text-ink">2. Validate contact paths.</span> Use source-native contacts first, then enrich program, procurement, vendor relations, or partnership roles.
        </li>
        <li className="rounded-md border border-line bg-field p-4">
          <span className="font-semibold text-ink">3. Push selected opportunities to workflow.</span> Create CRM deals, account research tasks, or outreach queues from the structured row payload.
        </li>
      </ol>
      {topSignals.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {topSignals.map((signal) => (
            <p key={signal.id} className="text-sm text-muted">
              Priority: <span className="font-semibold text-ink">{opportunityHeadline(signal)}</span>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function pursuitGroup(signal: StoredOpportunitySignal, profile?: CompanyProfile): string {
  const classification = classifyOpportunity(signal, profile);
  if (
    ["use_source_native_contact", "contact_procurement_office", "contact_program_office", "contact_grants_manager"].includes(
      classification.contact_strategy
    )
  ) {
    return "Contact now";
  }
  if (classification.contact_strategy === "inspect_procurement_record" || signal.revenue_pathway === "direct_apply") {
    return "Inspect / register";
  }
  if (signal.revenue_pathway === "sell_to_grantee" || classification.buyer_partner_type === "funded_buyer") {
    return "Sell to funded buyer";
  }
  if (
    signal.revenue_pathway === "partner_with_recipient" ||
    ["identify_distributor", "research_prime_or_vendor", "enrich_company_domain", "contact_award_recipient"].includes(
      classification.contact_strategy
    )
  ) {
    return "Partner / channel motion";
  }
  if (signal.revenue_pathway === "monitor_policy" || classification.contact_strategy === "monitor_source") {
    return "Monitor policy";
  }
  return "Research / validate";
}

function PursuitPlan({
  signals,
  profile
}: {
  signals: StoredOpportunitySignal[];
  profile?: CompanyProfile;
}) {
  const groups = [
    "Contact now",
    "Inspect / register",
    "Sell to funded buyer",
    "Partner / channel motion",
    "Monitor policy",
    "Research / validate"
  ].map((name) => ({
    name,
    signals: signals.filter((signal) => pursuitGroup(signal, profile) === name).slice(0, 4)
  }));

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Pursuit Plan</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            The full report groups opportunity signals by the likely next move, so the pipeline is
            easier to assign, research, and push into workflow.
          </p>
        </div>
        <Badge tone="green">Paid workflow view</Badge>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.name} className="rounded-md border border-line bg-field p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">{group.name}</h3>
              <Badge tone={group.signals.length > 0 ? "blue" : "slate"}>{group.signals.length}</Badge>
            </div>
            {group.signals.length > 0 ? (
              <div className="mt-3 grid gap-3">
                {group.signals.map((signal) => {
                  const classification = classifyOpportunity(signal, profile);
                  return (
                    <div key={signal.id} className="rounded-md border border-line bg-white p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-5 text-ink">
                        {opportunityHeadline(signal)}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted">{classification.next_best_action}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">No visible opportunities in this action path.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ScreeningSummary({
  allSignals,
  reportSignals,
  profile
}: {
  allSignals: StoredOpportunitySignal[];
  reportSignals: StoredOpportunitySignal[];
  profile?: CompanyProfile;
}) {
  const reportIds = new Set(reportSignals.map((signal) => signal.id));
  const screenedOut = allSignals.filter((signal) => !reportIds.has(signal.id));
  const buckets = screenedOut.reduce<Record<string, { count: number; reason: string; examples: string[] }>>(
    (counts, signal) => {
      const classification = classifyOpportunity(signal, profile);
      const key = classification.screening_path;
      const bucket = counts[key] ?? { count: 0, reason: classification.screening_reason, examples: [] };
      bucket.count += 1;
      if (bucket.examples.length < 2) {
        bucket.examples.push(opportunityHeadline(signal));
      }
      counts[key] = bucket;
      return counts;
    },
    {}
  );

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Opportunity Screening</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            The scan found source matches first, then screened them for current timing, buyer clarity, and revenue fit before adding them to the table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{allSignals.length} source matches</Badge>
          <Badge tone="green">{reportSignals.length} table rows</Badge>
          <Badge tone="amber">{screenedOut.length} screened out</Badge>
        </div>
      </div>
      {screenedOut.length > 0 ? (
        <details className="mt-4 rounded-md border border-line bg-field p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Why the other matches were not shown</summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.entries(buckets).map(([path, bucket]) => (
              <div key={path} className="rounded-md border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{path}</p>
                  <Badge tone="slate">{bucket.count}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{bucket.reason}</p>
                <div className="mt-3 grid gap-1">
                  {bucket.examples.map((example) => (
                    <p key={example} className="truncate text-xs text-slate-600">{example}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function SourcesScanned({ profile, signals }: { profile?: CompanyProfile; signals: StoredOpportunitySignal[] }) {
  const sourceCounts = signals.reduce<Record<string, number>>((counts, signal) => {
    counts[signal.source_name] = (counts[signal.source_name] ?? 0) + 1;
    return counts;
  }, {});
  const samGovConfigured = isSamGovConfigured();
  const catalog = sourceCatalog({ samGovConfigured });
  const names = ["USAspending.gov", "SAM.gov", "Grants.gov", "Federal Register", "Regulations.gov"];
  const activeSources = catalog
    .filter((source) => names.includes(source.name) || sourceCounts[source.name])
    .slice(0, 8);

  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Sources scanned for this report</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {activeSources.map((source) => (
          <Badge key={source.id} tone={sourceCounts[source.name] ? "green" : "slate"}>
            {source.name}
          </Badge>
        ))}
      </div>
      <details className="mt-4 rounded-md border border-line bg-field p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Research details</summary>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
          <p><span className="font-semibold text-ink">Sources activated:</span> {(profile?.activated_source_categories ?? []).join(", ") || "General source routing"}</p>
          <p><span className="font-semibold text-ink">Connected sources used:</span> {Object.keys(sourceCounts).join(", ") || "No source results saved"}</p>
          <p><span className="font-semibold text-ink">Result count:</span> {signals.length} external signal(s)</p>
        </div>
      </details>
    </section>
  );
}

function AdminDebug({
  profile,
  scan
}: {
  profile?: CompanyProfile;
  scan: ScanRecord;
}) {
  return (
    <details className="rounded-lg border border-line bg-white p-5">
      <summary className="cursor-pointer text-lg font-semibold text-ink">Admin / Debug</summary>
      <div className="mt-4 grid gap-4">
        <pre className="max-h-[420px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {JSON.stringify({ scan, profile }, null, 2)}
        </pre>
      </div>
    </details>
  );
}

export default async function ReportPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { access?: string; unlock?: string };
}) {
  const scan = await getScan(params.id);
  if (!scan) notFound();

  const profileRecord = await getCompanyProfile(scan.id);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
  const signals = await listScanOpportunitySignals(scan.id);
  const moveForwardSignals = signals
    .filter((signal) => classifyOpportunity(signal, profile).show_in_report)
    .sort(
      (a, b) =>
        classifyOpportunity(b, profile).actionability_score -
        classifyOpportunity(a, profile).actionability_score
    );
  const fallbackSignals = signals.slice(0, 6);
  const reportSignals = moveForwardSignals.length > 0 ? moveForwardSignals : fallbackSignals;
  const isAdminView = searchParams?.access === "admin";
  const isPaid =
    isAdminView ||
    searchParams?.access === "paid" ||
    searchParams?.access === "full" ||
    scan.report_access === "unlocked" ||
    scan.report_access === "admin";
  const visibleCount = isPaid ? reportSignals.length : visibleSignalCount(reportSignals.length);
  const displayedSignals = reportSignals.slice(0, visibleCount);
  const lockedSignals = reportSignals.slice(visibleCount);

  return (
    <main className="min-h-screen bg-field px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <ReportHeader
          scan={scan}
          profile={profile}
          totalSignals={signals.length}
          visibleSignals={displayedSignals.length}
          lockedSignals={lockedSignals.length}
          isPaid={isPaid}
        />

        {searchParams?.unlock === "placeholder" ? (
          <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
            Payment is not connected yet. This placeholder represents the $99 unlock flow and full-report state.
          </section>
        ) : null}

        {scan.status === "failed" ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {scan.error_message || "The scan failed."}
          </section>
        ) : null}

        <ExecutiveSummaryCard signals={reportSignals} profile={profile} />
        <OpportunityProfileModule scan={scan} profile={profile} />
        <ScreeningSummary
          allSignals={signals}
          reportSignals={reportSignals}
          profile={profile}
        />

        {displayedSignals.length > 0 ? (
          <>
            <OpportunityActionTable
              scanId={scan.id}
              signals={displayedSignals}
              isPaid={isPaid}
              profile={profile}
            />

            <section className="grid gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Visible Opportunity Signals</h2>
                <p className="mt-2 text-sm text-muted">Concise signal cards for fast review before opening row details.</p>
              </div>
              <div className="grid gap-4">
                {displayedSignals.map((signal) => (
                  <OpportunitySignalCard key={signal.id} scanId={scan.id} signal={signal} isPaid={isPaid} profile={profile} />
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
              No strong external signals yet
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              No strong external opportunity signals were found in the scanned sources. Recommended next step:
              broaden company context, add active connector credentials, or run human analyst review.
            </p>
          </section>
        )}

        {!isPaid && lockedSignals.length > 0 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Locked Opportunity Teasers</h2>
              <p className="mt-2 text-sm text-muted">{lockedSignals.length} additional signal(s) are available in the full scan.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {lockedSignals.slice(0, 4).map((signal) => (
                <LockedOpportunityCard key={signal.id} signal={signal} profile={profile} />
              ))}
            </div>
          </section>
        ) : null}

        {!isPaid ? <UnlockCTA /> : null}

        {isPaid ? (
          <>
            <PursuitPlan signals={reportSignals} profile={profile} />
            <BuyerPartnerTable signals={reportSignals} />
            <ActionPlan signals={reportSignals} />
            <section className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">Workflow Actions</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Use each table row to send a workflow-ready opportunity payload to your webhook.
                PDF/export is available from the report header.
              </p>
            </section>
          </>
        ) : null}

        <SourcesScanned profile={profile} signals={signals} />

        {isAdminView ? <AdminDebug profile={profile} scan={scan} /> : null}
      </div>
    </main>
  );
}
