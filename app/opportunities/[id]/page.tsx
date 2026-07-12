import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getCompanyProfile,
  getScan,
  getStoredOpportunitySignal,
  listOpportunityEnrichmentRequests
} from "@/lib/storage";
import { signalDate, signalLane } from "@/lib/actionability";
import { contactDiscoverySummary, contactTargetsForSignal, primaryContactTarget } from "@/lib/contactTargeting";
import { opportunityActionFor } from "@/lib/opportunityAction";
import { classificationLabel } from "@/lib/opportunityClassification";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { OpportunityEnrichmentType, StoredOpportunitySignal } from "@/lib/types";
import { hasRequestReportAccess } from "@/lib/payments/requestAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const enrichmentActions: Array<{
  type: OpportunityEnrichmentType;
  label: string;
  description: string;
}> = [
  {
    type: "find_contacts",
    label: "Find contacts",
    description: "Identify buyer, program, procurement, or partnership contacts."
  },
  {
    type: "find_similar_awards",
    label: "Find similar awards",
    description: "Use this signal as a pattern to find adjacent funded buyers."
  },
  {
    type: "search_active_bids",
    label: "Search active bids",
    description: "Look for open solicitations that match this lane."
  },
  {
    type: "search_grants",
    label: "Search grants",
    description: "Check whether this buyer or category has current funding programs."
  },
  {
    type: "find_buyer_website",
    label: "Find buyer website",
    description: "Find the agency, department, procurement, or program page."
  },
  {
    type: "generate_outreach",
    label: "Generate outreach angle",
    description: "Draft the sales or partnership hypothesis for this signal."
  }
];

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

function actionabilityLabel(value: string): string {
  if (value === "Strong") return "High Actionability";
  if (value === "Medium") return "Medium Actionability";
  if (value === "Research" || value === "Screened out" || value === "Low") return "Low Actionability";
  return value;
}

function fullReportRequestHref(scanId: string, signal: StoredOpportunitySignal): string {
  const email = process.env.OPPORTUNITY_SCANNER_CONTACT_EMAIL || "hello@opportunitysystems.ai";
  const subject = "Full Opportunity Scanner report request";
  const body = [
    "Hi Opportunity Systems,",
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
  profile?: ReturnType<typeof ensureProfileRefinementFields>;
  access?: string;
}) {
  const classification = opportunityActionFor(signal, profile);
  return (
    <main className="min-h-screen bg-field px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <a href={`/reports/${scanId}${access ? `?access=${encodeURIComponent(access)}` : ""}`} className="text-sm font-medium text-accent">
          Back to report
        </a>
        <section className="mt-5 rounded-lg border border-line bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Opportunity Preview
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">
            {opportunityHeadline(signal)}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The full opportunity workspace is part of the full report. It includes source links,
            contact search paths, enrichment actions, CRM-ready notes, outreach angles, and workflow handoff.
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
  searchParams: { scanId?: string; enrichment?: string; access?: string };
}) {
  const scanId = searchParams.scanId || "";
  if (!scanId) {
    notFound();
  }

  const scan = await getScan(scanId);
  if (!scan) {
    notFound();
  }

  const signal = await getStoredOpportunitySignal(scan.id, params.id);
  if (!signal) {
    notFound();
  }

  const profileRecord = await getCompanyProfile(scan.id);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
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
  if (!(await hasRequestReportAccess(requestUrl, searchParams.access, scan))) {
    return <LockedOpportunityPreview scanId={scan.id} signal={signal} profile={profile} access={searchParams.access} />;
  }

  const enrichmentRequests = await listOpportunityEnrichmentRequests(scan.id, signal.id);
  const primaryContact = primaryContactTarget(signal);
  const contactTargets = contactTargetsForSignal(signal);
  const contactSummary = contactDiscoverySummary(signal);
  const startDate = signalDate(signal, "Start Date");
  const endDate = classification.source_deadline || signal.deadline || signalDate(signal, "End Date");

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <a href={`/reports/${scan.id}${searchParams.access ? `?access=${encodeURIComponent(searchParams.access)}` : ""}`} className="text-accent">
            Back to report
          </a>
          <a href="/" className="text-slate-600 hover:text-accent">
            New scan
          </a>
        </div>

        {searchParams.enrichment === "requested" ? (
          <section className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Enrichment request saved. This is now in the work queue for this opportunity.
          </section>
        ) : null}

        <header className="mt-5 rounded-lg border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent">
                Opportunity Workspace
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-ink">
                {opportunityHeadline(signal)}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
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
          <div className="grid gap-4 md:grid-cols-[.8fr_1.2fr_auto] md:items-center">
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
            </div>
            <form action="/api/opportunities/enrich" method="post">
              <input type="hidden" name="scanId" value={scan.id} />
              <input type="hidden" name="opportunityId" value={signal.id} />
              <input type="hidden" name="enrichmentType" value="find_contacts" />
              {searchParams.access ? <input type="hidden" name="access" value={searchParams.access} /> : null}
              <button className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
                Find Contacts
              </button>
            </form>
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
                        <a href={`mailto:${target.email}`} className="text-accent">{target.email}</a>
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
            <p className="mt-3 text-sm leading-6 text-slate-700">{signal.external_evidence_summary}</p>
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
            Enrich This Opportunity
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            These actions turn the opportunity into a practical workflow item. Contact lookup runs when
            credentials and a useful domain are available; otherwise the workspace keeps the suggested
            contact strategy and manual next step visible.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {enrichmentActions.map((action) => (
              <form
                key={action.type}
                action="/api/opportunities/enrich"
                method="post"
                className="rounded-lg border border-line bg-field p-4"
              >
                <input type="hidden" name="scanId" value={scan.id} />
                <input type="hidden" name="opportunityId" value={signal.id} />
                <input type="hidden" name="enrichmentType" value={action.type} />
                {searchParams.access ? <input type="hidden" name="access" value={searchParams.access} /> : null}
                <h3 className="text-sm font-semibold text-ink">{action.label}</h3>
                <p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-600">{action.description}</p>
                <button className="mt-3 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                  Request enrichment
                </button>
              </form>
            ))}
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
            Enrichment History
          </h2>
          {enrichmentRequests.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {enrichmentRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-md bg-field px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-medium text-ink">{request.enrichment_type.replaceAll("_", " ")}</span>
                    <span className="text-slate-600">
                      {request.status} on {new Date(request.created_at).toLocaleDateString()}
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
                            {email ? <a href={`mailto:${email}`} className="text-accent">{email}</a> : null}
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
            <p className="mt-3 text-sm text-slate-600">No enrichment requests yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
