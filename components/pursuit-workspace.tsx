import {
  PURSUIT_STAGES,
  pursuitMethodLabel,
  pursuitStageLabel,
  sourceActionLabel,
  type CustomerOpportunityPursuit,
  type PursuitApplicationMethod
} from "@/lib/pursuit-contract";
import { PursuitActionLink } from "@/components/pursuit-action-link";

export function PursuitWorkspace({
  scanId,
  opportunityId,
  sourceUrl,
  sourceName,
  method,
  pursuit,
  signedIn,
  canManage
}: {
  scanId: string;
  opportunityId: string;
  sourceUrl: string;
  sourceName: string;
  method: PursuitApplicationMethod;
  pursuit: CustomerOpportunityPursuit | null;
  signedIn: boolean;
  canManage: boolean;
}) {
  const next = `/opportunities/${opportunityId}?scanId=${encodeURIComponent(scanId)}`;

  if (!pursuit) {
    return (
      <section className="mt-5 overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-sm" aria-labelledby="pursuit-title">
        <div className="border-b border-cyan-100 bg-mist px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase text-accent">Move this opportunity</p>
          <h2 id="pursuit-title" className="mt-1 text-lg font-semibold text-ink">Start a tracked pursuit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Keep qualification, registration requirements, documents, ownership, deadline, and the next step together while your team works the opportunity.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">Recommended route</p>
            <p className="mt-1 text-sm font-semibold text-ink">{pursuitMethodLabel(method)}</p>
            <p className="mt-1 text-xs text-muted">Official source: {sourceName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PursuitActionLink
              href={sourceUrl}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent"
            >
              {sourceActionLabel(method)}
            </PursuitActionLink>
            {canManage ? (
              <form action="/api/opportunities/pursuits" method="post">
                <input type="hidden" name="scanId" value={scanId} />
                <input type="hidden" name="opportunityId" value={opportunityId} />
                <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
                  Start pursuit
                </button>
              </form>
            ) : !signedIn ? (
              <a
                href={`/auth/sign-in?next=${encodeURIComponent(next)}`}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                Sign in to track
              </a>
            ) : (
              <a
                href={`/pricing?source=pursuit&scanId=${encodeURIComponent(scanId)}`}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                Full report access required
              </a>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-cyan-200 bg-white shadow-sm" aria-labelledby="pursuit-title">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-100 bg-mist px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Active pursuit</p>
          <h2 id="pursuit-title" className="mt-1 text-lg font-semibold text-ink">Application and pursuit workspace</h2>
          <p className="mt-2 text-sm text-slate-700">
            {pursuitMethodLabel(pursuit.application_method)} for {pursuit.target_organization || "the target organization"}
          </p>
        </div>
        <PursuitActionLink
          href={sourceUrl}
          className="rounded-md border border-accent bg-white px-3 py-2 text-sm font-semibold text-accent hover:bg-cyan-50"
        >
          {sourceActionLabel(pursuit.application_method)}
        </PursuitActionLink>
      </div>

      <form action={`/api/opportunities/pursuits/${pursuit.id}`} method="post" className="p-4 sm:p-5">
        <input type="hidden" name="scanId" value={scanId} />
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <input type="hidden" name="expectedVersion" value={pursuit.version} />

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-ink">
            Stage
            <select name="stage" defaultValue={pursuit.stage} className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-normal text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100">
              {PURSUIT_STAGES.map((stage) => <option key={stage} value={stage}>{pursuitStageLabel(stage)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-ink">
            Owner
            <input name="ownerName" defaultValue={pursuit.owner_name} maxLength={160} placeholder="Person responsible" className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm font-normal text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="text-sm font-semibold text-ink">
            Deadline
            <input type="date" name="deadline" defaultValue={pursuit.deadline || ""} className="mt-2 h-11 w-full rounded-md border border-line px-3 text-sm font-normal text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
        </div>

        <fieldset className="mt-5 border-y border-line py-4">
          <legend className="px-1 text-sm font-semibold text-ink">Qualification checks</legend>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <label className="flex min-h-11 items-start gap-3 rounded-md border border-line px-3 py-3 text-sm text-slate-700">
              <input type="checkbox" name="sourceVerified" value="true" defaultChecked={pursuit.source_verified} className="mt-0.5 h-4 w-4 accent-cyan-700" />
              <span><strong className="block text-ink">Source checked</strong>The official record is current and matches this opportunity.</span>
            </label>
            <label className="min-h-11 rounded-md border border-line px-3 py-3 text-sm font-semibold text-ink">
              Fit decision
              <select name="fitDecision" defaultValue={pursuit.fit_decision} className="mt-2 h-10 w-full rounded-md border border-line bg-white px-2 text-sm font-normal text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100">
                <option value="not_reviewed">Not reviewed</option>
                <option value="pursue">Pursue</option>
                <option value="monitor">Monitor</option>
                <option value="not_fit">Not a fit</option>
              </select>
            </label>
            <label className="flex min-h-11 items-start gap-3 rounded-md border border-line px-3 py-3 text-sm text-slate-700">
              <input type="checkbox" name="routeVerified" value="true" defaultChecked={pursuit.route_verified} className="mt-0.5 h-4 w-4 accent-cyan-700" />
              <span><strong className="block text-ink">Action route checked</strong>The application, response, outreach, or monitoring path is confirmed.</span>
            </label>
          </div>
        </fieldset>

        <label className="mt-5 block text-sm font-semibold text-ink">
          Next step
          <textarea name="nextStep" defaultValue={pursuit.next_step} maxLength={2000} rows={3} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm font-normal leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
        </label>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <label className="block text-sm font-semibold text-ink">
            Eligibility and fit checks
            <textarea name="eligibilityNotes" defaultValue={pursuit.eligibility_notes} maxLength={6000} rows={6} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm font-normal leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Registration items to verify
            <textarea name="registrationRequirements" defaultValue={pursuit.registration_requirements} maxLength={6000} rows={6} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm font-normal leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Suggested document checklist
            <span className="mt-1 block text-xs font-normal text-muted">Verify against the official source. One item per line.</span>
            <textarea name="requiredDocuments" defaultValue={pursuit.required_documents.join("\n")} maxLength={6000} rows={6} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm font-normal leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
          <label className="block text-sm font-semibold text-ink">
            Working notes
            <span className="mt-1 block text-xs font-normal text-muted">Decisions, contacts, blockers, and submission notes</span>
            <textarea name="notes" defaultValue={pursuit.notes} maxLength={12000} rows={6} className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm font-normal leading-6 text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-cyan-100" />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="text-xs text-muted">Last updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(pursuit.updated_at))}</p>
          <button className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Save pursuit
          </button>
        </div>
      </form>
    </section>
  );
}
