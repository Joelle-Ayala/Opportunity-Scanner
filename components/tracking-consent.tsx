"use client";

import { useEffect, useState } from "react";
import {
  TRACKING_CONSENT_BROWSER_EVENT,
  TRACKING_CONSENT_COOKIE_NAME,
  currentTrackingConsent,
  trackingConsentCookieAssignment,
  type TrackingConsent
} from "@/lib/trackingConsent";
import { FIRST_TOUCH_COOKIE_NAME } from "@/lib/acquisitionAttribution";

function applyConsent(value: TrackingConsent) {
  document.cookie = trackingConsentCookieAssignment(value, process.env.NODE_ENV === "production");
  if (value === "necessary") {
    document.cookie = `${FIRST_TOUCH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  }
  window.dispatchEvent(new CustomEvent(TRACKING_CONSENT_BROWSER_EVENT, { detail: value }));
}

export function TrackingConsentBanner() {
  const [consent, setConsent] = useState<TrackingConsent | null | undefined>(undefined);

  useEffect(() => {
    const current = currentTrackingConsent();
    const globalPrivacyControl = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    if (!current && globalPrivacyControl === true) {
      applyConsent("necessary");
      setConsent("necessary");
      return;
    }
    setConsent(current);
  }, []);

  if (consent !== null) return null;

  const choose = (value: TrackingConsent) => {
    applyConsent(value);
    setConsent(value);
  };

  return (
    <aside aria-label="Analytics preferences" className="fixed inset-x-2 bottom-2 z-[100] mx-auto max-w-4xl rounded-lg border border-line bg-white p-2.5 shadow-2xl sm:inset-x-3 sm:bottom-3 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:px-4 sm:py-3">
      <div>
        <p className="text-xs font-semibold text-ink sm:text-sm">Your privacy choices</p>
        <p className="mt-0.5 text-xs leading-4 text-slate-600 sm:mt-1 sm:text-sm sm:leading-5">
          <span className="sm:hidden">Optional analytics improve reports. </span>
          <span className="hidden sm:inline">
          Optional analytics help us improve reports and purchases. Keep only necessary cookies or allow analytics. <a href="/privacy" className="font-semibold text-accent hover:underline">Privacy notice</a>
          </span>
          <a href="/privacy" className="font-semibold text-accent hover:underline sm:hidden">Privacy notice</a>
        </p>
      </div>
      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 sm:mt-0">
        <button type="button" onClick={() => choose("necessary")} className="min-h-9 whitespace-nowrap rounded-md border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent sm:min-h-10 sm:py-2 sm:text-sm">
          Necessary only
        </button>
        <button type="button" onClick={() => choose("analytics")} className="min-h-9 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#0A6871] sm:min-h-10 sm:py-2 sm:text-sm">
          Allow analytics
        </button>
      </div>
    </aside>
  );
}

export function TrackingPreferencesButton({ className }: { className?: string }) {
  const reset = () => {
    document.cookie = `${TRACKING_CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    document.cookie = `${FIRST_TOUCH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    window.location.reload();
  };
  return <button type="button" onClick={reset} className={className}>Cookie choices</button>;
}
