import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection, MarketingCard, MarketingHero, SectionIntro } from "@/components/marketing";
import { SampleReportPreview } from "@/components/sample-report";
import { getSampleReportByExampleSlug } from "@/lib/sampleReports";

const title = "How It Works | Opportunity Scanner";
const description =
  "See how Opportunity Scanner builds a company profile, finds sourced public-sector opportunities, routes next actions, and monitors what changes.";

export const metadata: Metadata = {
  title: "How It Works",
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title,
    description,
    url: "/how-it-works",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

const steps = [
  {
    title: "Scan your company",
    badge: "Step 1",
    copy:
      "We read your website to understand what you sell, who you serve, where you operate, and how that maps into public-sector buying, funding, workforce, reimbursement, and policy language."
  },
  {
    title: "Find sourced opportunity signals",
    badge: "Step 2",
    copy:
      "The scan looks across public records, then separates verified live postings from historical funded-buyer evidence so timing and next actions stay honest."
  },
  {
    title: "Translate signals into actions",
    badge: "Step 3",
    copy:
      "Each useful signal becomes an opportunity row with a target organization, source evidence, revenue motion, actionability, contact path, and next best action."
  },
  {
    title: "Pursue or monitor",
    badge: "Step 4",
    copy:
      "Open the official route, start a pursuit, assign an owner, qualify fit, track requirements and notes, or use an available monitoring plan for future changes."
  }
];

export default function HowItWorksPage() {
  const civicStage = getSampleReportByExampleSlug("creative-economy-live-events-opportunity-scan");

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
        eyebrow="How it works"
        title="From company website to public-sector opportunity pipeline."
        secondaryLabel="Read the revenue channel guide"
        secondaryHref="/public-sector-revenue"
      >
        <p>
          Start with a company website. The product builds a focused profile, finds sourced public
          records, explains the commercial path, and gives each opportunity a useful next action.
        </p>
      </MarketingHero>

      {civicStage ? <SampleReportPreview report={civicStage} /> : null}

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <MarketingCard key={step.title} title={step.title} badge={step.badge}>
            <p>{step.copy}</p>
          </MarketingCard>
        ))}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <SectionIntro title="What comes back in a useful scan" eyebrow="Output">
            <p>
              The report is designed to answer what a founder, sales team, partnerships lead, or
              operator needs next: where public money is moving, who to pursue, why it matters, and
              how to act without staring at raw government data.
            </p>
          </SectionIntro>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Opportunity signal",
              "Target organization",
              "Source link",
              "Revenue motion",
              "Actionability",
              "Contact path",
              "Next best action",
              "Workflow-ready note"
            ].map((item) => (
              <div key={item} className="rounded-md border border-line bg-field px-4 py-3 text-sm font-semibold text-ink">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-field">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <SectionIntro title="One signal can lead to different next actions" eyebrow="Opportunity routing">
            <p>
              The product does not treat every public record as an application. It identifies the
              practical route based on the source, buyer, timing, and revenue motion.
            </p>
          </SectionIntro>
          <div className="mt-6 grid border-y border-line md:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line">
            {[
              ["Open official application", "Follow the official instructions when the company is an eligible direct applicant."],
              ["Register as vendor", "Follow the procurement or vendor-registration path when the buyer purchases from suppliers."],
              ["Contact buyer or partner", "Use the program office, funded recipient, prime, or source-native contact route."],
              ["Monitor the signal", "Save a focused search when timing is early, recurring, or not yet open for action."]
            ].map(([title, copy]) => (
              <article key={title} className="border-b border-line py-5 last:border-b-0 md:px-5 lg:border-b-0 lg:first:pl-0 lg:last:pr-0">
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <SectionIntro title="The product is not trying to force every signal into one path" eyebrow="Contact strategy">
          <p>
            Sometimes the right next step is an email. Sometimes it is a procurement office, program
            office, source-native contact, vendor registration path, partner target, grantee,
            award recipient, distributor, or manual research task.
          </p>
        </SectionIntro>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Source-native first", "When a source record includes a useful program or procurement contact, the report preserves that path before third-party enrichment."],
              ["Growth enrichment where appropriate", "Growth accounts can use capped person-level enrichment when the company or partner target is eligible."],
            ["No fake certainty", "If a direct contact is not available, the report recommends the most practical contact path or research task."]
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
          <SectionIntro title="The account becomes the operating layer" eyebrow="After the report">
            <p>
              Customers can return to reports, organize pursuits, manage saved searches and alert
              preferences, compare report snapshots, export rows, and manage billing from one account.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Dashboard", "See reports, pursuits, saved searches, alerts, plan status, and usage in one place."],
              ["Monitoring", "Run a qualified company profile on the plan cadence and review new or updated signals."],
              ["Pursuit workspace", "Keep source evidence, contact strategy, next action, notes, and status attached to the opportunity."],
              ["Alerts and comparisons", "Review what appeared or changed instead of rereading the entire public-source landscape."],
              ["Exports and workflows", "Download structured rows or send opportunity context to a secure webhook destination."],
              ["Billing and growth", "Review plan status and manage billing; Growth adds profiles, daily checks, and capped enrichment."]
            ].map(([title, copy]) => (
              <article key={title} className="rounded-lg border border-line bg-field p-5">
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Monitor and Growth plan availability is shown in real time on the pricing page.
          </p>
        </div>
      </section>

      <CTASection title="Start with a focused scan.">
        <p>
          You do not need a government sales team to check whether public-sector demand exists
          around what your company already sells. Review the CivicStage sample first, or scan a real
          company website.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
