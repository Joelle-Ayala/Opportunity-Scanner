import { SiteFooter, SiteHeader } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-field">
      <SiteHeader />
      <section className="flex flex-1 items-center border-b border-line bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold text-accent">404 / Signal not found</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            This page is no longer on the map.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            The link may be outdated or the address may be incomplete. Head home, browse sample
            reports, or start a free scan to find public-sector opportunities for your company.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/#scan" className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
              Run Free Scan
            </a>
            <a href="/" className="rounded-md border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:border-accent">
              Return Home
            </a>
            <a href="/examples" className="rounded-md px-4 py-3 text-sm font-semibold text-accent hover:bg-mist">
              View Sample Reports
            </a>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
