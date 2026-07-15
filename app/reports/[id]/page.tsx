import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Badge, CompanyLogo, LockedBadge, OpportunityScannerLogo } from "@/components/brand";
import { SendToWorkflowModal } from "@/components/workflow";
import { getCompanyProfile, getScan, listScanOpportunitySignals } from "@/lib/storage";
import { CompanyProfile, ScanRecord, StoredOpportunitySignal } from "@/lib/types";
import { accessSuffix, hasAdminAccess, reportAccessHref } from "@/lib/access";
import { hasCustomerServerReportAccess, hasServerReportAccess, verifyReportCheckoutHandoff } from "@/lib/payments/access";
import { getStripeServerConfig } from "@/lib/payments/config";
import { claimActiveReportPurchaseByEmail } from "@/lib/payments/persistence";
import { PurchaseCompletedAnalytics, ReportAnalytics } from "@/components/page-analytics";
import { ReportMonitorCheckout } from "@/components/report-monitor-checkout";
import { signalLane } from "@/lib/actionability";
import { contactDiscoverySummary, contactTargetsForSignal } from "@/lib/contactTargeting";
import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { opportunityActionFor } from "@/lib/opportunityAction";
import { classificationLabel } from "@/lib/opportunityClassification";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { sourceCatalog } from "@/lib/sourceRegistry";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { ensureCustomerAccount, loadDashboardSummary, loadOwnedMonitoringComparisonPair } from "@/lib/dashboard/repository";
import {
  buildWorkflowPayload,
  opportunityHeadline,
  revenueMotionLabel,
  sourceTypeLabel
} from "@/lib/workflowPayload";
import { configuredSupportEmail } from "@/lib/support";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function primaryActionLabel(signal: StoredOpportunitySignal, profile?: CompanyProfile): string {
  const classification = opportunityActionFor(signal, profile);
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

function reportStatusLabel(status: ScanRecord["status"]): string {
  const labels: Record<ScanRecord["status"], string> = {
    queued: "Queued",
    scraping: "Scanning website",
    profiling: "Building profile",
    discovering: "Finding opportunities",
    completed: "Report ready",
    failed: "Needs retry"
  };
  return labels[status] ?? "In progress";
}

const IN_PROGRESS_SCAN_COPY: Record<
  Exclude<ScanRecord["status"], "completed" | "failed">,
  { heading: string; detail: string }
> = {
  queued: {
    heading: "Your scan is queued",
    detail: "We have your company details and will begin reviewing the website shortly."
  },
  scraping: {
    heading: "We are reading the company website",
    detail: "We are gathering the business context needed to search the right public-sector sources."
  },
  profiling: {
    heading: "We are building the opportunity profile",
    detail: "We are translating the company, customer, and market context into a focused public-sector search."
  },
  discovering: {
    heading: "We are checking public-sector sources",
    detail: "We are reviewing source-backed signals and deciding which opportunities are useful enough to include."
  }
};

function scanSupportHref(scan: ScanRecord): string {
  const email = configuredSupportEmail();
  const subject = "Help with an Opportunity Scanner scan";
  const body = [
    "Hi Opportunity Scanner support,",
    "",
    "I need help retrying an Opportunity Scanner scan.",
    "",
    `Company URL: ${scan.company_url}`,
    `Scan ID: ${scan.id}`,
    ""
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function ReportScanState({
  scan,
  isAdminView
}: {
  scan: ScanRecord;
  isAdminView: boolean;
}) {
  if (scan.status === "completed") return null;

  const companyName = scan.company_name || hostname(scan.company_url);
  const progress = scan.status === "failed" ? null : IN_PROGRESS_SCAN_COPY[scan.status];

  return (
    <main className="min-h-screen bg-field px-4 py-5 sm:px-6 sm:py-8">
      <ReportAnalytics
        scanId={scan.id}
        status={scan.status}
        tier="free"
        signalCount={0}
        createdAt={scan.created_at}
        completedAt={scan.completed_at}
      />
      <div className="mx-auto grid max-w-3xl gap-6">
        <header className="rounded-lg border border-line bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <OpportunityScannerLogo />
            <a
              href="/dashboard"
              className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent"
            >
              Dashboard
            </a>
          </div>
          <div className="mt-8 flex min-w-0 flex-wrap items-center gap-4">
            <CompanyLogo name={companyName} logoUrl={companyLogoUrl(scan.company_url)} />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold text-ink sm:text-3xl">{companyName}</h1>
              <p className="mt-1 break-all text-sm text-muted">{scan.company_url}</p>
            </div>
          </div>
        </header>

        {progress === null ? (
          <section className="rounded-lg border border-red-200 bg-white p-5 sm:p-6" aria-labelledby="failed-scan-heading">
            <Badge tone="amber">{reportStatusLabel(scan.status)}</Badge>
            <h2 id="failed-scan-heading" className="mt-4 text-xl font-semibold text-ink">
              This scan could not be completed
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Start a fresh scan with the saved company context, or contact support if the website
              continues to fail.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`/dashboard/new?from=${encodeURIComponent(scan.id)}`}
                className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                Retry scan
              </a>
              <a
                href={scanSupportHref(scan)}
                className="rounded-md border border-line px-4 py-3 text-sm font-semibold text-ink hover:text-accent"
              >
                Contact support
              </a>
            </div>
            {isAdminView && scan.error_message ? (
              <details className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                <summary className="cursor-pointer text-sm font-semibold">Admin failure detail</summary>
                <p className="mt-2 text-xs leading-5">{scan.error_message}</p>
              </details>
            ) : null}
          </section>
        ) : (
          <section
            className="rounded-lg border border-cyan-100 bg-white p-5 sm:p-6"
            aria-labelledby="in-progress-scan-heading"
            aria-live="polite"
          >
            <Badge tone="blue">{reportStatusLabel(scan.status)}</Badge>
            <h2 id="in-progress-scan-heading" className="mt-4 text-xl font-semibold text-ink">
              {progress.heading}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">{progress.detail}</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              The opportunity report will appear here when the scan is complete.
            </p>
            <a
              href={`/reports/${encodeURIComponent(scan.id)}`}
              className="mt-5 inline-flex rounded-md border border-line px-4 py-3 text-sm font-semibold text-ink hover:text-accent"
            >
              Check status
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

function fullReportRequestHref(scan: ScanRecord, signal?: StoredOpportunitySignal): string {
  const email = configuredSupportEmail();
  const subject = "Full Opportunity Scanner report request";
  const body = [
    "Hi Opportunity Scanner support,",
    "",
    "I would like full access to this Opportunity Scanner report.",
    "",
    `Company URL: ${scan.company_url}`,
    `Scan ID: ${scan.id}`,
    signal ? `Opportunity: ${opportunityHeadline(signal)}` : "",
    "",
    "Please send the full opportunity pipeline, source links, contact paths, CRM-ready notes, outreach angles, and workflow/export access.",
    ""
  ]
    .filter(Boolean)
    .join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function paidReportClaimSupportHref(scanId: string): string {
  const subject = "Help claiming a purchased Opportunity Scanner report";
  const body = [
    "Hi Opportunity Scanner support,",
    "",
    "I signed in with my purchase email but could not claim my full report.",
    "",
    `Report ID: ${scanId}`
  ].join("\n");
  return `mailto:${configuredSupportEmail()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function reportCheckoutIsConfigured(): boolean {
  try {
    getStripeServerConfig();
    return true;
  } catch {
    return false;
  }
}

function subscriptionCheckoutIsConfigured(): boolean {
  try {
    return getStripeServerConfig().subscriptionCheckoutEnabled;
  } catch {
    return false;
  }
}

function fullReportUpgradeHref(scan: ScanRecord, signal?: StoredOpportunitySignal): string {
  if (reportCheckoutIsConfigured()) {
    return `/pricing?source=report_gate&scanId=${encodeURIComponent(scan.id)}`;
  }
  return fullReportRequestHref(scan, signal);
}

function actionabilityDisplayLabel(value: string): string {
  if (value === "Strong") return "High Actionability";
  if (value === "Medium") return "Medium Actionability";
  if (value === "Research" || value === "Screened out" || value === "Low") return "Low Actionability";
  return value;
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
    bestNextAction: best ? opportunityActionFor(best, profile).next_best_action : "Run a broader scan or review source coverage."
  };
}

function ReportHeader({
  scan,
  profile,
  totalSignals,
  visibleSignals,
  lockedSignals,
  isPaid,
  access,
  comparisonHref
}: {
  scan: ScanRecord;
  profile?: CompanyProfile;
  totalSignals: number;
  visibleSignals: number;
  lockedSignals: number;
  isPaid: boolean;
  access?: string;
  comparisonHref?: string | null;
}) {
  const companyName = profile?.company_name || scan.company_name || hostname(scan.company_url);
  const accessQuery = access ? `?access=${encodeURIComponent(access)}` : "";
  const packageBase = `/api/reports/${scan.id}/outreach-package${accessQuery}`;

  return (
    <header className="rounded-lg border border-line bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <OpportunityScannerLogo />
        <div className="flex flex-wrap gap-2">
          <a href="/dashboard" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">
            Dashboard
          </a>
          <a href={`/dashboard/new?from=${encodeURIComponent(scan.id)}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">
            Run Free Preview
          </a>
          {comparisonHref ? (
            <a href={comparisonHref} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent">
              Compare Changes
            </a>
          ) : null}
          {isPaid ? (
            <>
              <a
                href={`/api/reports/${scan.id}/export${accessQuery}`}
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent"
              >
                Report CSV
              </a>
              <a
                href={packageBase}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                Outreach CSV
              </a>
              <a
                href={`${packageBase}${accessQuery ? "&" : "?"}format=md`}
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink hover:text-accent"
              >
                Outreach MD
              </a>
            </>
          ) : (
            <span className="rounded-md border border-line bg-field px-3 py-2 text-sm font-semibold text-muted">
              Outreach package locked
            </span>
          )}
        </div>
      </div>
      <div className="mt-8 flex min-w-0 flex-wrap items-center gap-4">
        <CompanyLogo name={companyName} logoUrl={companyLogoUrl(scan.company_url)} />
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-ink sm:text-3xl">{companyName}</h1>
          <p className="mt-1 break-all text-sm text-muted">{scan.company_url}</p>
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
          <p className="text-xs font-semibold uppercase text-muted">Pipeline rows found</p>
          <p className="mt-1 text-sm font-semibold text-ink">{totalSignals}</p>
        </div>
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Rows shown</p>
          <p className="mt-1 text-sm font-semibold text-ink">{visibleSignals}</p>
        </div>
        {!isPaid ? (
          <div className="rounded-md border border-line bg-field p-3">
            <p className="text-xs font-semibold uppercase text-muted">Locked rows</p>
            <p className="mt-1 text-sm font-semibold text-ink">{lockedSignals}</p>
          </div>
        ) : (
          <div className="rounded-md border border-line bg-field p-3">
            <p className="text-xs font-semibold uppercase text-muted">Full access</p>
            <p className="mt-1 text-sm font-semibold text-ink">Enabled</p>
          </div>
        )}
        <div className="rounded-md border border-line bg-field p-3">
          <p className="text-xs font-semibold uppercase text-muted">Status</p>
          <p className="mt-1 text-sm font-semibold text-ink">{reportStatusLabel(scan.status)}</p>
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
        <Badge tone={summary.confidence >= 75 ? "green" : "blue"}>
          {summary.confidence >= 75 ? "Source-backed" : "Needs review"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <div className="rounded-md border border-line bg-field p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase text-muted">Top opportunity pattern</p>
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

type ContactLookupAccess = {
  hasGrowthPlan: boolean;
  creditBalance: {
    entitled: boolean;
    limit: number;
    remaining: number;
  } | null;
};

function GrowthContactLookupControl({
  scanId,
  opportunityId,
  eligible,
  isPaid,
  lookupAccess,
  access
}: {
  scanId: string;
  opportunityId: string;
  eligible: boolean;
  isPaid: boolean;
  lookupAccess: ContactLookupAccess;
  access?: string;
}) {
  if (!eligible) {
    return (
      <p className="rounded-md border border-line bg-field px-3 py-2 text-xs leading-5 text-muted">
        Use the source-native contact path for this row. Person-level lookup is reserved for
        eligible private-organization targets.
      </p>
    );
  }

  if (!isPaid || !lookupAccess.hasGrowthPlan) {
    return (
      <p className="rounded-md border border-line bg-field px-3 py-2 text-xs leading-5 text-muted">
        <span className="font-semibold text-ink">Person-level contact lookup is Growth-only.</span>{" "}
        Full report and Monitor access still include the source-native contact path, suggested
        roles, and next action.
      </p>
    );
  }

  const creditBalance = lookupAccess.creditBalance;
  if (!creditBalance || !creditBalance.entitled) {
    return (
      <p className="rounded-md border border-line bg-field px-3 py-2 text-xs leading-5 text-muted">
        Growth contact credit balance is temporarily unavailable. No lookup can be submitted and
        the source-native contact path remains available.
      </p>
    );
  }

  if (creditBalance.remaining <= 0) {
    return (
      <p className="rounded-md border border-line bg-field px-3 py-2 text-xs leading-5 text-muted">
        <span className="font-semibold text-ink">Growth credits:</span> 0 of {creditBalance.limit}{" "}
        remaining this billing month. The source-native contact path remains available.
      </p>
    );
  }

  return (
    <div className="rounded-md border border-line bg-field p-3">
      <p className="text-xs leading-5 text-muted">
        <span className="font-semibold text-ink">Growth credits:</span> {creditBalance.remaining} of{" "}
        {creditBalance.limit} remaining this billing month. This person-level lookup can use one
        credit and may not return a verified contact.
      </p>
      <form action="/api/opportunities/enrich" method="post" className="mt-2">
        <input type="hidden" name="scanId" value={scanId} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="enrichmentType" value="find_contacts" />
        {access ? <input type="hidden" name="access" value={access} /> : null}
        <button className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent">
          Run Growth Contact Lookup
        </button>
      </form>
    </div>
  );
}

function PrimaryActionButton({
  scanId,
  signal,
  profile,
  isPaid,
  access
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile;
  isPaid: boolean;
  access?: string;
}) {
  const classification = opportunityActionFor(signal, profile);
  const label = primaryActionLabel(signal, profile);
  const opensSource =
    isPaid &&
    signal.source_url &&
    ["Review solicitation", "Check eligibility", "Monitor signal"].includes(label);
  const href = opensSource ? signal.source_url : `/opportunities/${signal.id}?scanId=${scanId}${accessSuffix(access)}`;

  return (
    <a
      href={href}
      target={opensSource ? "_blank" : undefined}
      rel={opensSource ? "noreferrer" : undefined}
      className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0A6871]"
      title={classification.manual_research_instruction}
    >
      {label}
    </a>
  );
}

function OpportunityProfileModule({
  scan,
  profile,
  isAdminView,
  access
}: {
  scan: ScanRecord;
  profile?: CompanyProfile;
  isAdminView: boolean;
  access?: string;
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
          <h2 className="text-lg font-semibold text-ink">How we mapped your business</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            We translated your website into public-sector buying language. These inputs shape the
            targets, contact paths, revenue motions, and recommended actions in this report.
          </p>
        </div>
        {isAdminView ? (
          <a
            href={`/profiles/${scan.id}?access=${encodeURIComponent(access ?? "")}`}
            className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Refine Profile
          </a>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Products / services mapped</h3>
          <ChipList items={products} empty="No product cues available yet." />
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
          <ChipList items={buyerTypes} empty="No buyer or partner cues available yet." />
        </div>
        <div className="rounded-md border border-line bg-field p-4">
          <h3 className="text-sm font-semibold text-ink">Priority lanes</h3>
          <ChipList items={priorities} empty="No priority lanes selected." />
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
  profile,
  lookupAccess,
  access
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  isPaid: boolean;
  profile?: CompanyProfile;
  lookupAccess: ContactLookupAccess;
  access?: string;
}) {
  const classification = opportunityActionFor(signal, profile);
  const buyer = signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review";

  return (
    <div className="grid gap-4 border-t border-line bg-field p-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Why it matters</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{signal.why_it_matters}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Source-backed evidence</h3>
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
          <h3 className="text-sm font-semibold text-ink">CRM-ready note</h3>
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
            <PrimaryActionButton scanId={scanId} signal={signal} profile={profile} isPaid={isPaid} access={access} />
            <SendToWorkflowModal
              payload={buildWorkflowPayload({ scanId, signal, profile, includeSourceUrl: isPaid })}
              locked={!isPaid}
              access={access}
            />
            <GrowthContactLookupControl
              scanId={scanId}
              opportunityId={signal.id}
              eligible={["enrich_company_domain", "contact_award_recipient"].includes(classification.contact_strategy)}
              isPaid={isPaid}
              lookupAccess={lookupAccess}
              access={access}
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
  profile,
  lookupAccess,
  access
}: {
  scanId: string;
  signals: StoredOpportunitySignal[];
  isPaid: boolean;
  profile?: CompanyProfile;
  lookupAccess: ContactLookupAccess;
  access?: string;
}) {
  return (
    <section className="hidden overflow-hidden rounded-lg border border-line bg-white shadow-sm md:block">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Opportunity Action Table</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use these rows to move from public evidence to a target account, contact path, next
            action, CRM note, outreach angle, and workflow-ready handoff.
          </p>
        </div>
        <Badge tone="blue">{signals.length} rows shown</Badge>
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
              const classification = opportunityActionFor(signal, profile);
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
                          lookupAccess={lookupAccess}
                          access={access}
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
                    <Badge tone={badgeTone(classification.actionability_label)}>
                      {actionabilityDisplayLabel(classification.actionability_label)}
                    </Badge>
                    <p className="mt-2 leading-6">{classification.next_best_action}</p>
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
                      <PrimaryActionButton scanId={scanId} signal={signal} profile={profile} isPaid={isPaid} access={access} />
                      <SendToWorkflowModal
                        payload={buildWorkflowPayload({ scanId, signal, profile, includeSourceUrl: isPaid })}
                        locked={!isPaid}
                        access={access}
                      />
                      <GrowthContactLookupControl
                        scanId={scanId}
                        opportunityId={signal.id}
                        eligible={["enrich_company_domain", "contact_award_recipient"].includes(classification.contact_strategy)}
                        isPaid={isPaid}
                        lookupAccess={lookupAccess}
                        access={access}
                      />
                      <p className="text-xs leading-5 text-muted">
                        {classification.workflow_payload_ready ? "Workflow ready" : "Needs source check before workflow send"}
                      </p>
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
          Unlock the full report to send buyer and partner opportunities to Zapier, Make, n8n,
          HubSpot workflows, Airtable, or your CRM.
        </p>
      ) : null}
    </section>
  );
}

function OpportunitySignalCard({
  scanId,
  signal,
  isPaid,
  profile,
  lookupAccess,
  access
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  isPaid: boolean;
  profile?: CompanyProfile;
  lookupAccess: ContactLookupAccess;
  access?: string;
}) {
  const classification = opportunityActionFor(signal, profile);
  return (
    <article className="rounded-lg border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap gap-2">
        <Badge tone={badgeTone(classification.actionability_label)}>
          {actionabilityDisplayLabel(classification.actionability_label)}
        </Badge>
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
        <a href={`/opportunities/${signal.id}?scanId=${scanId}${accessSuffix(access)}`} className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink">
          View action path
        </a>
      </div>
      <div className="mt-3 grid gap-2 [&>*]:w-full [&_button]:w-full [&_form]:w-full">
        <PrimaryActionButton scanId={scanId} signal={signal} profile={profile} isPaid={isPaid} access={access} />
        <SendToWorkflowModal
          payload={buildWorkflowPayload({ scanId, signal, profile, includeSourceUrl: isPaid })}
          locked={!isPaid}
          access={access}
        />
        <GrowthContactLookupControl
          scanId={scanId}
          opportunityId={signal.id}
          eligible={["enrich_company_domain", "contact_award_recipient"].includes(classification.contact_strategy)}
          isPaid={isPaid}
          lookupAccess={lookupAccess}
          access={access}
        />
      </div>
    </article>
  );
}

function LockedOpportunityCard({
  scan,
  signal,
  profile
}: {
  scan: ScanRecord;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile;
}) {
  const classification = opportunityActionFor(signal, profile);
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
        Unlock the full report to see the buyer or partner target, source link, contact path,
        CRM-ready note, outreach angle, and workflow-ready payload.
      </p>
      <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-3">
        <p>{classificationLabel(classification.buyer_partner_type)} in full report</p>
        <p>{classification.source_status}</p>
        <p>{classificationLabel(classification.contact_strategy)} in full report</p>
      </div>
      <a href={fullReportUpgradeHref(scan, signal)} className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
        {reportCheckoutIsConfigured() ? "Buy Full Report" : "Request Full Pipeline"}
      </a>
    </article>
  );
}

function UnlockCTA({ scan }: { scan: ScanRecord }) {
  const items = [
    "all prioritized opportunities",
    "buyer/partner targets",
    "source-backed evidence",
    "contact paths",
    "CRM-ready notes",
    "outreach angles",
    "workflow-ready payloads",
    "CSV and Markdown exports"
  ];
  return (
    <section className="rounded-lg border border-cyan-100 bg-mist p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Unlock the full opportunity pipeline</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink">
            Get the full workflow-ready pipeline: prioritized opportunities, buyer and partner
            targets, source-backed evidence, contact paths, CRM-ready notes, outreach angles, and
            workflow-ready payloads.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {items.map((item) => (
              <Badge key={item} tone="blue">{item}</Badge>
            ))}
          </div>
        </div>
        <div className="w-full rounded-lg border border-cyan-100 bg-white p-4 text-center sm:w-auto">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Full report</p>
          <p className="mt-1 text-2xl font-semibold text-ink">$49 one-time</p>
          <a href={fullReportUpgradeHref(scan)} className="mt-3 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            {reportCheckoutIsConfigured() ? "Buy Full Report" : "Request Full Report"}
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
          <span className="font-semibold text-ink">1. Prioritize the highest actionability rows.</span> Start with opportunities that have a clear buyer, source evidence, and near-term timing.
        </li>
        <li className="rounded-md border border-line bg-field p-4">
          <span className="font-semibold text-ink">2. Validate contact paths.</span> Use source-native contacts first. Growth-only person lookup can support eligible private-organization targets after the route and roles are verified.
        </li>
        <li className="rounded-md border border-line bg-field p-4">
          <span className="font-semibold text-ink">3. Push selected opportunities to workflow.</span> Create CRM deals, account research tasks, or outreach queues from the workflow-ready row.
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
  const classification = opportunityActionFor(signal, profile);
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
            The full report groups opportunities by the likely next move, so the pipeline is
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
                  const classification = opportunityActionFor(signal, profile);
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
              <p className="mt-3 text-sm leading-6 text-muted">No shown opportunities in this action path.</p>
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
      const classification = opportunityActionFor(signal, profile);
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
            The scan starts with public-source matches, then promotes the rows with the clearest
            timing, buyer clarity, and revenue fit into the action table.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{allSignals.length} source-backed matches</Badge>
          <Badge tone="green">{reportSignals.length} table rows</Badge>
          <Badge tone="amber">{screenedOut.length} lower-priority matches</Badge>
        </div>
      </div>
      {screenedOut.length > 0 ? (
        <details className="mt-4 rounded-md border border-line bg-field p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Why some matches were lower priority</summary>
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
        <summary className="cursor-pointer text-sm font-semibold text-ink">Source coverage</summary>
        <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-3">
          <p><span className="font-semibold text-ink">Public-source focus:</span> {(profile?.activated_source_categories ?? []).join(", ") || "General public-sector coverage"}</p>
          <p><span className="font-semibold text-ink">Sources with evidence:</span> {Object.keys(sourceCounts).join(", ") || "No source-backed rows available yet"}</p>
          <p><span className="font-semibold text-ink">Opportunity rows reviewed:</span> {signals.length}</p>
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
  searchParams?: {
    access?: string;
    unlock?: string;
    checkout?: string;
    session_id?: string;
    purchase?: string;
    claim?: string;
  };
}) {
  const scan = await getScan(params.id);
  if (!scan) notFound();

  const isAdminView = hasAdminAccess(searchParams?.access, scan);
  if (scan.status !== "completed") {
    return <ReportScanState scan={scan} isAdminView={isAdminView} />;
  }

  let customerSession: Awaited<ReturnType<typeof resolveCustomerSession>> = null;
  try {
    customerSession = await resolveCustomerSession(getCustomerAuthConfig(), cookies());
  } catch {
    customerSession = null;
  }
  const customerAccount = customerSession?.user.email && customerSession.user.email_confirmed_at
    ? await ensureCustomerAccount(customerSession.user.id, customerSession.user.email).catch(() => null)
    : null;
  if (searchParams?.claim === "paid") {
    if (!customerSession?.user.email || !customerAccount) {
      redirect(`/auth/sign-in?next=${encodeURIComponent(`/reports/${scan.id}?claim=paid`)}`);
    }
    const claimed = await claimActiveReportPurchaseByEmail({
      authUserId: customerSession.user.id,
      accountId: customerAccount.id,
      scanId: scan.id
    }).catch(() => false);
    redirect(`/reports/${scan.id}?${claimed ? "purchase=report" : "claim=failed"}`);
  }
  const storedAccess = await hasServerReportAccess(searchParams?.access, scan);
  if (storedAccess && searchParams?.session_id) {
    redirect(reportAccessHref(`/reports/${scan.id}`, searchParams.access));
  }
  const checkoutHandoffFulfilled =
    !storedAccess && searchParams?.checkout === "success"
      ? await verifyReportCheckoutHandoff(
          scan.id,
          searchParams.session_id,
          customerAccount ? { authUserId: customerSession!.user.id, accountId: customerAccount.id } : undefined
        )
      : false;
  if (checkoutHandoffFulfilled) {
    redirect(reportAccessHref(`/reports/${scan.id}?purchase=report`, searchParams?.access));
  }
  let comparisonHref: string | null = null;
  let hasActiveMonitoringPlan = false;
  let hasActiveGrowthPlan = false;
  let growthCreditBalance: ContactLookupAccess["creditBalance"] = null;
  if (customerSession?.user.email) {
    const [pair, dashboardSummary] = await Promise.all([
      loadOwnedMonitoringComparisonPair(customerSession.user.id, scan.id).catch(() => null),
      loadDashboardSummary(customerSession.user.id).catch(() => null)
    ]);
    if (pair) comparisonHref = `/dashboard/compare/${scan.id}`;
    hasActiveMonitoringPlan = Boolean(
      dashboardSummary?.billing.subscriptions.some(
        (subscription) =>
          Boolean(subscription.product && ["monitor", "growth"].includes(subscription.product)) &&
          ["active", "trialing"].includes(subscription.status)
      )
    );
    hasActiveGrowthPlan = Boolean(
      dashboardSummary?.billing.subscriptions.some(
        (subscription) =>
          subscription.product === "growth" && ["active", "trialing"].includes(subscription.status)
      )
    );
    if (hasActiveGrowthPlan && dashboardSummary) {
      growthCreditBalance = dashboardSummary.enrichmentCredits;
    }
  }
  const isPaid = storedAccess || await hasCustomerServerReportAccess(
    searchParams?.access,
    scan,
    customerSession?.user.id
  );

  const profileRecord = await getCompanyProfile(scan.id);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
  const signals = await listScanOpportunitySignals(scan.id);
  const moveForwardSignals = signals
    .filter((signal) => opportunityActionFor(signal, profile).show_in_report)
    .sort(
      (a, b) =>
        opportunityActionFor(b, profile).actionability_score -
        opportunityActionFor(a, profile).actionability_score
    );
  const fallbackSignals = signals.slice(0, 6);
  const reportSignals = moveForwardSignals.length > 0 ? moveForwardSignals : fallbackSignals;
  const visibleCount = isPaid ? reportSignals.length : visibleSignalCount(reportSignals.length);
  const displayedSignals = reportSignals.slice(0, visibleCount);
  const lockedSignals = reportSignals.slice(visibleCount);
  const showReportMonitorUpsell =
    isPaid &&
    !isAdminView &&
    !hasActiveMonitoringPlan &&
    subscriptionCheckoutIsConfigured();
  const reportCompanyName = profile?.company_name || scan.company_name || hostname(scan.company_url);
  const contactLookupAccess: ContactLookupAccess = {
    hasGrowthPlan: hasActiveGrowthPlan,
    creditBalance: growthCreditBalance
  };

  return (
    <main className="min-h-screen bg-field px-4 py-5 sm:px-6 sm:py-8">
      <ReportAnalytics
        scanId={scan.id}
        status={scan.status}
        tier={isPaid ? "full" : "free"}
        signalCount={reportSignals.length}
        createdAt={scan.created_at}
        completedAt={scan.completed_at}
      />
      {searchParams?.purchase === "report" && isPaid ? (
        <PurchaseCompletedAnalytics plan="full_report" billingPeriod="one_time" eventKey={`report:${scan.id}`} />
      ) : null}
      <div className="mx-auto grid max-w-7xl gap-6">
        <ReportHeader
          scan={scan}
          profile={profile}
          totalSignals={signals.length}
          visibleSignals={displayedSignals.length}
          lockedSignals={lockedSignals.length}
          isPaid={isPaid}
          access={searchParams?.access}
          comparisonHref={comparisonHref}
        />

        {searchParams?.purchase === "report" && isPaid ? (
          <section
            role="status"
            aria-live="polite"
            className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-ink"
          >
            <h2 className="text-base font-semibold text-emerald-950">Purchase complete - your full report is unlocked</h2>
            <p className="mt-1 text-emerald-900">
              All qualified opportunity rows, source links, contact paths, next actions, CRM notes,
              outreach angles, and exports are now available for this report.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href="#full-pipeline" className="rounded-md bg-emerald-800 px-3 py-2 font-semibold text-white hover:bg-emerald-900">
                View full pipeline
              </a>
              <a href="/dashboard" className="rounded-md border border-emerald-300 bg-white px-3 py-2 font-semibold text-emerald-950 hover:border-emerald-500">
                Dashboard
              </a>
              <a href={`/dashboard/new?from=${encodeURIComponent(scan.id)}`} className="rounded-md border border-emerald-300 bg-white px-3 py-2 font-semibold text-emerald-950 hover:border-emerald-500">
                Run another report
              </a>
            </div>
          </section>
        ) : null}

        {searchParams?.checkout === "cancelled" ? (
          <section
            id="checkout-return"
            aria-live="polite"
            className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-ink"
          >
            <h2 className="text-base font-semibold text-ink">No charge was made</h2>
            <p className="mt-1 text-slate-700">
              Your report preview is still here. You can keep reviewing it or return to secure
              checkout when you are ready.
            </p>
            <a
              href={`/pricing?source=checkout_return&scanId=${encodeURIComponent(scan.id)}`}
              className="mt-3 inline-flex font-semibold text-accent underline decoration-accent/30 underline-offset-4"
            >
              Return to report checkout
            </a>
          </section>
        ) : null}

        {searchParams?.claim === "failed" ? (
          <section
            aria-live="polite"
            className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-ink"
          >
            <h2 className="text-base font-semibold text-ink">We could not match this purchase</h2>
            <p className="mt-1 text-slate-700">
              Sign in with the exact email used at checkout. If that address is already correct,
              support can verify the purchase without asking you to send payment details.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <form action="/api/auth/sign-out" method="post">
                <input
                  type="hidden"
                  name="next"
                  value={`/auth/sign-in?next=${encodeURIComponent(`/reports/${scan.id}?claim=paid`)}`}
                />
                <button type="submit" className="rounded-md bg-ink px-3 py-2 font-semibold text-white hover:bg-accent">
                  Sign out and use purchase email
                </button>
              </form>
              <a
                href={paidReportClaimSupportHref(scan.id)}
                className="font-semibold text-accent underline decoration-accent/30 underline-offset-4"
              >
                Contact support
              </a>
            </div>
          </section>
        ) : null}

        {searchParams?.unlock === "placeholder" ? (
          <section className="rounded-lg border border-cyan-100 bg-mist p-5 text-sm leading-6 text-ink">
            Full-report access is in beta. We will review the scan and follow up with the full
            opportunity pipeline, source links, contact paths, CRM notes, outreach angles, and
            workflow-ready export.
          </section>
        ) : null}

        <ExecutiveSummaryCard signals={reportSignals} profile={profile} />

        {showReportMonitorUpsell ? (
          <ReportMonitorCheckout
            companyName={reportCompanyName}
            defaultEmail={customerSession?.user.email}
            scanId={scan.id}
          />
        ) : null}

        {displayedSignals.length > 0 ? (
          <>
            <div id="full-pipeline" className="scroll-mt-24" aria-hidden="true" />
            <OpportunityActionTable
              scanId={scan.id}
              signals={displayedSignals}
              isPaid={isPaid}
              profile={profile}
              lookupAccess={contactLookupAccess}
              access={searchParams?.access}
            />
            <section className="grid gap-4 md:hidden">
              <div>
                <h2 className="text-lg font-semibold text-ink">Opportunity Pipeline</h2>
                <p className="mt-2 text-sm text-muted">Review each signal, take the next action, or send it into your workflow.</p>
              </div>
              <div className="grid gap-4">
                {displayedSignals.map((signal) => (
                  <OpportunitySignalCard
                    key={signal.id}
                    scanId={scan.id}
                    signal={signal}
                    isPaid={isPaid}
                    profile={profile}
                    lookupAccess={contactLookupAccess}
                    access={searchParams?.access}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
              No workflow-ready opportunities yet
            </h2>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              No strong source-backed opportunities were found in the scanned public sources.
              Recommended next step: broaden the company context, add more source coverage, or
              request analyst review.
            </p>
          </section>
        )}

        <OpportunityProfileModule
          scan={scan}
          profile={profile}
          isAdminView={isAdminView}
          access={searchParams?.access}
        />
        <ScreeningSummary
          allSignals={signals}
          reportSignals={reportSignals}
          profile={profile}
        />

        {!isPaid && lockedSignals.length > 0 ? (
          <section className="grid gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Full Pipeline Preview</h2>
              <p className="mt-2 text-sm text-muted">{lockedSignals.length} additional opportunity row(s) are available in the full report.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {lockedSignals.slice(0, 4).map((signal) => (
                  <LockedOpportunityCard key={signal.id} scan={scan} signal={signal} profile={profile} />
              ))}
            </div>
          </section>
        ) : null}

        {!isPaid ? <UnlockCTA scan={scan} /> : null}

        {isPaid ? (
          <>
            <PursuitPlan signals={reportSignals} profile={profile} />
            <BuyerPartnerTable signals={reportSignals} />
            <ActionPlan signals={reportSignals} />
            <section className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg font-semibold text-ink">Workflow Actions</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Use each table row to send a workflow-ready opportunity to your webhook.
                CSV and Markdown exports are available from the report header.
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
