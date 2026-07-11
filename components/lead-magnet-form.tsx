"use client";

import { FormEvent, useState } from "react";
import type { LeadMagnetSlug } from "@/lib/leadMagnets";
import { trackProductEvent } from "@/lib/productAnalytics";

type AccessResponse =
  | { ok: true; accessPath: string }
  | { ok: false; error?: { message?: string } };

export function LeadMagnetForm({
  slug,
  buttonLabel
}: {
  slug: LeadMagnetSlug;
  buttonLabel: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [accessPath, setAccessPath] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams(window.location.search);
    const optional = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" && value.trim() ? value.trim() : null;
    };

    try {
      const response = await fetch("/api/lead-magnets/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.get("name"),
          email: form.get("email"),
          company: optional("company"),
          website: optional("website"),
          source: "guide_landing",
          utmSource: query.get("utm_source"),
          utmMedium: query.get("utm_medium"),
          utmCampaign: query.get("utm_campaign"),
          utmContent: query.get("utm_content"),
          utmTerm: query.get("utm_term"),
          marketingConsent: form.get("marketingConsent") === "on"
        })
      });
      const result = (await response.json()) as AccessResponse;

      if (!response.ok || !result.ok) {
        throw new Error(!result.ok ? result.error?.message : undefined);
      }

      trackProductEvent("email_captured", {
        surface: "lead_magnet",
        marketing_consent: form.get("marketingConsent") === "on"
      });
      setAccessPath(result.accessPath);
      setStatus("success");
      setMessage("Your guide is ready. Download it now and keep it for your next opportunity review.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error && error.message ? error.message : "We could not unlock the guide. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-signal">Guide unlocked</p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{message}</p>
        <a
          href={accessPath}
          download
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          Download PDF
        </a>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          The research is dated July 2026. Recheck time-sensitive official sources before acting.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Name</span>
          <input
            required
            name="name"
            autoComplete="name"
            maxLength={120}
            className="min-h-11 rounded-md border border-line bg-white px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Work email</span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            className="min-h-11 rounded-md border border-line bg-white px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Company <span className="font-normal text-muted">Optional</span></span>
          <input
            name="company"
            autoComplete="organization"
            maxLength={160}
            className="min-h-11 rounded-md border border-line bg-white px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Company website <span className="font-normal text-muted">Optional</span></span>
          <input
            name="website"
            type="url"
            autoComplete="url"
            maxLength={500}
            placeholder="https://example.com"
            className="min-h-11 rounded-md border border-line bg-white px-3 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-md border border-line bg-field p-3 text-sm leading-6 text-slate-700">
        <input name="marketingConsent" type="checkbox" className="mt-1 h-4 w-4 accent-[#0E7C86]" />
        <span>Send me occasional Opportunity Scanner research and product updates. I can unsubscribe at any time.</span>
      </label>

      <p className="text-xs leading-5 text-muted">
        We use your information to provide this guide and understand which resources are useful. Marketing is optional. See our{" "}
        <a href="/privacy" className="font-semibold text-accent hover:underline">privacy notice</a>.
      </p>

      {message ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex min-h-11 w-fit items-center rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "submitting" ? "Unlocking..." : buttonLabel}
      </button>
    </form>
  );
}
