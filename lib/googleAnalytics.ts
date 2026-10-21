import { stripUrlQuery } from "./productAnalytics.ts";
import type { TrackingConsent } from "./trackingConsent.ts";

export const GOOGLE_ANALYTICS_SCRIPT_ID = "opportunity-scanner-ga4";

const GA_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

export const GOOGLE_CONSENT_SIGNALS = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
  "functionality_storage",
  "personalization_storage",
  "security_storage"
] as const;

export type GoogleConsentSignal = (typeof GOOGLE_CONSENT_SIGNALS)[number];
export type GoogleConsentSettings = Record<GoogleConsentSignal, "granted" | "denied">;

export type GoogleAnalyticsCommand = unknown[];

export type GoogleAnalyticsPlan = {
  loadScript: boolean;
  trackPageViews: boolean;
  commands: GoogleAnalyticsCommand[];
};

export function googleAnalyticsMeasurementId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return GA_MEASUREMENT_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export function deniedGoogleConsent(): GoogleConsentSettings {
  return {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "denied"
  };
}

export function analyticsGrantedGoogleConsent(): GoogleConsentSettings {
  return {
    ...deniedGoogleConsent(),
    analytics_storage: "granted"
  };
}

export function googleAnalyticsConfig(): {
  send_page_view: false;
  allow_google_signals: false;
  allow_ad_personalization_signals: false;
} {
  return {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  };
}

export function planGoogleAnalytics(input: {
  measurementId: string | null;
  consent: TrackingConsent | null;
  defaultSet: boolean;
  configured: boolean;
}): GoogleAnalyticsPlan {
  if (!input.measurementId) {
    return { loadScript: false, trackPageViews: false, commands: [] };
  }

  const commands: GoogleAnalyticsCommand[] = [];
  const optedOut = input.consent === "necessary";

  if (!input.defaultSet && !optedOut) {
    commands.push(["consent", "default", analyticsGrantedGoogleConsent()]);
    commands.push(["set", "ads_data_redaction", true]);
    commands.push(["set", "url_passthrough", false]);
  }

  if (optedOut) {
    if (input.configured) commands.push(["consent", "update", deniedGoogleConsent()]);
    return { loadScript: false, trackPageViews: false, commands };
  }

  if (input.defaultSet) {
    commands.push(["consent", "update", analyticsGrantedGoogleConsent()]);
  }
  if (!input.configured) {
    commands.push(["js"]);
    commands.push(["config", input.measurementId, googleAnalyticsConfig()]);
  }
  return { loadScript: !input.configured, trackPageViews: true, commands };
}

export function googleAnalyticsPageView(origin: string, pathname: string, referrer = ""): {
  page_path: string;
  page_location: string;
  page_referrer?: string;
} {
  const strippedPath = stripUrlQuery(pathname || "/");
  const page_path = strippedPath.startsWith("/") ? strippedPath : `/${strippedPath}`;
  let page_location = page_path;
  try {
    const url = new URL(origin);
    url.pathname = page_path;
    url.search = "";
    url.hash = "";
    page_location = url.toString();
  } catch {
    page_location = page_path;
  }

  const page_referrer = referrer ? stripUrlQuery(referrer) : "";
  return page_referrer
    ? { page_path, page_location, page_referrer }
    : { page_path, page_location };
}
