import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { SectionIntro } from "@/components/marketing";
import { siteUrl } from "@/lib/marketingContent";

export const metadata: Metadata = {
  title: "Source Coverage",
  description:
    "The public-sector source categories Opportunity Scanner uses to find funding, procurement, funded buyer, policy, workforce, reimbursement, and money-flow signals.",
  alternates: {
    canonical: `${siteUrl}/source-coverage`
  }
};

const sources = [
  {
    name: "SAM.gov",
    category: "Money available now",
    use: "Federal procurement notices, solicitations, award notices, sources sought, and vendor paths.",
    url: "https://sam.gov/content/opportunities"
  },
  {
    name: "Grants.gov",
    category: "Money available now",
    use: "Federal grant opportunities, grant-making agencies, funding categories, eligibility signals, and deadlines.",
    url: "https://www.grants.gov/learn-grants/grant-making-agencies"
  },
  {
    name: "USAspending.gov",
    category: "Money already moved",
    use: "Federal award records that can reveal funded buyers, award recipients, agencies, vendors, and market patterns.",
    url: "https://www.usaspending.gov/"
  },
  {
    name: "Federal Register",
    category: "Policy demand coming",
    use: "Agency notices, proposed rules, public programs, and policy signals that may point to emerging demand.",
    url: "https://www.federalregister.gov/"
  },
  {
    name: "Regulations.gov",
    category: "Policy and regulatory signals",
    use: "Rulemaking and comment activity that can indicate future compliance, market, or implementation needs.",
    url: "https://www.regulations.gov/"
  },
  {
    name: "BLS",
    category: "Workforce context",
    use: "Labor market and occupation context for workforce, staffing, and training opportunity analysis.",
    url: "https://www.bls.gov/"
  },
  {
    name: "Census",
    category: "Market context",
    use: "Geography, business, demographic, and market context used to understand public-sector fit.",
    url: "https://www.census.gov/"
  },
  {
    name: "CMS",
    category: "Healthcare and reimbursement context",
    use: "Healthcare program, reimbursement, and public care context for healthcare-adjacent opportunity signals.",
    url: "https://www.cms.gov/"
  },
  {
    name: "DOL",
    category: "Workforce funding",
    use: "Workforce, training, jobs, apprenticeship, and employment-program signals.",
    url: "https://www.dol.gov/"
  }
];

const principles = [
  "Opportunity Scanner treats source records as evidence, not as guaranteed revenue.",
  "Historical awards are separated from active opportunities.",
  "Source-native contacts and official routing paths are preferred before third-party enrichment.",
  "Every useful signal should map to a revenue motion, contact path, and next best action.",
  "If a source does not support immediate outreach, it should be marked as monitor or research only."
];

export default function SourceCoveragePage() {
  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-line bg-cream">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <Badge tone="blue">Source coverage</Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Public-sector sources are the starting point. The action layer is the product.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Opportunity Scanner uses public-source categories to identify funding, procurement,
            money-flow, policy, workforce, reimbursement, and buyer signals, then turns them into
            opportunity rows your team can pursue, monitor, enrich, or route into workflow.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="Core source categories" eyebrow="Citations">
          <p>
            These sources explain the public data categories the product is designed around. Source
            coverage can vary by credentials, API availability, and connector health.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {sources.map((source) => (
            <article key={source.name} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">{source.name}</Badge>
                <Badge tone="green">{source.category}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{source.use}</p>
              <a href={source.url} target="_blank" rel="noreferrer" className="mt-5 inline-flex text-sm font-semibold text-accent hover:text-[#0A6871]">
                View source
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="How Opportunity Scanner interprets sources" eyebrow="Quality rules" />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {principles.map((principle) => (
              <div key={principle} className="rounded-md border border-line bg-field p-4 text-sm font-semibold leading-6 text-ink">
                {principle}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
