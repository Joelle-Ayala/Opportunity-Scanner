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
    <aside aria-label="Analytics preferences" className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-lg border border-line bg-white p-4 shadow-2xl sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5">
      <div>
        <p className="text-sm font-semibold text-ink">Your privacy choices</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          We use optional analytics to understand what leads to useful reports and purchases. You can keep only the cookies needed to run the site. <a href="/privacy" className="font-semibold text-accent hover:underline">Privacy notice</a>
        </p>
      </div>
      <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
        <button type="button" onClick={() => choose("necessary")} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent">
          Necessary only
        </button>
        <button type="button" onClick={() => choose("analytics")} className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
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
