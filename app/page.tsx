import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { SectionIntro } from "@/components/marketing";
import { ScanSubmitButton } from "@/components/scan-submit-button";
import { industryPages } from "@/lib/marketingContent";

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

type HomeSearchParams = {
  error?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

function ScanForm({ searchParams }: { searchParams?: HomeSearchParams }) {
  const errorMessage = searchParams?.error === "invalid-url" ? "Enter a valid company website URL." : null;

  return (
    <form id="scan" action="/api/scans" method="post" className="home-scan-form rounded-lg border border-line bg-white p-5 sm:p-6">
      <input type="hidden" name="reportType" value="quick" />
      {(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const).map((name) => {
        const value = searchParams?.[name]?.trim().slice(0, 160);
        return value ? <input key={name} type="hidden" name={name} value={value} /> : null;
      })}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Run a free opportunity scan</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Start with your website and work email.</p>
        </div>
        <Badge tone="amber">Beta</Badge>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Company website URL</span>
            <input
              required
              name="companyUrl"
              type="url"
              placeholder="https://example.com"
              className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink">Work email</span>
            <input
              required
              name="email"
              type="email"
              placeholder="you@company.com"
              className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
            />
          </label>
        </div>

        <p className="text-xs leading-5 text-muted">
          We use your email to provide and support the requested scan. See our{" "}
          <a href="/privacy" className="font-semibold text-accent hover:underline">privacy notice</a>.
        </p>

        <label className="flex min-h-11 items-start gap-3 rounded-md border border-line bg-field p-3 text-sm leading-6 text-slate-700">
          <input name="marketingConsent" type="checkbox" className="mt-1 h-4 w-4 accent-[#0E7C86]" />
          <span>Send me practical opportunity guidance and occasional product updates. I can unsubscribe at any time.</span>
        </label>

        <details className="rounded-md border border-line bg-field p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Add context for a tighter scan
            <span className="ml-2 text-xs font-medium text-muted">Optional</span>
          </summary>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Company name</span>
                <input name="companyName" placeholder="Optional" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Industry</span>
                <input name="industry" placeholder="Healthcare, education, marketing..." className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">HQ state</span>
                <input name="headquartersState" placeholder="MD" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Target regions</span>
                <input name="targetStates" placeholder="MD, CA, national" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent" />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Customer type</span>
              <select name="customerType" defaultValue="" className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent">
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
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink">Extra context</span>
              <textarea
                name="opportunityFocus"
                rows={3}
                placeholder="Example: buyer targets for city programs, workforce funding, or public event procurement"
                className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
              />
            </label>
          </div>
        </details>

        <ScanSubmitButton />
        <p className="text-xs leading-5 text-muted">
          Scans usually take under a minute while we read the website and check public-sector sources.
        </p>
      </div>
    </form>
  );
}

function ProductProof() {
  return (
    <section className="home-product-proof border-y border-line bg-field">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <SectionIntro title="From a website to a sourced opportunity your team can route" eyebrow="See the product">
          <p>
            This fictional CivicStage example uses real public-source patterns to show the full path:
            evidence, revenue motion, target, contact route, and next action.
          </p>
        </SectionIntro>

        <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white shadow-panel">
          <div className="relative aspect-[4/3] overflow-hidden border-b border-line sm:aspect-[16/8]">
            <img
              src="/product-proof/report-overview.jpg"
              alt="Fictional CivicStage Talent Network report with sourced opportunity summary"
              className="h-full w-full object-cover object-left-top"
              loading="lazy"
            />
          </div>
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-line p-5 lg:border-b-0 lg:border-r lg:p-6">
              <div className="flex flex-wrap gap-2">
                <Badge tone="green">High Actionability</Badge>
                <Badge tone="blue">Sell to Funded Buyer</Badge>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase text-muted">Priority opportunity</p>
              <h3 className="mt-2 text-xl font-semibold leading-7 text-ink">
                Tourism and placemaking funding creates a public programming buyer
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Public spending evidence points to a funded department with a credible need for event,
                artist, and cultural-programming partners.
              </p>
            </div>
            <dl className="grid sm:grid-cols-3">
              {[
                ["Target", "State parks, recreation, and tourism program office"],
                ["Contact path", "Special events, cultural affairs, or procurement owner"],
                ["Next best action", "Validate the active program, save the target, and send source-backed outreach"]
              ].map(([label, value], index) => (
                <div key={label} className={`p-5 sm:p-6 ${index < 2 ? "border-b border-line sm:border-b-0 sm:border-r" : ""}`}>
                  <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
                  <dd className="mt-2 text-sm font-semibold leading-6 text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            The public sample never uses a customer logo or private customer data. CivicStage is a
            fictional company created solely to demonstrate the product workflow.
          </p>
          <a href="/examples/creative-economy-live-events-opportunity-scan" className="text-sm font-semibold text-accent hover:text-[#0A6871]">
            View the full sample report
          </a>
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ searchParams }: { searchParams?: HomeSearchParams }) {
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
        <img
          src="/product-proof/report-pipeline.png"
          alt="Opportunity Scanner report showing sourced opportunities, revenue motions, target organizations, contact strategies, and next actions"
          className="home-hero__product"
        />
        <div className="home-hero__veil" aria-hidden="true" />
        <div className="home-hero__product-label" aria-hidden="true">
          <span>Product view</span>
          <strong>Fictional demo data</strong>
        </div>
        <div className="home-hero__content mx-auto max-w-7xl px-6">
          <div className="home-hero__copy">
            <p className="home-hero__eyebrow">Public-sector opportunity intelligence</p>
            <h1 className="home-hero__title mt-5 font-semibold leading-tight text-ink">
              Find public-sector opportunities your team can actually pursue.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Turn your company website into a sourced pipeline of buyers, grants, funded partners,
              and procurement paths, with evidence and a clear next action.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#scan" className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
                Run a Free Scan
              </a>
              <a href="/examples" className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:border-accent">
                See Sample Reports
              </a>
            </div>
            <div className="home-hero__proof mt-9 max-w-3xl border-y border-line sm:grid sm:grid-cols-3 sm:divide-x sm:divide-line">
              {[
                ["Official evidence", "Source records linked to each signal"],
                ["Commercial path", "The likely buyer, partner, or program"],
                ["Next action", "A concrete step your team can own"]
              ].map(([label, copy]) => (
                <div key={label} className="border-b border-line py-3 last:border-b-0 sm:border-b-0 sm:px-5 sm:first:pl-0">
                  <p className="text-xs font-semibold uppercase text-ember">{label}</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-ink">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-scan-section border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-16 lg:py-16">
          <div className="order-2 lg:order-1 lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase text-accent">Your first report</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-ink">
              See whether public money is already creating demand for what you sell.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              The free preview returns 2-3 sourced opportunities and shows how the product translates
              public records into buyer paths, partner targets, and concrete next steps.
            </p>
            <dl className="home-scan-steps mt-7 divide-y divide-line border-y border-line">
              {[
                ["1", "Your company website becomes the search profile"],
                ["2", "Public sources are screened for fit and timing"],
                ["3", "The strongest signals become action-ready rows"]
              ].map(([number, copy]) => (
                <div key={number} className="grid grid-cols-[32px_1fr] gap-3 py-4">
                  <dt className="text-sm font-semibold text-ember">0{number}</dt>
                  <dd className="text-sm font-semibold leading-6 text-ink">{copy}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="order-1 lg:order-2">
            <ScanForm searchParams={searchParams} />
          </div>
        </div>
      </section>

      <ProductProof />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <SectionIntro title="A working opportunity pipeline, not another research memo" eyebrow="What teams get">
            <p>
              Opportunity Scanner gives founders, sales teams, and operators the context needed to
              decide what is worth pursuing and who should own the next step.
            </p>
          </SectionIntro>
          <div className="mt-8 grid border-y border-line lg:grid-cols-3 lg:divide-x lg:divide-line">
            {[
              ["01", "Discover a new channel", "See agency buyers, funded organizations, grants, partner paths, and policy demand that match the offer already on your website."],
              ["02", "Prioritize the right motion", "Separate direct applications from agency sales, funded-buyer outreach, recipient partnerships, channel routes, and monitor-only signals."],
              ["03", "Move the opportunity", "Use source links, contact strategy, CRM-ready notes, outreach angles, exports, and workflow actions to keep the row moving."]
            ].map(([number, heading, copy]) => (
              <article key={number} className="border-b border-line py-6 last:border-b-0 lg:border-b-0 lg:px-7 lg:first:pl-0 lg:last:pr-0">
                <p className="text-xs font-semibold text-ember">{number}</p>
                <h3 className="mt-3 text-xl font-semibold text-ink">{heading}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-field">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <SectionIntro title="Built for companies beyond traditional government contractors" eyebrow="Industry paths">
              <p>
                Each industry path uses tailored opportunity language, source patterns, revenue motions,
                articles, sample reports, and practical guides.
              </p>
            </SectionIntro>
            <a href="/industries" className="w-fit text-sm font-semibold text-accent hover:text-[#0A6871]">View all industries</a>
          </div>
          <div className="mt-8 grid border-t border-line md:grid-cols-2 xl:grid-cols-3">
            {industryPages.map((industry) => (
              <a
                key={industry.slug}
                href={`/industries/${industry.slug}`}
                className="group border-b border-line py-5 md:odd:pr-6 md:even:border-l md:even:pl-6 xl:border-l xl:px-6 xl:[&:nth-child(3n+1)]:border-l-0 xl:[&:nth-child(3n+1)]:pl-0"
              >
                <p className="text-sm font-semibold text-ink group-hover:text-accent">{industry.name}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{industry.outcome}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">Access</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-ink">Start free. Unlock the action layer when the signals are worth pursuing.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Buy one complete report or choose monitoring when you need an ongoing source of new
              opportunities. Pricing and billing terms are shown before checkout.
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
