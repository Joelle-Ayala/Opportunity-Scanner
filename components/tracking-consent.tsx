"use client";

import { useEffect, useState } from "react";
import {
  TRACKING_CONSENT_BROWSER_EVENT,
  currentTrackingConsent,
  trackingConsentCookieAssignment,
  type TrackingConsent
} from "@/lib/trackingConsent";
import { FIRST_TOUCH_COOKIE_NAME } from "@/lib/acquisitionAttribution";

type OptionalTrackingWindow = Window & {
  _hsq?: Array<[string, ...unknown[]]>;
  gtag?: (...args: unknown[]) => void;
};

function applyConsent(value: TrackingConsent) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie = trackingConsentCookieAssignment(value, process.env.NODE_ENV === "production");
  if (value === "necessary") {
    document.cookie = `${FIRST_TOUCH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    const trackingWindow = window as OptionalTrackingWindow;
    trackingWindow._hsq?.push(["revokeCookieConsent"]);
    trackingWindow.gtag?.("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "denied"
    });
  }
  window.dispatchEvent(new CustomEvent(TRACKING_CONSENT_BROWSER_EVENT, { detail: value }));
  window.location.reload();
}

export function TrackingConsentBanner() {
  const [consent, setConsent] = useState<TrackingConsent | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setConsent(currentTrackingConsent());
    const handleConsent = (event: Event) => {
      const value = event instanceof CustomEvent ? event.detail : null;
      if (value === "analytics" || value === "necessary") setConsent(value);
    };
    window.addEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
    return () => window.removeEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
  }, []);

  if (dismissed || consent === undefined) return null;

  const optedOut = consent === "necessary";

  return (
    <aside aria-label="Analytics notice" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <p className="pointer-events-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs leading-5 text-slate-600 shadow-lg">
        <span>{optedOut ? "Analytics are off." : "Analytics are on to improve Opportunity Scanner."}</span>
        <button
          type="button"
          onClick={() => applyConsent(optedOut ? "analytics" : "necessary")}
          className="font-semibold text-accent hover:underline"
        >
          {optedOut ? "Turn on analytics" : "Turn off analytics"}
        </button>
        <a href="/privacy" className="font-semibold text-accent hover:underline">Privacy</a>
        <button type="button" onClick={() => setDismissed(true)} className="font-semibold text-slate-500 hover:text-ink" aria-label="Dismiss analytics notice">
          Close
        </button>
      </p>
    </aside>
  );
}

export function TrackingPreferencesButton({ className }: { className?: string }) {
  const [consent, setConsent] = useState<TrackingConsent | null>(null);

  useEffect(() => {
    setConsent(currentTrackingConsent());
    const handleConsent = (event: Event) => {
      const value = event instanceof CustomEvent ? event.detail : null;
      if (value === "analytics" || value === "necessary") setConsent(value);
    };
    window.addEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
    return () => window.removeEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
  }, []);

  const optedOut = consent === "necessary";

  return (
    <button type="button" onClick={() => applyConsent(optedOut ? "analytics" : "necessary")} className={className}>
      {optedOut ? "Turn on analytics" : "Turn off analytics"}
    </button>
  );
}
