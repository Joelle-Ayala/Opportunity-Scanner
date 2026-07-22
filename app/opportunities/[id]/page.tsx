import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getScan,
  listOpportunityEnrichmentRequests
} from "@/lib/storage";
import { signalDate, signalLane } from "@/lib/actionability";
import { contactDiscoverySummary, contactTargetsForSignal, primaryContactTarget } from "@/lib/contactTargeting";
import { opportunityActionFor } from "@/lib/opportunityAction";
import { classificationLabel } from "@/lib/opportunityClassification";
import { loadEnrichmentCreditBalance, type EnrichmentCreditBalance } from "@/lib/enrichmentCredits";
import { enrichmentEligibilityForTarget, resolvePrimaryTargetForSignal } from "@/lib/organizationResolution";
import { OpportunityEnrichmentRequestRecord, StoredOpportunitySignal, type CompanyProfile } from "@/lib/types";
import { resolveRequestReportAccess } from "@/lib/payments/requestAccess";
import { getCompletedReportReadiness } from "@/lib/reportReadiness";
import { configuredSupportEmail } from "@/lib/support";
import { sourceEvidenceText } from "@/lib/reportText";
import { getCustomerAuthConfig, resolveCustomerPageSession } from "@/lib/customer-auth";
import { canManageCustomerPursuit, loadCustomerPursuitForOpportunity } from "@/lib/dashboard/pursuits";
import { pursuitApplicationMethod } from "@/lib/pursuits";
import { PursuitWorkspace } from "@/components/pursuit-workspace";

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

function enrichmentMessage(result: Record<string, unknown>): string {
  const message = result.message;
  return typeof message === "string" ? message : "";
}

