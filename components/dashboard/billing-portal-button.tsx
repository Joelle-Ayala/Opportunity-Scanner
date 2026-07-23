"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { secureStripeBillingPortalUrl } from "@/components/billing-management-state";
import { trackProductEvent } from "@/lib/productAnalytics";

type BillingPortalResponse = {
  ok?: boolean;
  portalUrl?: unknown;
  error?: { message?: unknown };
};

type BillingPortalButtonProps = {
  className?: string;
  label?: string;
  variant?: "default" | "danger";
};

export function BillingPortalButton({
  className = "",
  label = "Manage billing",
  variant = "default"
}: BillingPortalButtonProps) {
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openPortal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const body = (await response.json().catch(() => null)) as BillingPortalResponse | null;
      const portalUrl = secureStripeBillingPortalUrl(body?.portalUrl);
      if (!response.ok || !body?.ok || !portalUrl) {
        throw new Error(
          typeof body?.error?.message === "string"
            ? body.error.message
            : "Billing settings could not be opened. Please try again."
        );
      }
      trackProductEvent("billing_portal_opened", { source: "dashboard" });
      window.location.assign(portalUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing settings could not be opened. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={openPortal}>
      <button
        type="submit"
        disabled={loading}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-70 ${
          variant === "danger"
            ? "border-red-700 bg-red-700 text-white hover:border-red-800 hover:bg-red-800"
            : "border-line bg-white text-ink hover:border-accent hover:text-accent"
        } ${className}`}
      >
        {loading ? "Opening billing..." : label}
      </button>
      <div aria-live="polite" aria-atomic="true">
        {error ? (
          <p id={errorId} role="alert" className="mt-2 max-w-xs text-xs leading-5 text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
