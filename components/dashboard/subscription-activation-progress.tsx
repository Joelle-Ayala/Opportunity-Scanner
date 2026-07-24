"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const MAX_AUTOMATIC_CHECKS = 5;

export function SubscriptionActivationProgress({ nextHref }: { nextHref: string }) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);
  const [isChecking, startChecking] = useTransition();
  const automaticChecksPaused = checks >= MAX_AUTOMATIC_CHECKS;

  function checkActivation() {
    startChecking(() => {
      router.refresh();
      setChecks((current) => current + 1);
    });
  }

  useEffect(() => {
    if (automaticChecksPaused) return;
    const delayMs = Math.min(4_000 * 2 ** checks, 30_000);
    const timeout = window.setTimeout(() => {
      startChecking(() => {
        router.refresh();
        setChecks((current) => current + 1);
      });
    }, delayMs);
    return () => window.clearTimeout(timeout);
  }, [automaticChecksPaused, checks, router]);

  return (
    <div className="mx-auto mt-7 max-w-xl">
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-cyan-200 bg-mist px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {automaticChecksPaused ? (
            <span aria-hidden="true" className="text-lg font-semibold text-accent">i</span>
          ) : (
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-cyan-200 border-t-accent"
            />
          )}
          <div>
            <p className="text-sm font-semibold text-ink">
              {automaticChecksPaused
                ? "Automatic checks are paused"
                : checks < 3
                  ? "Confirming your plan"
                  : "Activation is taking a little longer"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {automaticChecksPaused
                ? "Your purchase is safe. Check again when you are ready, or return to your dashboard while activation recovery continues."
                : "This page checks automatically with a short backoff. You can safely leave and return without losing your purchase."}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={checkActivation}
          disabled={isChecking}
          className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
        >
          {isChecking ? "Checking..." : "Check now"}
        </button>
        <a href={nextHref} className="text-sm font-semibold text-accent hover:text-ink">
          Reload setup
        </a>
      </div>
    </div>
  );
}
