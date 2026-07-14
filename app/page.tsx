import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { ReportPreview, SectionIntro } from "@/components/marketing";
import { ScanSubmitButton } from "@/components/scan-submit-button";
import { industryPages, revenueOutcomes, solutionPages } from "@/lib/marketingContent";

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

const visualMoments = [
  {
    title: "Founder sees a new channel",
    copy: "The scan turns a normal company website into public-sector search logic, then shows where money and demand already exist.",
    image: "/product-proof/report-overview.jpg",
    alt: "Opportunity Scanner report overview with sourced opportunity summary"
  },
  {
    title: "Sales team gets a target list",
    copy: "Instead of a raw research memo, each signal becomes a buyer, partner, agency, recipient, or contact path to work.",
    image: "/product-proof/report-pipeline.png",
    alt: "Opportunity Scanner action table with targets, revenue motions, and next steps"
  },
  {
    title: "Ops can route the next step",
    copy: "Rows can move into outreach, CRM, Zapier, Make, n8n, Airtable, Slack, or a founder's research workflow.",
    image: "/product-proof/report-actions.png",
    alt: "Opportunity Scanner sample report with target, contact path, and next best action"
  }
];

function CustomerVisualSection() {
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <SectionIntro title="Find a new path to revenue without searching another database." eyebrow="How teams use it">
          <p>
            Find buyer targets, funded partners, public programs, and practical next steps your
            team may not know to search for today.
          </p>
        </SectionIntro>
        <div className="mt-8 grid border-y border-line lg:grid-cols-3 lg:divide-x lg:divide-line">
          {visualMoments.map((moment) => (
            <article key={moment.title} className="border-b border-line py-6 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <div className="overflow-hidden rounded-md border border-line bg-field">
                <img src={moment.image} alt={moment.alt} className="aspect-[16/10] w-full object-cover object-top" loading="lazy" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{moment.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{moment.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const errorMessage =
    searchParams?.error === "invalid-url" ? "Enter a valid company website URL." : null;

  return (
    <main className="min-h-screen bg-white">
      <SiteHeader
        rightSlot={
          <a href="#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-slate-700 bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-start gap-8 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-x-12 lg:py-12">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">Public-sector revenue intelligence</Badge>
              <Badge tone="green">New deal-flow channel</Badge>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Find a new public-sector revenue channel from your company website.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              Opportunity Scanner finds government contracts, funded buyers, grants, policy
              signals, workforce programs, reimbursement pathways, and public money flows, then
              turns them into actions your team can actually pursue.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#scan" className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-mist">
                Scan Your Company Website
              </a>
              <a href="/public-sector-revenue" className="rounded-md border border-slate-500 px-4 py-3 text-sm font-semibold text-white hover:border-slate-200 hover:bg-white/5">
                Learn About This Channel
              </a>
            </div>
          </div>

          <div className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <form id="scan" action="/api/scans" method="post" className="rounded-lg border border-slate-200 bg-white p-5 text-ink shadow-lift sm:p-6">
              <input type="hidden" name="reportType" value="quick" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Run Free Opportunity Scan</h2>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent">Start with website + email</p>
                </div>
                <Badge tone="amber">Beta</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                Get 2-3 sourced rows now. Add optional context only if you want a tighter scan.
              </p>
              {errorMessage ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}
              <div className="mt-5 grid gap-3">
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

                <p className="text-xs leading-5 text-muted">
                  We use your email to provide and support the requested scan. See our{" "}
                  <a href="/privacy" className="font-semibold text-accent hover:underline">privacy notice</a>.
                </p>

                <details className="rounded-lg border border-line bg-field p-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    Prioritize my scan with more context
                    <span className="ml-2 text-xs font-medium text-muted">Optional</span>
                  </summary>
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-ink">Company name</span>
                        <input
                          name="companyName"
                          placeholder="Optional"
                          className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-ink">Industry</span>
                        <input
                          name="industry"
                          placeholder="Healthcare, education, marketing..."
                          className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-ink">HQ state</span>
                        <input
                          name="headquartersState"
                          placeholder="MD"
                          className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium text-ink">Target regions</span>
                        <input
                          name="targetStates"
                          placeholder="MD, CA, national"
                          className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
                        />
                      </label>
                    </div>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-ink">Customer type</span>
                      <select
                        name="customerType"
                        defaultValue=""
                        className="rounded-md border border-line bg-white px-3 py-3 outline-none focus:border-accent"
                      >
                        <option value="">Optional</option>
                        {customerTypes.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-medium text-ink">What should we look for?</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {focusOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-slate-700 hover:border-accent"
                          >
                            <input
                              type="checkbox"
                              name="prioritySignals"
                              value={option.value}
                              className="h-4 w-4 rounded border-line"
                            />
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
          </div>

          <div className="grid max-w-3xl border-y border-white/15 sm:grid-cols-3 sm:divide-x sm:divide-white/15 lg:col-start-1 lg:row-start-2">
            {[
              ["SOURCE", "Public records linked to every signal"],
              ["MOTION", "A clear path to revenue"],
              ["ACTION", "A next step your team can route"]
            ].map(([label, item]) => (
              <div key={item} className="border-b border-white/15 py-4 last:border-b-0 sm:border-b-0 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                <p className="text-xs font-semibold text-teal-300">{label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white">{item}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl overflow-hidden rounded-lg border border-white/20 bg-white shadow-lift lg:col-start-1 lg:row-start-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-field px-4 py-3 text-ink">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">Product proof</p>
                <p className="mt-1 text-sm font-semibold">A sourced report, not a company summary</p>
              </div>
              <Badge tone="green">High Actionability</Badge>
            </div>
            <img
              src="/product-proof/report-overview.jpg"
              alt="Opportunity Scanner report showing sourced opportunity signals and an executive summary"
              className="aspect-[16/8] w-full object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl divide-y divide-line px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["2-3", "real sourced signals in the free preview"],
            ["8", "revenue motions used to classify the path"],
            ["1 row", "from source evidence to target and next action"]
          ].map(([value, label]) => (
            <div key={label} className="py-6 sm:px-6 sm:first:pl-0 sm:last:pr-0">
              <p className="text-2xl font-semibold text-ink">{value}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-field py-2">
        <ReportPreview />
      </div>

      <CustomerVisualSection />

      <section className="bg-field">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <SectionIntro title="Revenue outcomes the scan can surface" eyebrow="What this turns into">
            <p>
              The scan is not trying to summarize your company. It identifies public-sector paths
              your team can pursue, route, monitor, or move into a workflow.
            </p>
          </SectionIntro>
          <div className="mt-8 grid border-t border-line md:grid-cols-2">
            {revenueOutcomes.map((outcome, index) => (
              <article
                key={outcome.label}
                className="grid grid-cols-[36px_1fr] gap-3 border-b border-line py-5 md:odd:pr-8 md:even:border-l md:even:pl-8"
              >
                <span className={`text-sm font-semibold ${index === 2 ? "text-ember" : index === 4 ? "text-signal" : "text-accent"}`}>
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{outcome.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{outcome.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <SectionIntro title="Three ways teams use Opportunity Scanner" eyebrow="Solutions">
          <p>
            Start with a scan to see where public-sector revenue may fit, then route the strongest
            opportunities into sales, partnerships, research, or your existing workflow.
          </p>
        </SectionIntro>
        <div className="mt-8 grid border-y border-line lg:grid-cols-3 lg:divide-x lg:divide-line">
          {solutionPages.map((solution) => (
            <article key={solution.slug} className="border-b border-line py-6 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
              <Badge tone="blue">{solution.name}</Badge>
              <h2 className="mt-4 text-xl font-semibold leading-7 text-ink">{solution.headline}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{solution.description}</p>
              <a href={`/solutions/${solution.slug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                View solution
              </a>
            </article>
          ))}
        </div>
        </div>
      </section>

      <section className="bg-field">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <SectionIntro title="Public-sector revenue can show up in markets that do not think of themselves as government vendors." eyebrow="Industries">
            <p>
              Opportunity Scanner is built for companies exploring public money, funded buyers,
              agencies, partners, and policy demand as a new deal-flow channel.
            </p>
          </SectionIntro>
          <div className="mt-8 grid border-t border-line md:grid-cols-2 xl:grid-cols-4">
            {industryPages.map((industry) => (
              <article key={industry.slug} className="border-b border-line py-6 md:px-5 md:odd:border-r md:odd:pl-0 xl:border-r xl:odd:border-r xl:[&:nth-child(4n+1)]:pl-0 xl:[&:nth-child(4n)]:border-r-0 xl:[&:nth-child(4n)]:pr-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">{industry.name}</p>
                <h2 className="mt-3 text-lg font-semibold leading-6 text-ink">{industry.headline}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{industry.outcome}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {industry.revenueMotions.slice(0, 2).map((motion) => (
                    <Badge key={motion} tone="green">{motion}</Badge>
                  ))}
                </div>
                <a href={`/industries/${industry.slug}`} className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                  View industry path
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl px-6 py-14 md:grid-cols-3 md:divide-x md:divide-line lg:py-16">
          {[
            ["01", "Translate", "Opportunity Scanner turns your company into public-sector buying and funding language."],
            ["02", "Prioritize", "It ranks source-backed opportunities by buyer clarity, timing, revenue motion, and fit."],
            ["03", "Move", "Each row becomes a target, contact path, CRM-ready note, outreach angle, and workflow action."]
          ].map(([number, title, copy], index) => (
            <article key={title} className={`border-b border-line py-6 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0 ${index === 1 ? "text-accent" : ""}`}>
              <p className="text-xs font-semibold text-ember">{number}</p>
              <h2 className="mt-3 text-xl font-semibold text-ink">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-field">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[0.75fr_1.25fr] lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Coverage</p>
            <h2 className="text-2xl font-semibold text-ink">What Opportunity Scanner looks for</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The scan looks for public records that can become buyer targets, partner targets,
              account research, or workflow-ready business development tasks.
            </p>
          </div>
          <div className="grid border-t border-line sm:grid-cols-2">
            {[
              "Funding and grant programs",
              "Government contracts and active bids",
              "Funded buyers and award recipients",
              "Policy and regulatory triggers",
              "Workforce incentives",
              "Healthcare reimbursement pathways",
              "State and local spending",
              "Buyer and partner targets"
            ].map((item, index) => (
              <div key={item} className="flex gap-3 border-b border-line py-4 text-sm font-semibold text-ink sm:odd:pr-6 sm:even:border-l sm:even:pl-6">
                <span className={index === 2 || index === 6 ? "text-ember" : "text-signal"}>+</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-2 lg:gap-14 lg:py-16">
          <article>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">High Actionability</Badge>
              <Badge tone="blue">Sell to Funded Buyer</Badge>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-ink">Example pipeline row</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              A public agency funded a program adjacent to your offer, creating a credible buyer or
              partner target with source-backed evidence.
            </p>
            <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
              {[
                ["Target organization", "County program office"],
                ["Contact path", "Find program manager or procurement contact"],
                ["Recommended next step", "Validate fit, add a CRM-ready note, and send source-backed outreach."]
              ].map(([label, value]) => (
                <div key={label} className="grid gap-1 py-4 sm:grid-cols-[155px_1fr] sm:gap-4">
                  <dt className="font-semibold text-ink">{label}</dt>
                  <dd className="leading-6 text-slate-600">{value}</dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="border-t-4 border-ember pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ember">Access</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Free vs Full report</h2>
            <div className="mt-5 divide-y divide-line border-y border-line">
            {[
              ["Free scan", "A preview with 2-3 sourced opportunity signals, total signals found, target lanes, source summaries, and next steps."],
              ["Full report access", "The full action layer: all prioritized opportunities, source links, revenue motions, contact paths, CRM-ready notes, outreach drafts, workflow export, and capped contact enrichment where appropriate. Purchase the full report from your free scan, or choose a monitoring plan through secure checkout."]
            ].map(([title, copy]) => (
              <div key={title} className="py-4">
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
            </div>
          </article>
          </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Workflow-ready</p>
            <h2 className="mt-2 text-2xl font-semibold">Send opportunities into your workflow</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The full report packages each opportunity with target account, source evidence,
              contact path, next step, CRM note, and outreach angle for Zapier, Make, n8n,
              Airtable, Notion, Slack, HubSpot workflows, or your CRM.
            </p>
          </div>
          <div className="grid border-y border-white/15 sm:grid-cols-2">
            {["Create CRM deal", "Post Slack alert", "Add Airtable record", "Create Notion task"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 border-b border-white/15 py-4 text-sm font-semibold last:border-b-0 sm:px-5 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
                <span className={index === 1 ? "text-ember" : "text-signal"}>+</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
        <h2 className="text-2xl font-semibold text-ink">FAQ</h2>
        <div className="mt-6 grid gap-x-8 md:grid-cols-2">
          {[
            ["Is this just a grant finder?", "No. It looks across funding, procurement, policy, workforce, reimbursement, and public spending records."],
            ["What does the free scan include?", "A preview report with 2-3 sourced opportunities, target lanes, source summaries, and recommended next steps."],
            ["Do I need public-sector experience?", "No. The report translates public records into revenue motions, contact paths, and buyer or partner targets."],
            ["Can I send results to my tools?", "The full report includes workflow-ready rows for common automation tools, CRMs, and outbound webhooks."]
          ].map(([question, answer]) => (
            <details key={question} className="border-t border-line py-5 last:border-b md:[&:nth-last-child(-n+2)]:border-b">
              <summary className="cursor-pointer font-semibold text-ink marker:text-accent">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
