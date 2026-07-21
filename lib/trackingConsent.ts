export const TRACKING_CONSENT_COOKIE_NAME = "os_tracking_consent";
export const TRACKING_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const TRACKING_CONSENT_BROWSER_EVENT = "opportunity-scanner:tracking-consent";

export type TrackingConsent = "analytics" | "necessary";

export function parseTrackingConsent(value: string | undefined): TrackingConsent | null {
  return value === "analytics" || value === "necessary" ? value : null;
}

export function trackingConsentCookieAssignment(value: TrackingConsent, secure: boolean): string {
  const secureAttribute = secure ? "; Secure" : "";
  return `${TRACKING_CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${TRACKING_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secureAttribute}`;
}

export function browserCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function currentTrackingConsent(): TrackingConsent | null {
  return parseTrackingConsent(browserCookieValue(TRACKING_CONSENT_COOKIE_NAME));
}
