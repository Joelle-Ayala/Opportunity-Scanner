import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { ScanSubmitButton } from "@/components/scan-submit-button";

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

export default function HomePage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const errorMessage =
    searchParams?.error === "invalid-url" ? "Enter a valid company website URL." : null;

  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_480px] lg:py-16">
          <div className="self-center">
            <Badge tone="blue">Public-sector opportunity intelligence</Badge>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight text-ink">
              Build a workflow-ready pipeline from public-sector money flows.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Opportunity Scanner turns your company website into a source-backed opportunity
              pipeline across funding, procurement, policy, workforce, reimbursement, and public
              spending. Each row points to a buyer or partner target, evidence, contact path,
              revenue motion, and next action.
            </p>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted">
              Free scan includes 2-3 sourced opportunities. Unlock the full report for the action
              layer: buyer and partner targets, source records, CRM-ready notes, outreach angles,
              and workflow-ready payloads.
            </p>
            <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
              {["Buyer and partner targets", "Source-backed evidence", "Workflow-ready actions"].map(
                (item) => (
                  <div key={item} className="rounded-lg border border-line bg-field p-4 text-sm font-semibold text-ink">
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <form id="scan" action="/api/scans" method="post" className="rounded-lg border border-line bg-white p-6 shadow-sm">
            <input type="hidden" name="reportType" value="quick" />
            <h2 className="text-xl font-semibold text-ink">Run Free Opportunity Scan</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Enter a website and work email. Add context if you want the pipeline prioritized for
              specific buyers, partners, regions, or public-sector money flows.
            </p>
            {errorMessage ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Company website URL</span>
                <input
                  required
                  name="companyUrl"
                  type="url"
                  placeholder="https://example.com"
                  className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Work email</span>
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-ink">Company name</span>
                  <input
                    name="companyName"
                    placeholder="Optional"
                    className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-ink">Industry</span>
                  <input
                    name="industry"
                    placeholder="Healthcare, education, SaaS..."
                    className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-ink">Headquarters state</span>
                  <input
                    name="headquartersState"
                    placeholder="MD"
                    className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-ink">Target states / regions</span>
                  <input
                    name="targetStates"
                    placeholder="MD, CA, national"
                    className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                  />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Customer type</span>
                <select
                  name="customerType"
                  defaultValue=""
                  className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                >
                  <option value="">Optional</option>
                  {customerTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium text-ink">What are you looking for?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {focusOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 rounded-md border border-line bg-field px-3 py-2 text-sm text-slate-700"
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
                <span className="text-sm font-medium text-ink">Optional context</span>
                <textarea
                  name="opportunityFocus"
                  rows={3}
                  placeholder="Example: buyer targets for city programs, workforce funding, or public event procurement"
                  className="rounded-md border border-line bg-field px-3 py-3 outline-none focus:border-accent"
                />
              </label>
              <ScanSubmitButton />
              <p className="text-xs leading-5 text-muted">
                Scans usually take under a minute while we read the website and check public-sector sources.
              </p>
            </div>
          </form>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-3">
        {[
          ["1. Translate", "Opportunity Scanner turns your company into public-sector buying and funding language."],
          ["2. Prioritize", "It ranks source-backed opportunities by buyer clarity, timing, revenue motion, and fit."],
          ["3. Move", "Each row becomes a target, contact path, CRM-ready note, outreach angle, and workflow action."]
        ].map(([title, copy]) => (
          <article key={title} className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
          </article>
        ))}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold text-ink">What Opportunity Scanner looks for</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The scan looks for public records that can become buyer targets, partner targets,
              account research, or workflow-ready business development tasks.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Funding and grant programs",
              "Government contracts and active bids",
              "Funded buyers and award recipients",
              "Policy and regulatory triggers",
              "Workforce incentives",
              "Healthcare reimbursement pathways",
              "State and local spending",
              "Buyer and partner targets"
            ].map((item) => (
              <div key={item} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-2">
        <article className="rounded-lg border border-line bg-white p-6">
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">High Actionability</Badge>
            <Badge tone="blue">Sell to Funded Buyer</Badge>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-ink">Example pipeline row</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            A public agency funded a program adjacent to your offer, creating a credible buyer or
            partner target with source-backed evidence.
          </p>
          <div className="mt-5 grid gap-3 text-sm">
            <p><span className="font-semibold text-ink">Target organization:</span> County program office</p>
            <p><span className="font-semibold text-ink">Contact path:</span> Find program manager or procurement contact</p>
            <p><span className="font-semibold text-ink">Recommended next step:</span> Validate fit, add a CRM-ready note, and send source-backed outreach.</p>
          </div>
        </article>

        <article className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">Free vs Full report</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Free scan", "A preview with 2-3 sourced opportunities, target lanes, source summaries, and next steps."],
              ["Full scan - $99", "The full workflow-ready pipeline: all prioritized opportunities, buyer/partner targets, source records, contact paths, CRM notes, outreach angles, workflow send, and PDF/export."]
            ].map(([title, copy]) => (
              <div key={title} className="rounded-md border border-line bg-field p-4">
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Send opportunities into your workflow</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The full report packages each opportunity with target account, source evidence,
              contact path, next step, CRM note, and outreach angle for Zapier, Make, n8n,
              Airtable, Notion, Slack, HubSpot workflows, or your CRM.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Create CRM deal", "Post Slack alert", "Add Airtable record", "Create Notion task"].map((item) => (
              <div key={item} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="text-2xl font-semibold text-ink">FAQ</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Is this just a grant finder?", "No. It looks across funding, procurement, policy, workforce, reimbursement, and public spending records."],
            ["What does the free scan include?", "A preview report with 2-3 sourced opportunities, target lanes, source summaries, and recommended next steps."],
            ["Do I need public-sector experience?", "No. The report translates public records into revenue motions, contact paths, and buyer or partner targets."],
            ["Can I send results to my tools?", "The full report includes workflow-ready rows for common automation tools, CRMs, and outbound webhooks."]
          ].map(([question, answer]) => (
            <details key={question} className="rounded-lg border border-line bg-white p-5">
              <summary className="cursor-pointer font-semibold text-ink">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
