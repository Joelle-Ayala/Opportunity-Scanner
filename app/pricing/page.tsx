import type { Metadata } from "next";
import { Badge, SiteFooter, SiteHeader } from "@/components/brand";
import { BillingManagement } from "@/components/billing-management";
import { CheckoutButton } from "@/components/checkout-button";
import { CTASection, ProductActionPath, SectionIntro } from "@/components/marketing";
import { PricingAnalytics } from "@/components/page-analytics";
import { PricingCheckoutNotice } from "@/components/pricing-checkout-notice";
import { evaluateLaunchHealth } from "@/lib/launchHealth";
import { getStripeServerConfig, reportCheckoutIsEnabled } from "@/lib/payments/config";
import type { BillingInterval } from "@/lib/payments/contract";

export const dynamic = "force-dynamic";

const title = "Pricing | Opportunity Scanner";
const description =
  "Compare one-time opportunity reports with planned public-sector monitoring options; current checkout availability is shown on the page.";

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
      "Tracked pursuits with owner, fit, due date, and notes",
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
      "Tracked pursuits and official source routes",
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
      "Tracked pursuits and official source routes",
      "30 contact-enrichment credits per month",
      "Secure webhook handoff and outreach drafts"
    ]
  }
] as const;

function checkoutAvailability(): { report: boolean; subscriptions: boolean } {
  try {
    const config = getStripeServerConfig();
    const health = evaluateLaunchHealth(process.env);
    return {
      report: reportCheckoutIsEnabled() && health.ready.reportCheckout,
      subscriptions: config.subscriptionCheckoutEnabled && health.ready.subscriptionCheckout
    };
  } catch {
    return { report: false, subscriptions: false };
  }
}

type PricingSearchParams = {
  billing_interval?: string;
  checkout?: string;
  plan?: string;
  session_id?: string;
  source?: string;
  scanId?: string;
};

type PricingAnalyticsSource = Parameters<typeof PricingAnalytics>[0]["source"];

function pricingAnalyticsSource(searchParams?: PricingSearchParams): PricingAnalyticsSource {
  if (searchParams?.checkout) return "checkout_return";
  if (searchParams?.source === "report_gate") return "report_gate";
  if (searchParams?.source === "navigation") return "navigation";
  if (searchParams?.source === "nurture") return "nurture";
  return "unknown";
}

function nurtureBillingIntent(searchParams?: PricingSearchParams): BillingInterval | undefined {
  return searchParams?.source === "nurture" && searchParams.billing_interval === "annual"
    ? "annual"
    : undefined;
}

