import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { BillingManagement } from "@/components/billing-management";
import { CheckoutButton } from "@/components/checkout-button";
import { CTASection, SectionIntro } from "@/components/marketing";
import { PricingAnalytics } from "@/components/page-analytics";
import { PricingCheckoutNotice } from "@/components/pricing-checkout-notice";
import { getStripeServerConfig } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

const title = "Pricing | Opportunity Scanner";
const description =
  "Choose a one-time opportunity report or ongoing public-sector opportunity monitoring for your company profiles.";

export const metadata: Metadata = {
  title: "Pricing",
  description,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title,
    description,
    url: "/pricing",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

const plans = [
  {
    name: "Report",
    price: "$49",
    cadence: "one-time",
    summary: "A complete opportunity report for one company profile.",
    badge: "Best first step",
    tone: "white",
    features: [
      "1 full company opportunity report",
      "All qualified signals and source links",
      "Revenue motion and next best action",
      "Contact paths, CRM notes, and outreach angles",
      "CSV, Markdown, and workflow-ready exports"
    ]
  },
  {
    name: "Monitor",
    price: "$99",
    cadence: "per month",
    annual: "$990/year when billed annually",
    summary: "Keep one saved company profile current with weekly opportunity monitoring.",
    badge: "2 months free annually",
    tone: "mist",
    features: [
      "1 saved company profile",
      "Weekly opportunity monitoring and alerts",
      "Full action layer for every included scan",
      "CSV and Markdown exports",
      "Workflow-ready opportunity data"
    ]
  },
  {
    name: "Growth",
    price: "$249",
    cadence: "per month",
    annual: "$2,490/year when billed annually",
    summary: "Build a daily opportunity pipeline across up to three saved profiles.",
    badge: "For active pursuit",
    tone: "ink",
    features: [
      "Up to 3 saved company profiles",
      "Daily opportunity monitoring and alerts",
      "Full action layer for every included scan",
      "30 contact-enrichment credits per month",
      "CRM/webhook workflows and outreach drafts"
    ]
  }
] as const;

function checkoutIsConfigured(): boolean {
  try {
    getStripeServerConfig();
    return true;
  } catch {
    return false;
  }
}

const faqs = [
  {
    question: "What is an enrichment credit?",
    answer:
      "One credit covers one attempt to enrich a contact path with person-level business contact data. An attempt may not return a verified contact, so every opportunity still includes a source-native route such as a program office, procurement portal, funded recipient, or partner target. Credits reset each billing month and do not roll over."
  },
  {
    question: "How do annual subscriptions work?",
    answer:
      "Annual Monitor is $990 and annual Growth is $2,490. Each is billed once per year at the cost of 10 monthly payments, giving you 12 months of access for the price of 10."
  },
  {
    question: "How do profile limits work?",
    answer:
      "A saved profile represents one company your monitoring plan follows over time. Monitor includes one saved company profile with weekly opportunity monitoring. Growth includes up to three saved company profiles with daily monitoring."
  },
  {
    question: "Can I buy a paid plan today?",
    answer:
      "Paid checkout is temporarily unavailable. Run a free scan now and return to pricing when checkout is restored."
  }
];

export default function PricingPage({
  searchParams
}: {
  searchParams?: { checkout?: string; session_id?: string; source?: string; scanId?: string };
}) {
  const checkoutEnabled = checkoutIsConfigured();
  const reportScanId = searchParams?.source === "report_gate" ? searchParams.scanId : undefined;
  const analyticsSource = searchParams?.checkout
    ? "checkout_return"
    : searchParams?.source === "report_gate"
      ? "report_gate"
      : searchParams?.source === "navigation"
        ? "navigation"
        : "unknown";

  return (
    <main className="min-h-screen bg-field">
      <PricingAnalytics source={analyticsSource} />
      <SiteHeader
        rightSlot={
          <a
            href="/#scan"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]"
          >
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-6 lg:pb-7 lg:pt-9">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <Badge tone="blue">Simple pricing</Badge>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
                Start with one report. Add monitoring when the channel proves itself.
              </h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600 lg:text-right">
              Every path begins with a free scan. Paid plans unlock the complete action layer and
              repeat scans on a clear schedule.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-7" aria-labelledby="plans-heading">
        <PricingCheckoutNotice checkout={searchParams?.checkout} />
        <BillingManagement
          checkout={searchParams?.checkout}
          checkoutSessionId={searchParams?.session_id}
        />
        <h2 id="plans-heading" className="sr-only">
          Opportunity Scanner plans
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.tone === "ink";
            const monitor = plan.tone === "mist";
            const checkoutPlan = plan.name === "Report" ? "report" : plan.name === "Monitor" ? "monitor" : "growth";

            return (
              <article
                key={plan.name}
                className={`flex min-w-0 flex-col rounded-lg border p-5 shadow-sm ${
                  featured
                    ? "border-ink bg-ink text-white"
                    : monitor
                      ? "border-accent bg-mist text-ink"
                      : "border-line bg-white text-ink"
                }`}
              >
                <div className="flex min-h-7 items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                      featured
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-line bg-white text-accent"
                    }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <p className="text-4xl font-semibold leading-none">{plan.price}</p>
                  <p className={`pb-1 text-sm ${featured ? "text-slate-300" : "text-muted"}`}>
                    {plan.cadence}
                  </p>
                </div>
                {"annual" in plan ? (
                  <p className={`mt-2 text-xs font-semibold ${featured ? "text-slate-200" : "text-accent"}`}>
                    {plan.annual}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-muted">No subscription required</p>
                )}

                <p className={`mt-4 text-sm leading-6 ${featured ? "text-slate-300" : "text-slate-600"}`}>
                  {plan.summary}
                </p>

                <ul className={`mt-4 grid gap-2 border-t pt-4 text-sm ${featured ? "border-white/15 text-slate-200" : "border-line text-slate-700"}`}>
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${featured ? "bg-emerald-300" : "bg-signal"}`}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <CheckoutButton
                  plan={checkoutPlan}
                  checkoutEnabled={checkoutEnabled}
                  featured={featured}
                  scanId={plan.name === "Report" ? reportScanId : undefined}
                />
              </article>
            );
          })}
        </div>
        {!checkoutEnabled ? (
          <p className="mt-4 text-center text-xs leading-5 text-muted">
            Paid checkout is temporarily unavailable. The free scan is available now.
          </p>
        ) : null}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <SectionIntro eyebrow="Compare the value" title="The action layer is included in every paid option">
            <p>
              Paid results turn sourced signals into a pursuit list: what matters, who or what to
              approach, why now, and the next step that moves the opportunity forward.
            </p>
          </SectionIntro>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Sourced opportunity table", "Qualified grants, contracts, funded buyers, award recipients, policy signals, and money-flow records with source links."],
              ["Pursuit guidance", "A revenue motion, actionability label, next best action, contact path, CRM-ready note, and outreach angle for each signal."],
              ["Practical contact routes", "Source-native contacts come first. Enrichment is used selectively when a person-level contact would improve the next step."]
            ].map(([title, copy]) => (
              <article key={title} className="border-t-2 border-accent pt-4">
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        <SectionIntro eyebrow="FAQ" title="Limits and billing, without fine-print surprises" />
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="border-t border-line pt-4">
              <h3 className="text-base font-semibold text-ink">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {faq.question === "Can I buy a paid plan today?" && checkoutEnabled
                  ? "Yes. Monitor and Growth can be purchased here through secure Stripe checkout. The $49 report can be purchased from an existing free report so access returns to the correct scan."
                  : faq.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <CTASection title="Find the public-sector paths worth pursuing.">
        <p>
          Run a free scan to see real signals for your company, then choose the level of action and
          monitoring your team needs.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
