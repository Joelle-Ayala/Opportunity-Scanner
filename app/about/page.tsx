import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";

const title = "About | Opportunity Scanner";
const description =
  "Why Joelle Ayala founded Opportunity Scanner to make public-sector opportunity research more useful and actionable.";

export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    title,
    description,
    url: "/about",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

const principles = [
  [
    "Evidence before excitement",
    "A useful opportunity starts with a public source. We show the record behind a signal so customers can verify it and do their own diligence."
  ],
  [
    "Actions, not data dumps",
    "Research should lead somewhere: a buyer to understand, a program office to contact, a registration path to follow, or a clear reason to monitor."
  ],
  [
    "Honest limits",
    "Public data can be incomplete, delayed, or changed at its source. Opportunity Scanner is a research aid, not a promise of eligibility, funding, or an award."
  ]
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
          <div className="self-center">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">About Opportunity Scanner</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Public opportunity research should lead to a practical next move.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
              Opportunity Scanner turns a company website into sourced signals across procurement,
              funding, policy, workforce, reimbursement, and public money flows, then organizes
              those signals around who to pursue, why they matter, and what to do next.
            </p>
          </div>

          <aside className="border-l-4 border-accent bg-field px-6 py-7" aria-labelledby="founder-heading">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white" aria-hidden="true">
              JA
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-accent">Founder</p>
            <h2 id="founder-heading" className="mt-2 text-2xl font-semibold text-ink">Joelle Ayala</h2>
            <p className="mt-4 text-sm leading-7 text-slate-700">
              Joelle founded Opportunity Scanner around a simple problem: public-sector demand and
              funding are visible in public records, but finding the relevant signal and turning it
              into a business-development action takes too much disconnected research. She is
              building the product to make that path clearer for companies exploring public-sector revenue.
            </p>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">How we build trust</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink">Useful intelligence stays close to the source.</h2>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {principles.map(([title, copy], index) => (
            <article key={title} className="border-t-2 border-line pt-5">
              <p className="text-xs font-semibold text-accent">0{index + 1}</p>
              <h3 className="mt-3 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-ink">See what the scanner finds for your company.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Start with a free scan and review the sources behind each result.</p>
          </div>
          <a href="/#scan" className="shrink-0 rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