function resumableSubscriptionCheckout(searchParams?: PricingSearchParams): {
  plan: "monitor" | "growth";
  billingInterval: BillingInterval;
} | null {
  if (searchParams?.checkout !== "resume") return null;
  if (searchParams.plan !== "monitor" && searchParams.plan !== "growth") return null;
  if (searchParams.billing_interval !== "monthly" && searchParams.billing_interval !== "annual") return null;

  return {
    plan: searchParams.plan,
    billingInterval: searchParams.billing_interval
  };
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
  searchParams?: PricingSearchParams;
}) {
  const checkout = checkoutAvailability();
  const resumeCheckout = checkout.subscriptions ? resumableSubscriptionCheckout(searchParams) : null;
  const reportScanId = searchParams?.source === "report_gate" || searchParams?.source === "checkout_return"
    ? searchParams.scanId
    : undefined;
  const analyticsSource = pricingAnalyticsSource(searchParams);
  const availabilityMessage = checkout.subscriptions
    ? {
        label: "Reports and monitoring are available",
        detail: "Start from a completed free scan, then choose a one-time Report, Monitor, or Growth.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950"
      }
    : checkout.report
      ? {
          label: "One-time Reports are available",
          detail: "Monitor and Growth are shown for planning and will open after monitoring readiness is verified.",
          tone: "border-cyan-200 bg-cyan-50 text-cyan-950"
        }
      : {
          label: "Free scans are available",
          detail: "Paid checkout is paused while launch checks are completed. No payment can be started from this page.",
          tone: "border-amber-200 bg-amber-50 text-amber-950"
        };

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
        <div
          role="status"
          className={`mb-5 flex flex-col justify-between gap-2 rounded-md border px-4 py-3 sm:flex-row sm:items-center ${availabilityMessage.tone}`}
        >
          <p className="text-sm font-semibold">{availabilityMessage.label}</p>
          <p className="max-w-2xl text-xs leading-5 sm:text-right">{availabilityMessage.detail}</p>
        </div>
        <h2 id="plans-heading" className="sr-only">
          Opportunity Scanner plans
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const featured = plan.tone === "ink";
            const monitor = plan.tone === "mist";
            const checkoutPlan = plan.name === "Report" ? "report" : plan.name === "Monitor" ? "monitor" : "growth";
            const checkoutEnabled = checkoutPlan === "report" ? checkout.report : checkout.subscriptions;

            return (
              <article
                key={plan.name}
                id={`${checkoutPlan}-checkout`}
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
                    {!checkoutEnabled
                      ? checkoutPlan === "report"
                        ? "Checkout paused"
                        : "Preview plan"
                      : plan.badge}
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
                  scanId={reportScanId}
                  initialBillingInterval={resumeCheckout
                    ? resumeCheckout.plan === checkoutPlan
                      ? resumeCheckout.billingInterval
                      : undefined
                    : nurtureBillingIntent(searchParams)}
                  resumeCheckout={resumeCheckout?.plan === checkoutPlan}
                />
                {checkoutPlan === "growth" ? (
                  <p className={`mt-3 text-xs leading-5 ${featured ? "text-slate-300" : "text-muted"}`}>
                    Best fit when you need daily checks, multiple company profiles, or contact enrichment.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
        {!checkout.report ? (
          <p className="mt-4 text-center text-xs leading-5 text-muted">
            Paid checkout is temporarily unavailable. The free scan is available now.
          </p>
        ) : !checkout.subscriptions ? (
          <p className="mt-4 text-center text-xs leading-5 text-muted">
            One-time Report checkout is available. Monitor and Growth are not open for purchase yet.
          </p>
        ) : null}
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <SectionIntro eyebrow="Compare the value" title="The action layer is included in every paid option">
            <p>
              Paid results turn sourced signals into a pursuit list: what matters, who or what to
              approach, what the source proves, what to verify, and the next step that moves the
              opportunity forward.
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

      <ProductActionPath />

      <section className="border-b border-line bg-field">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
          <SectionIntro eyebrow="Recurring value" title="Monitoring keeps a qualified search working after the first report">
            <p>
              Monitor and Growth are for teams that want to keep company profiles current, review
              what changed, and move new opportunities into pursuit without starting from zero.
            </p>
          </SectionIntro>
          <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-ink text-white">
                <tr>
                  {["Capability", "Report", "Monitor", "Growth"].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  ["Company profiles", "One report profile", "1 saved profile", "Up to 3 saved profiles"],
                  ["Search cadence", "Single scan", "Weekly monitoring", "Daily monitoring"],
                  ["Change review", "Report snapshot", "New and updated alerts", "New and updated alerts"],
                  ["Action workflow", "Pursuits, exports, CRM notes", "Included", "Included"],
                  ["Contact enrichment", "Source-native paths", "Source-native paths", "30 monthly credits"]
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`} className={`px-4 py-3 leading-6 ${index === 0 ? "font-semibold text-ink" : "text-slate-600"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Plan details are visible for evaluation. The availability notice above reflects whether
            checkout is currently open.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-12">
        <SectionIntro eyebrow="FAQ" title="Limits and billing, without fine-print surprises" />
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="border-t border-line pt-4">
              <h3 className="text-base font-semibold text-ink">{faq.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {faq.question === "Can I buy a paid plan today?"
                  ? checkout.subscriptions
                    ? "Yes. Start with a completed free scan, then choose Monitor or Growth from that report. This ensures your first company profile is ready to monitor as soon as checkout finishes."
                    : checkout.report
                      ? "Yes. The $49 report can be purchased from an existing free report so access returns to the correct scan. Monitor and Growth are not open for purchase yet."
                      : faq.answer
                  : faq.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <CTASection title="Find the public-sector paths worth pursuing.">
        <p>
          Run a free scan to see real signals for your company, then open the official route and
          track the opportunities worth pursuing.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
