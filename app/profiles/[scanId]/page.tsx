import { notFound } from "next/navigation";
import { Badge, CompanyLogo, OpportunityScannerLogo } from "@/components/brand";
import { ProfileRefinementPanel } from "@/components/profile-refinement-panel";
import { getCompanyProfile, getScan, listProfileFeedbackForScan } from "@/lib/storage";
import { buildProfileSearchStrategy, ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { isSamGovConfigured } from "@/lib/connectors/samGov";
import { sourceCatalog } from "@/lib/sourceRegistry";
import { hasAdminAccess } from "@/lib/access";

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

function sourceIsActivated(sourceId: string, sourceName: string, activated: string[]): boolean {
  const normalized = activated.map((item) => item.toLowerCase());
  return normalized.includes(sourceId.toLowerCase()) || normalized.includes(sourceName.toLowerCase());
}

function AdminRequired() {
  return (
    <main className="min-h-screen bg-field px-4 py-5 sm:px-6 sm:py-8">
      <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink">Admin access required</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Profile refinement is an internal workspace for approved Opportunity Scanner operators.
        </p>
      </section>
    </main>
  );
}

function ChipList({
  items,
  empty,
  tone = "slate"
}: {
  items: string[];
  empty: string;
  tone?: "slate" | "blue" | "green" | "amber";
}) {
  if (items.length === 0) {
    return <p className="mt-3 text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} tone={tone}>{item}</Badge>
      ))}
    </div>
  );
}

export default async function ProfilePage({
  params,
  searchParams
}: {
  params: { scanId: string };
  searchParams?: { access?: string };
}) {
  const scan = await getScan(params.scanId);
  if (!scan) notFound();
  if (!hasAdminAccess(searchParams?.access, scan)) return <AdminRequired />;

  const profileRecord = await getCompanyProfile(scan.id);
  if (!profileRecord) notFound();

  const profile = ensureProfileRefinementFields(profileRecord.profile_json);
  const feedback = await listProfileFeedbackForScan(scan.id);
  const strategy = buildProfileSearchStrategy(profile);
  const companyName = profile.company_name || scan.company_name || hostname(scan.company_url);
  const activatedSources = profile.activated_source_categories ?? [];
  const sources = sourceCatalog({ samGovConfigured: isSamGovConfigured() });
  const companyEvidence = profile.company_evidence ?? [];
  const accessParam = `access=${encodeURIComponent(searchParams?.access ?? "")}`;

  return (
    <main className="min-h-screen bg-field px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-lg border border-line bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <OpportunityScannerLogo />
            <div className="flex flex-wrap gap-2">
              <a href={`/reports/${scan.id}?${accessParam}`} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink">
                Back to Report
              </a>
              <a href="/" className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink">
                New Scan
              </a>
            </div>
          </div>
          <div className="mt-8 flex min-w-0 flex-wrap items-center gap-4">
            <CompanyLogo name={companyName} logoUrl={companyLogoUrl(scan.company_url)} />
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold text-ink sm:text-3xl">{companyName} Opportunity Profile</h1>
              <p className="mt-1 break-all text-sm text-muted">{scan.company_url}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-line bg-field p-3">
              <p className="text-xs font-semibold uppercase text-muted">Profile confidence</p>
              <p className="mt-1 text-sm font-semibold text-ink">{profile.profile_confidence_score ?? 0}/100</p>
            </div>
            <div className="rounded-md border border-line bg-field p-3">
              <p className="text-xs font-semibold uppercase text-muted">Search terms</p>
              <p className="mt-1 text-sm font-semibold text-ink">{strategy.search_terms.length}</p>
            </div>
            <div className="rounded-md border border-line bg-field p-3">
              <p className="text-xs font-semibold uppercase text-muted">Opportunity lanes</p>
              <p className="mt-1 text-sm font-semibold text-ink">{strategy.opportunity_lanes.length}</p>
            </div>
            <div className="rounded-md border border-line bg-field p-3">
              <p className="text-xs font-semibold uppercase text-muted">Feedback saved</p>
              <p className="mt-1 text-sm font-semibold text-ink">{feedback.length}</p>
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">What The Scanner Inferred</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-700">
            {profile.profile_assumptions_summary || profile.summary}
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="text-sm font-semibold text-ink">Products / services</h3>
              <ChipList items={(profile.inferred_products_services ?? profile.products_services ?? []).slice(0, 12)} empty="No product assumptions saved yet." />
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="text-sm font-semibold text-ink">Target customers</h3>
              <ChipList items={(profile.inferred_target_customers ?? profile.target_customers ?? []).slice(0, 12)} empty="No customer assumptions saved yet." />
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="text-sm font-semibold text-ink">Buyer / partner types</h3>
              <ChipList items={(profile.inferred_buyer_partner_types ?? []).slice(0, 12)} empty="No buyer-path assumptions saved yet." />
            </div>
            <div className="rounded-md border border-line bg-field p-4">
              <h3 className="text-sm font-semibold text-ink">Revenue motions</h3>
              <ChipList items={(profile.inferred_revenue_motions ?? profile.likely_revenue_motions ?? []).slice(0, 12)} empty="No revenue-motion assumptions saved yet." />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Company Evidence Used</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            These source records support the company identity and market assumptions used to build the search strategy.
          </p>
          {companyEvidence.length > 0 ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {companyEvidence.slice(0, 12).map((evidence, index) => (
                <div key={`${evidence.source_url}-${index}`} className="rounded-md border border-line bg-field p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">{evidence.source_name}</h3>
                    <Badge tone={evidence.source_type === "official_registry" ? "blue" : "green"}>
                      {Math.round(evidence.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-slate-700">{evidence.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {evidence.fields.slice(0, 5).map((field) => (
                      <Badge key={field} tone="slate">{field.replace(/_/g, " ")}</Badge>
                    ))}
                    <a
                      href={evidence.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-link hover:underline"
                    >
                      View source
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-line bg-field p-4 text-sm text-muted">
              This profile predates source-backed company enrichment. Refresh the scan to add company evidence.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">Connector Routing Plan</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            The refined profile decides which connectors to query, which terms to send, and which matches to suppress.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sources.map((source) => {
              const activated = sourceIsActivated(source.id, source.name, activatedSources);
              return (
                <div key={source.id} className="rounded-md border border-line bg-field p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">{source.name}</h3>
                    <Badge tone={activated ? "green" : source.status === "Active" ? "blue" : "slate"}>
                      {activated ? "Routed" : source.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">{source.value}</p>
                </div>
              );
            })}
          </div>
        </section>

        <ProfileRefinementPanel
          scanId={scan.id}
          initialProfile={profile}
          initialStrategy={strategy}
          initialFeedback={feedback}
          access={searchParams?.access}
        />
      </div>
    </main>
  );
}