function enrichmentContacts(result: Record<string, unknown>): Array<Record<string, unknown>> {
  const contacts = result.contacts;
  return Array.isArray(contacts) ? contacts.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function completedContactLookup(requests: OpportunityEnrichmentRequestRecord[]): boolean {
  return requests.some((request) => {
    if (request.enrichment_type !== "find_contacts" || request.status !== "completed") return false;
    const providerStatus = request.result_json.status;
    return !["failed", "not_configured", "needs_domain", "needs_target"].includes(String(providerStatus || ""));
  });
}

function contactLookupStatus(status: OpportunityEnrichmentRequestRecord["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Could not complete";
  return "Not completed";
}

function hasConfiguredContactProvider(): boolean {
  return Boolean(
    process.env.CLAY_CONTACT_WORKFLOW_URL ||
      process.env.CLAY_CONTACT_ENRICHMENT_WEBHOOK_URL ||
      (process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET)
  );
}

function actionabilityLabel(value: string): string {
  if (value === "Strong") return "High Actionability";
  if (value === "Medium") return "Medium Actionability";
  if (value === "Research" || value === "Screened out" || value === "Low") return "Low Actionability";
  return value;
}

function fullReportRequestHref(scanId: string, signal: StoredOpportunitySignal): string {
  const email = configuredSupportEmail();
  const subject = "Full Opportunity Scanner report request";
  const body = [
    "Hi Opportunity Scanner support,",
    "",
    "I would like full access to this Opportunity Scanner opportunity workspace.",
    "",
    `Scan ID: ${scanId}`,
    `Opportunity: ${opportunityHeadline(signal)}`,
    "",
    "Please send the full source links, contact paths, CRM-ready notes, outreach angles, and workflow/export access.",
    ""
  ].join("\n");

  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function LockedOpportunityPreview({
  scanId,
  signal,
  profile,
  access
}: {
  scanId: string;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile;
  access?: string;
}) {
  const classification = opportunityActionFor(signal, profile);
  return (
    <main className="min-h-screen bg-field px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <a href={`/reports/${scanId}${access ? `?access=${encodeURIComponent(access)}` : ""}`} className="text-sm font-medium text-accent">
          Back to report
        </a>
        <section className="mt-5 rounded-lg border border-line bg-white p-4 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Opportunity Preview
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">
            {opportunityHeadline(signal)}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The full opportunity workspace is part of the full report. It includes source links,
            contact search paths, eligible contact lookup, CRM-ready notes, outreach angles, and workflow handoff.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-line bg-field p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Actionability</p>
              <p className="mt-2 text-sm font-semibold text-ink">{actionabilityLabel(classification.actionability_label)}</p>
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Target</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review"}
              </p>
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contact path</p>
              <p className="mt-2 text-sm font-semibold text-ink">{classificationLabel(classification.contact_strategy)}</p>
            </div>
          </div>
          <p className="mt-5 rounded-md border border-line bg-field p-4 text-sm leading-6 text-slate-700">
            <span className="font-semibold text-ink">Next best action:</span>{" "}
            {classification.next_best_action}
          </p>
          <a
            href={fullReportRequestHref(scanId, signal)}
            className="mt-5 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
          >
            Request Full Report
          </a>
        </section>
      </div>
    </main>
  );
}

export default async function OpportunityPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { scanId?: string; enrichment?: string; access?: string; pursuit?: string; pursuitError?: string };
}) {
  const scanId = searchParams.scanId || "";
  if (!scanId) {
    notFound();
  }

  const scan = await getScan(scanId);
  if (!scan) {
    notFound();
  }

  const readiness = await getCompletedReportReadiness(scan);
  if (!readiness.ready) {
    redirect(`/reports/${scan.id}${searchParams.access ? `?access=${encodeURIComponent(searchParams.access)}` : ""}`);
  }

  const signal = readiness.signals.find((item) => item.id === params.id);
  if (!signal) {
    notFound();
  }

  const profile = readiness.profile;
  const classification = opportunityActionFor(signal, profile);
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const requestUrl = new URL(
    `/opportunities/${params.id}?scanId=${encodeURIComponent(scan.id)}${
      searchParams.access ? `&access=${encodeURIComponent(searchParams.access)}` : ""
    }`,
    `${protocol}://${host}`
  ).toString();
  let pageSessionResolution: Awaited<ReturnType<typeof resolveCustomerPageSession>> | null = null;
  try {
    pageSessionResolution = await resolveCustomerPageSession(getCustomerAuthConfig(requestUrl), cookies());
  } catch {
    pageSessionResolution = null;
  }
  if (pageSessionResolution?.refreshRequired) {
    const next = `/opportunities/${params.id}?scanId=${encodeURIComponent(scan.id)}${
      searchParams.access ? `&access=${encodeURIComponent(searchParams.access)}` : ""
    }`;
    redirect(`/api/auth/session?next=${encodeURIComponent(next)}`);
  }
  const reportAccess = await resolveRequestReportAccess(
    requestUrl,
    searchParams.access,
    scan,
    pageSessionResolution?.session?.user.id ?? null
  );
  if (!reportAccess.hasAccess) {
    return <LockedOpportunityPreview scanId={scan.id} signal={signal} profile={profile} access={searchParams.access} />;
  }

  const pursuitMethod = pursuitApplicationMethod(signal, profile);
  const canManagePursuit = pageSessionResolution?.session?.user.id
    ? await canManageCustomerPursuit(pageSessionResolution.session.user.id, scan)
    : false;
  const pursuit = pageSessionResolution?.session?.user.id
    ? await loadCustomerPursuitForOpportunity({
        authUserId: pageSessionResolution.session.user.id,
        scan,
        signal,
        profile
      }).catch(() => null)
    : null;

  const enrichmentRequests = await listOpportunityEnrichmentRequests(scan.id, signal.id);
  const contactEnrichmentRequests = enrichmentRequests.filter((request) => request.enrichment_type === "find_contacts");
  const primaryContact = primaryContactTarget(signal);
  const contactTargets = contactTargetsForSignal(signal);
  const contactSummary = contactDiscoverySummary(signal);
  const targetEligibility = enrichmentEligibilityForTarget(
    signal.target_resolution ?? resolvePrimaryTargetForSignal(signal),
    primaryContact.roles
  );
  let creditBalance: EnrichmentCreditBalance = { entitled: false, limit: 0, used: 0, remaining: 0 };
  let creditBalanceAvailable = true;
  if (reportAccess.authUserId) {
    try {
      creditBalance = await loadEnrichmentCreditBalance(reportAccess.authUserId);
    } catch {
      creditBalanceAvailable = false;
    }
  }
  const contactLookupComplete = completedContactLookup(contactEnrichmentRequests);
  const sourceNativeContactAvailable = contactSummary.verifiedContacts > 0;
  const contactProviderConfigured = hasConfiguredContactProvider();
  const contactLookupCanRun =
    !sourceNativeContactAvailable &&
    !contactLookupComplete &&
    targetEligibility.clayEligible &&
    targetEligibility.snovEligible &&
    contactProviderConfigured &&
    creditBalanceAvailable &&
    creditBalance.entitled &&
    creditBalance.remaining > 0;
  const startDate = signalDate(signal, "Start Date");
  const endDate = classification.source_deadline || signal.deadline || signalDate(signal, "End Date");

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <a href={`/reports/${scan.id}${searchParams.access ? `?access=${encodeURIComponent(searchParams.access)}` : ""}`} className="text-accent">
            Back to report
          </a>
          <a href="/" className="text-slate-600 hover:text-accent">
            New scan
          </a>
        </div>

        {searchParams.enrichment === "completed" ? (
          <section className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Contact lookup completed. Review the result and verification notes in Contact Lookup History below.
          </section>
        ) : null}
        {searchParams.enrichment === "unavailable" ? (
          <section role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Contact lookup did not complete. Review Contact Lookup History for the reason and use the official contact path below.
          </section>
        ) : null}
        {searchParams.enrichment === "credit_limit" ? (
          <section role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No contact-enrichment credits remain this billing month. Your source-native contact path and next action are still available below.
          </section>
        ) : null}
        {searchParams.enrichment === "growth_required" ? (
          <section role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Person-level contact enrichment requires a signed-in Growth plan. This opportunity still includes its official contact path and next action.
          </section>
        ) : null}
        {searchParams.pursuit === "started" ? (
          <section role="status" aria-live="polite" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Pursuit started. Qualification, application requirements, ownership, and next steps are ready below.
          </section>
        ) : null}
        {searchParams.pursuit === "saved" ? (
          <section role="status" aria-live="polite" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            Pursuit saved.
          </section>
        ) : null}
        {searchParams.pursuitError ? (
          <section role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {searchParams.pursuitError}
          </section>
        ) : null}

        <header className="mt-5 rounded-lg border border-line bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">
                Opportunity Workspace
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold leading-tight text-ink sm:text-3xl">
                {opportunityHeadline(signal)}
              </h1>
              <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                For {profile?.company_name || scan.company_name || scan.company_url}. This page turns one
                signal into a sales, partner, or research work item.
              </p>
            </div>
            <span
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                classification.actionability_label === "Strong"
                  ? "bg-green-50 text-green-700"
                  : classification.actionability_label === "Medium"
                    ? "bg-mist text-accent"
                    : "bg-amber-50 text-amber-800"
              }`}
            >
              {actionabilityLabel(classification.actionability_label)}
            </span>
          </div>
        </header>

        <PursuitWorkspace
          scanId={scan.id}
          opportunityId={signal.id}
          sourceUrl={signal.source_url}
          sourceName={signal.source_name}
          method={pursuitMethod}
          pursuit={pursuit}
          signedIn={Boolean(pageSessionResolution?.session?.user.email)}
          canManage={canManagePursuit}
        />

        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lane</h2>
            <p className="mt-2 text-sm font-semibold text-ink">{signalLane(signal)}</p>
            <p className="mt-2 text-sm text-slate-600">
              {classificationLabel(classification.estimated_opportunity_type)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buyer / Partner</h2>
            <p className="mt-2 text-sm font-semibold text-ink">
              {signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {classificationLabel(classification.buyer_partner_type)} · {signal.geography || "Geography needs review"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action Path</h2>
            <p className="mt-2 text-sm font-semibold text-ink">
              {classificationLabel(classification.contact_strategy)}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {classification.source_status} · {actionabilityLabel(classification.actionability_label)}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-line bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Why This Is Actionable
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">{classification.screening_reason}</p>
          <p className="mt-3 rounded-md bg-field px-3 py-2 text-sm leading-6 text-slate-700">
            <span className="font-semibold text-ink">Best next step:</span> {classification.next_best_action}
          </p>
          <p className="mt-3 rounded-md bg-field px-3 py-2 text-sm leading-6 text-slate-700">
            <span className="font-semibold text-ink">Research check:</span>{" "}
            {classification.manual_research_instruction}
          </p>
        </section>

        <section className="mt-5 rounded-lg border border-line bg-white p-5">
          <div className="grid gap-4 md:grid-cols-[.8fr_1.2fr] md:items-start">
            <div className="rounded-md bg-field px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact Status
              </h2>
              <p className="mt-2 text-lg font-semibold text-ink">{contactSummary.statusLabel}</p>
              <p className="mt-1 text-sm text-slate-600">{contactSummary.detailLabel}</p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Contact Discovery
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Recommended path: {classificationLabel(classification.contact_strategy)}. Use enrichment when
                the row needs named people, email addresses, or a verified decision owner.
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Person-level lookup requires a signed-in Growth plan and can use one monthly contact credit.
                It is enabled only for a verified private-organization target with relevant roles.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-line bg-field p-4">
            {sourceNativeContactAvailable ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Official contact available.</span> Use the source-listed
                contact shown in this workspace; no third-party lookup or Growth credit is needed.
              </p>
            ) : contactLookupComplete ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Contact lookup complete.</span> Review the saved result
                below before outreach.
              </p>
            ) : !targetEligibility.clayEligible || !targetEligibility.snovEligible ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Third-party lookup is not appropriate for this row.</span>{" "}
                {targetEligibility.reason} Follow the official contact path above instead.
              </p>
            ) : !contactProviderConfigured ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Contact lookup is temporarily unavailable.</span> No request
                will be submitted and no credit will be used.
              </p>
            ) : !creditBalanceAvailable ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Credit balance is temporarily unavailable.</span> Contact
                lookup is disabled so no unverified request is submitted.
              </p>
            ) : !reportAccess.authUserId || !creditBalance.entitled ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Growth plan required.</span> Sign in with an active Growth
                plan to run person-level contact lookup. Full report access alone does not include contact credits.
              </p>
            ) : creditBalance.remaining <= 0 ? (
              <p className="text-sm leading-6 text-slate-700">
                <span className="font-semibold text-ink">Monthly contact credits used.</span> You have 0 of{" "}
                {creditBalance.limit} Growth contact credits remaining this billing month.
              </p>
            ) : contactLookupCanRun ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-ink">Growth credits:</span> {creditBalance.remaining} of{" "}
                  {creditBalance.limit} remaining this billing month. This lookup can use one credit.
                </p>
                <form action="/api/opportunities/enrich" method="post">
                  <input type="hidden" name="scanId" value={scan.id} />
                  <input type="hidden" name="opportunityId" value={signal.id} />
                  <input type="hidden" name="enrichmentType" value="find_contacts" />
                  {searchParams.access ? <input type="hidden" name="access" value={searchParams.access} /> : null}
                  <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
                    Run Contact Lookup
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-700">
                Contact lookup is unavailable for this opportunity. No request will be submitted and no credit will
                be used.
              </p>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Who To Contact First
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Start with the people most likely to own programming, partnerships, procurement, or the funded
                program. The search links are meant to find named contacts quickly.
              </p>
            </div>
            <a
              href={primaryContact.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
            >
              Search primary contacts
            </a>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {contactTargets.map((target) => (
              <article key={`${target.organization}-${target.email || target.name || target.roles.join("-")}`} className="rounded-lg border border-line bg-field p-4">
                <h3 className="text-sm font-semibold text-ink">{target.organization}</h3>
                {target.name || target.email || target.phone ? (
                  <div className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                    {target.name ? <p><span className="font-semibold text-ink">Name:</span> {target.name}</p> : null}
                    {target.title ? <p><span className="font-semibold text-ink">Title:</span> {target.title}</p> : null}
                    {target.email ? (
                      <p>
                        <span className="font-semibold text-ink">Email:</span>{" "}
                        <a href={`mailto:${target.email}`} className="break-all text-accent">{target.email}</a>
                      </p>
                    ) : null}
                    {target.phone ? <p><span className="font-semibold text-ink">Phone:</span> {target.phone}</p> : null}
                  </div>
                ) : null}
                <p className="mt-2 text-sm leading-6 text-slate-600">{target.why}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {target.roles.map((role) => (
                    <span key={role} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700">
                      {role}
                    </span>
                  ))}
                </div>
                <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-ink">Outreach angle:</span> {target.outreachAngle}
                </p>
                <a
                  href={target.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:text-accent"
                >
                  Find named contacts
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 grid gap-5 md:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Source Evidence
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {sourceEvidenceText(signal.external_evidence_summary, opportunityHeadline(signal), 720)}
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 md:grid-cols-2">
              <p>
                <span className="font-semibold text-ink">Source type:</span>{" "}
                {signal.source_type.replaceAll("_", " ")}
              </p>
              <p>
                <span className="font-semibold text-ink">Start:</span> {startDate || "Unknown"}
              </p>
              <p>
                <span className="font-semibold text-ink">End/deadline:</span> {endDate || "Unknown"}
              </p>
            </div>
            <a
              href={signal.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:text-accent"
            >
              Open source record
            </a>
          </div>

            <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Contact Path
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Start with {primaryContact.organization}. Look first for{" "}
              {(classification.recommended_contact_roles.length > 0
                ? classification.recommended_contact_roles
                : primaryContact.roles
              )
                .slice(0, 3)
                .join(", ")}
              .
            </p>
            <p className="mt-3 rounded-md bg-field px-3 py-2 text-sm leading-6 text-slate-700">
              {classification.follow_up_task}
            </p>
            <a
              href={primaryContact.searchUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
            >
              Find contacts
            </a>
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-line bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Reasoning And Next Steps
          </h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-ink">Why it matters</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{signal.why_it_matters}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Recommended action</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{classification.next_best_action}</p>
            </div>
          </div>
          {signal.reasoning.length > 0 ? (
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-700">
              {signal.reasoning.map((item) => (
                <li key={item} className="rounded-md bg-field px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-5 rounded-lg border border-line bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Contact Lookup History
          </h2>
          {contactEnrichmentRequests.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {contactEnrichmentRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-md bg-field px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium text-ink">Contact lookup</span>
                    <span className="text-slate-600">
                      {contactLookupStatus(request.status)} on {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {enrichmentMessage(request.result_json) ? (
                    <p className="mt-2 leading-6 text-slate-700">{enrichmentMessage(request.result_json)}</p>
                  ) : null}
                  {enrichmentContacts(request.result_json).length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {enrichmentContacts(request.result_json).map((contact, index) => {
                        const email = typeof contact.email === "string" ? contact.email : "";
                        const name = typeof contact.name === "string" ? contact.name : "";
                        const title = typeof contact.title === "string" ? contact.title : "";
                        const confidence = typeof contact.confidence === "string" ? contact.confidence : "";
                        return (
                          <div key={`${email}-${index}`} className="rounded-md border border-line bg-white px-3 py-2">
                            <p className="font-semibold text-ink">{name || email}</p>
                            {title ? <p className="text-slate-600">{title}</p> : null}
                            {email ? <a href={`mailto:${email}`} className="break-all text-accent">{email}</a> : null}
                            {confidence ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{confidence} confidence</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">No contact lookup has been completed yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
