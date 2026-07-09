import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingCard, MarketingHero, SectionIntro } from "@/components/marketing";

export const metadata: Metadata = {
  title: "Public-Sector Revenue",
  description:
    "Government spending, grants, funded buyers, policy signals, and workforce programs can become a new revenue channel for businesses."
};

const signalTypes = [
  ["Money already moved", "Award history and spending records can reveal funded buyers, primes, recipients, agencies, and market patterns."],
  ["Money available now", "Active grants, procurement notices, solicitations, and funding programs can point to near-term action."],
  ["Demand forming", "Policy, workforce, reimbursement, and regulatory signals can show where public-sector demand may be emerging."],
  ["Contact path", "The right next move may be a source-native contact, procurement office, program office, funded recipient, partner, or vendor registration path."]
];

export default function PublicSectorRevenuePage() {
  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <MarketingHero
        eyebrow="Public-sector revenue channel"
        title="Government spending is not just for government contractors."
        ctaLabel="Find Public-Sector Opportunities"
        secondaryLabel="Read resources"
        secondaryHref="/resources"
      >
        <p>
          Public-sector money moves through contracts, grants, funded buyers, award recipients,
          primes, workforce programs, policy priorities, and reimbursement pathways. Opportunity
          Scanner helps companies find where that money connects to what they sell.
        </p>
      </MarketingHero>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
        {signalTypes.map(([title, copy]) => (
          <MarketingCard key={title} title={title}>
            <p>{copy}</p>
          </MarketingCard>
        ))}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro title="The channel most companies ignore" eyebrow="Why it matters">
            <p>
              Many companies assume public-sector opportunity means slow bids, grant writing, or
              complex government contracting. Those paths exist, but they are not the whole market.
              Public money also creates demand signals that commercial teams can use for sales,
              partnerships, channel strategy, and market expansion.
            </p>
          </SectionIntro>
          <div className="rounded-lg border border-line bg-field p-5">
            <h2 className="text-lg font-semibold text-ink">Not every opportunity is a bid.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sometimes the best move is selling to a funded buyer, partnering with a recipient,
              monitoring policy, registering as a vendor, researching an award recipient, or
              contacting a program office. Opportunity Scanner keeps those paths separate so the
              report does not collapse everything into generic outreach.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="The problem is translation" eyebrow="From data to action">
          <p>
            The public data is scattered across government portals, award records, funding notices,
            agency pages, policy records, and enrichment providers. Businesses need that data
            translated into revenue motions and next steps.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Raw public data", "Useful but hard to interpret, often written for procurement, compliance, or program audiences."],
            ["Opportunity intelligence", "A sourced signal with fit, actionability, target organization, and source evidence."],
            ["Business development action", "A contact path, outreach angle, CRM-ready note, workflow export, or manual research task."]
          ].map(([title, copy]) => (
            <article key={title} className="rounded-lg border border-line bg-white p-5 shadow-sm">
              <Badge tone="blue">{title}</Badge>
              <p className="mt-4 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="Public-sector opportunity paths" eyebrow="Revenue motions">
            <p>
              Opportunity Scanner keeps the pursuit motion explicit so teams do not confuse
              historical market evidence, active opportunities, funding signals, and policy demand.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Direct Apply",
              "Sell to Agency",
              "Sell to Funded Buyer",
              "Sell to Award Recipient",
              "Partner with Recipient",
              "Channel / Distributor Motion",
              "Monitor Policy",
              "Research Only"
            ].map((motion) => (
              <div key={motion} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {motion}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection title="See where your company fits.">
        <p>
          Scan your website to find sourced public-sector opportunity signals and turn them into
          target organizations, contact paths, and next best actions.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
