import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { FounderNote } from "@/components/founder-note";
import { SectionIntro } from "@/components/marketing";
import { ScanSubmitButton } from "@/components/scan-submit-button";
import { getScan } from "@/lib/storage";
import type { ScanRecord } from "@/lib/types";

const title = "Opportunity Scanner | Public-Sector Opportunity Intelligence";
const description =
  "Find public-sector revenue opportunities hiding in plain sight. Scan your company website for sourced public-sector signals, buyer targets, contact paths, and next actions.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{
      url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png",
      width: 1200,
      height: 630,
      alt: "Opportunity Scanner public-sector revenue intelligence"
    }]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"]
  }
};

const customerTypes = ["B2B", "B2C", "Government", "Healthcare", "Education", "Nonprofit", "Other"];
const focusOptions = [
  { value: "grants_funding", label: "Grants / funding" },
  { value: "active_contracts", label: "Government contracts" },
  { value: "funded_buyers", label: "Buyer targets" },
  { value: "policy_signals", label: "Policy / regulatory changes" },
  { value: "workforce_funding", label: "Workforce incentives" },
  { value: "reimbursement_signal", label: "Reimbursement / healthcare pathways" },
  { value: "not_sure", label: "Not sure" }
];

const icpPaths = [
  {
    slug: "healthcare-dme-medical-supply",
    eyebrow: "Healthcare & DME",
    title: "Find institutional buyers and channel routes",
    profile: "Recovery and clinical supply products",
    target: "VA, rehabilitation buyers, and DME distributors",
    motion: "Sell to Agency or Channel",
    next: "Map the product category to the right purchasing path"
  },
  {
    slug: "education-workforce-training",
    eyebrow: "Education & Workforce",
    title: "Turn hiring demand into buyer and partner targets",
    profile: "Teacher recruiting and staffing technology",
    target: "District HR teams and funded workforce operators",
    motion: "Sell or Partner",
    next: "Verify the program owner and district hiring route"
  },
  {
    slug: "marketing-advertising-content-web-services",
    eyebrow: "Marketing & Digital Services",
    title: "Surface public communications demand",
    profile: "Campaign, content, and website services",
    target: "Public information, enrollment, and digital teams",
    motion: "Sell to Agency",
    next: "Match capabilities to the solicitation or program office"
  },
  {
    slug: "arts-creative-economy-live-events",
    eyebrow: "Arts & Live Events",
    title: "Find funded programming and event buyers",
    profile: "Artist, event, and cultural programming services",
    target: "Cities, parks, tourism offices, and funded recipients",
    motion: "Sell or Partner",
    next: "Confirm the funded program and programming owner"
  }
] as const;

type HomeSearchParams = {
  error?: string;
  retry?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

function ScanForm({
  searchParams,
  retryScan
}: {
  searchParams?: HomeSearchParams;
  retryScan?: ScanRecord | null;
}) {
  const errorMessage = searchParams?.error === "invalid-url"
    ? "Enter a valid company website URL."
    : searchParams?.error === "missing-context"
      ? "Describe what the company sells and who it wants to reach so we can run a focused scan."
      : null;

  return (
    <form id="scan" action="/api/scans" method="post" className="home-scan-form scroll-mt-24 rounded-lg border border-line bg-white p-5 sm:p-6">
      <input type="hidden" name="reportType" value="quick" />
      {(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const).map((name) => {
        const value = searchParams?.[name]?.trim().slice(0, 160);
        return value ? <input key={name} type="hidden" name={name} value={value} /> : null;
      })}

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Free preview</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Scan your company</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Tell us what you sell. We will look for the public-sector path.</p>
        </div>
        <Badge tone="green"><span className="whitespace-nowrap">No card</span></Badge>
      </div>

      {errorMessage ? (
        <div role="alert" aria-live="polite" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {retryScan ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">
          Add a little more detail about what you sell, the buyers you want, or the opportunity type
          that matters most. Your email is intentionally not carried into this form.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3.5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Company website URL</span>
            <input
              required
              name="companyUrl"
              type="url"
              defaultValue={retryScan?.company_url || ""}
              placeholder="https://example.com"
              className="min-h-11 rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Work email</span>
            <input
              required
              name="email"
              type="email"
              placeholder="you@company.com"
              className="min-h-11 rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">What do you sell, and who should we find as buyers or partners?</span>
          <textarea
            required
            minLength={15}
            maxLength={2000}
            name="opportunityFocus"
            rows={2}
            defaultValue={retryScan?.opportunity_focus || ""}
            placeholder="Example: We provide teacher recruiting software to school districts and want district HR, staffing, and workforce opportunities."
            className="rounded-md border border-line bg-white px-3 py-2.5 outline-none focus:border-accent"
          />
        </label>

        <label className="flex min-h-11 items-start gap-3 rounded-md border border-line bg-field px-3 py-2.5 text-xs leading-5 text-slate-600">
          <input name="marketingConsent" type="checkbox" className="mt-1 h-4 w-4 accent-[#0E7C86]" />
          <span>Send me practical opportunity guidance and occasional product updates. I can unsubscribe at any time.</span>
        </label>

        <details open={Boolean(retryScan)} className="rounded-md border border-line bg-field p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Add context for a tighter scan
            <span className="ml-2 text-xs font-medium text-muted">Optional</span>
          </summary>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Company name</span>
                <input name="companyName" defaultValue={retryScan?.company_name || ""} placeholder="Optional" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Industry</span>
                <input name="industry" defaultValue={retryScan?.industry || ""} placeholder="Healthcare, education, marketing..." className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">HQ state</span>
                <input name="headquartersState" defaultValue={retryScan?.headquarters_state || ""} placeholder="MD" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Target regions</span>
                <input name="targetStates" defaultValue={retryScan?.target_states || ""} placeholder="MD, CA, national" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Customer type</span>
              <select name="customerType" defaultValue={retryScan?.customer_type || ""} className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent">
                <option value="">Optional</option>
                {customerTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium text-ink">What should we look for?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {focusOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-accent">
                    <input type="checkbox" name="prioritySignals" value={option.value} className="h-4 w-4 rounded border-line" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </details>

        <ScanSubmitButton />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted" aria-label="Scan details">
          <span>Usually under a minute</span>
          <span>Public sources linked</span>
          <span>2-3 preview signals</span>
        </div>
        <p className="text-xs leading-5 text-muted">
          We use your email to provide and support this scan. See our{" "}
          <a href="/privacy" className="font-semibold text-accent hover:underline">privacy notice</a>.
        </p>
      </div>
    </form>
  );
}

function ProductProof() {
  return (
    <section className="home-product-proof border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <SectionIntro title="Turn a finding into a tracked pursuit" eyebrow="Inside the product">
            <p>
              Opportunity Scanner does more than explain a public record. Open the official route,
              start a pursuit, assign the work, find the right contact path, and move the context into
              your workflow. CivicStage is fictional and uses public-source examples.
            </p>
          </SectionIntro>
          <div className="grid gap-3 border-y border-line py-4 sm:grid-cols-3 sm:divide-x sm:divide-line sm:border-y-0 sm:py-0">
            {[
              ["Discover", "Match the company to relevant public records"],
              ["Qualify", "Separate current opportunities from historical evidence"],
              ["Pursue", "Route the right target, contact path, and action"]
            ].map(([label, copy]) => (
              <div key={label} className="sm:px-5 sm:first:pl-0 sm:last:pr-0">
                <p className="text-xs font-semibold uppercase text-accent">{label}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-ink">{copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="home-product-ui mt-9 overflow-hidden rounded-lg border border-line bg-field shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <img src="/sample-companies/civicstage-talent-network.svg" alt="" className="h-10 w-10 rounded-md" />
              <div>
                <p className="font-semibold text-ink">CivicStage opportunity workspace</p>
                <p className="text-xs text-muted">Fictional company · public-source example</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Report ready</Badge>
              <Badge tone="blue">Funded-buyer evidence</Badge>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
            <div className="border-b border-line bg-white p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">High Actionability</Badge>
                <Badge tone="blue">Sell to Funded Buyer</Badge>
                <span className="text-xs font-semibold text-muted">Historical award evidence</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold leading-7 text-ink">
                City-funded cultural programming points to a qualified buyer path
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Public award records show that the organization has funded cultural programming.
                The record is evidence of budget and buying behavior, not an open deadline.
              </p>

              <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Target", "City cultural affairs and events office"],
                  ["Contact path", "Programming, partnerships, or procurement owner"],
                  ["Next best action", "Verify the current program owner before outreach"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-line bg-field p-4">
                    <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
                    <dd className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 rounded-md border border-cyan-200 bg-mist p-3.5">
                <p className="text-xs font-semibold uppercase text-accent">Opportunity actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="https://www.usaspending.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                  >
                    Review source
                  </a>
                  <a
                    href="/examples/creative-economy-live-events-opportunity-scan#pursuit-workspace"
                    className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#0A6871]"
                  >
                    Start pursuit
                  </a>
                  <a
                    href="/examples/creative-economy-live-events-opportunity-scan#pursuit-workspace"
                    className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                  >
                    Find contacts
                  </a>
                  <a
                    href="/examples/creative-economy-live-events-opportunity-scan#pursuit-workspace"
                    className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                  >
                    Send to workflow
                  </a>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted">Official source</p>
                  <a
                    href="https://www.usaspending.gov/"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871] hover:underline"
                  >
                    USAspending.gov award record
                  </a>
                </div>
                <a href="/examples/creative-economy-live-events-opportunity-scan" className="text-sm font-semibold text-accent hover:text-[#0A6871]">
                  Open the full walkthrough
                </a>
              </div>
            </div>

            <div className="bg-field p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase text-accent">Active pursuit</p>
              <h4 className="mt-2 text-lg font-semibold leading-6 text-ink">Application and pursuit workspace</h4>
              <p className="mt-2 text-xs leading-5 text-muted">Keep ownership, qualification, and the official route attached to the opportunity.</p>

              <dl className="mt-5 divide-y divide-line border-y border-line">
                {[
                  ["Stage", "Qualifying"],
                  ["Owner", "Business development lead"],
                  ["Fit decision", "Pursue"],
                  ["Next step", "Confirm the programming owner and outreach route"]
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-3 sm:grid-cols-[90px_1fr] sm:gap-3">
                    <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
                    <dd className="text-sm font-semibold leading-5 text-ink">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 grid gap-2 text-xs font-medium text-slate-700">
                <p className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded border border-emerald-300 bg-emerald-50 text-emerald-700">✓</span> Source checked</p>
                <p className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded border border-emerald-300 bg-emerald-50 text-emerald-700">✓</span> Action route checked</p>
              </div>

              <a
                href="/examples/creative-economy-live-events-opportunity-scan#pursuit-workspace"
                className="mt-5 flex min-h-10 w-full items-center justify-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
              >
                See the pursuit workflow
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IcpProof() {
  return (
    <section className="border-b border-line bg-field">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <SectionIntro title="Different offers need different public-sector routes" eyebrow="Built around your market">
            <p>
              The scanner changes its buyers, language, source patterns, and recommended revenue motion
              based on what the company actually sells.
            </p>
          </SectionIntro>
          <a href="/industries" className="w-fit text-sm font-semibold text-accent hover:text-[#0A6871]">Explore all industries</a>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {icpPaths.map((path) => (
            <article key={path.slug} className="home-icp-card overflow-hidden rounded-lg border border-line bg-white">
              <div className="border-b border-line p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase text-accent">{path.eyebrow}</p>
                <h3 className="mt-2 text-xl font-semibold leading-7 text-ink">{path.title}</h3>
              </div>
              <div className="home-icp-route grid gap-0 sm:grid-cols-3">
                {[
                  ["Company profile", path.profile],
                  ["Buyer or partner", path.target],
                  ["Recommended route", path.motion]
                ].map(([label, value], index) => (
                  <div key={label} className="relative border-b border-line bg-field p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                    <p className="text-[11px] font-semibold uppercase text-muted">{label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</p>
                    {index < 2 ? <span className="home-icp-arrow" aria-hidden="true">→</span> : null}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <p className="max-w-xl text-sm leading-6 text-slate-600"><span className="font-semibold text-ink">Next:</span> {path.next}</p>
                <a href={`/industries/${path.slug}`} className="text-sm font-semibold text-accent hover:text-[#0A6871]">View industry path</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: HomeSearchParams }) {
  const retryId = searchParams?.retry;
  const retryScan = retryId && /^[0-9a-f-]{36}$/i.test(retryId)
    ? await getScan(retryId).catch(() => null)
    : null;
  const reusableRetryScan = retryScan && ["quality_review", "failed"].includes(retryScan.status)
    ? retryScan
    : null;
  return (
    <main className="home-page min-h-screen bg-white">
      <SiteHeader
        rightSlot={
          <a href="#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <section className="home-hero">
        <div className="home-hero__content mx-auto grid max-w-7xl gap-9 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14">
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">For B2B companies exploring public-sector revenue</p>
            <h1 className="home-hero__title mt-5 font-semibold leading-tight text-ink">
              <span className="hidden sm:inline">Find public-sector revenue paths for what your company already sells.</span>
              <span className="sm:hidden">Find public-sector revenue paths for your company.</span>
            </h1>
            <p className="home-hero__lede mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Scan your website to uncover sourced buyers, funded organizations, grants, and
              procurement paths, with a clear next action for each.
            </p>
            <div className="home-hero__proof mt-7 grid gap-3 sm:grid-cols-3">
              {[
                ["Official evidence", "Every signal links back to a public source"],
                ["Commercial route", "See the likely buyer, partner, or application path"],
                ["Action-ready", "Know what to verify and who should own the next move"]
              ].map(([label, copy]) => (
                <div key={label} className="border-l-2 border-accent pl-3">
                  <p className="text-xs font-semibold uppercase text-accent">{label}</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-ink">{copy}</p>
                </div>
              ))}
            </div>
            <a href="/examples/creative-economy-live-events-opportunity-scan" className="home-hero__sample mt-6 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
              Explore the fictional CivicStage walkthrough
            </a>
          </div>
          <div className="home-hero__form">
            <ScanForm searchParams={searchParams} retryScan={reusableRetryScan} />
          </div>
        </div>
      </section>

      <section className="home-proof-band border-b border-line bg-ink text-white" aria-label="Recent scan coverage">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/15">
          {[
            ["178", "opportunities surfaced across recent scans"],
            ["3", "federal source systems checked"],
            ["5-11", "distinct agencies found per scan"],
            ["2 classes", "live opportunities and funded-buyer evidence"]
          ].map(([value, label]) => (
            <div key={label} className="lg:px-5 lg:first:pl-0 lg:last:pr-0">
              <p className="text-lg font-semibold text-white">{value}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-300">{label}</p>
            </div>
          ))}
        </div>
        <p className="sr-only">Recent scan sample updated July 2026.</p>
      </section>

      <ProductProof />

      <IcpProof />

      <FounderNote />

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">Access</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-ink">Start free. Unlock the action layer when the signals are worth pursuing.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Buy one complete report or choose monitoring when you need an ongoing source of new
              opportunities. Pricing, billing terms, and current checkout availability are shown
              before any payment can begin.
            </p>
            <a href="/pricing" className="mt-6 inline-flex rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
              View Pricing
            </a>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {[
              ["Free preview", "2-3 sourced opportunity signals, total signals found, target lanes, source summaries, and recommended next steps."],
              ["Full report", "All prioritized rows, source links, revenue motions, source-native contact paths, CRM-ready notes, outreach drafts, workflow export, and report downloads."],
              ["Growth enrichment", "Person-level contact enrichment is Growth-only and uses capped monthly credits. It is offered only when a target is eligible."]
            ].map(([heading, copy]) => (
              <div key={heading} className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
                <h3 className="font-semibold text-ink">{heading}</h3>
                <p className="text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-9 px-6 py-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-300">Ready to scan</p>
            <h2 className="mt-2 text-3xl font-semibold">Find the public-sector path hiding in your current offer.</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              Start with your website. Opportunity Scanner will translate it into public-sector buying,
              funding, partnership, and policy language.
            </p>
            <a href="#scan" className="mt-6 inline-flex rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-mist">Run Free Scan</a>
          </div>
          <div>
            <h2 className="text-xl font-semibold">Common questions</h2>
            <div className="mt-4 divide-y divide-white/15 border-y border-white/15">
              {[
                ["Is this just a grant finder?", "No. It covers procurement, funded buyers, grant programs, policy signals, workforce funding, reimbursement pathways, and public spending."],
                ["Do I need public-sector experience?", "No. Every row explains the likely revenue motion, target, contact path, source evidence, and next action."],
                ["Can I use the results in my workflow?", "Full reports include export-ready rows, CRM notes, outreach angles, and webhook actions for common sales and operations tools."]
              ].map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer text-sm font-semibold text-white marker:text-teal-300">{question}</summary>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
