export const KNOWN_COMPANY_BROWSER_EVENT = "opportunity-scanner:known-company";
export const CUSTOMER_SIGN_OUT_BROWSER_EVENT = "opportunity-scanner:customer-sign-out";

export type KnownCompanyIdentity = {
  userId?: string;
  email?: string;
  companyDomain?: string;
  companyName?: string;
};

declare global {
  interface Window {
    __opportunityScannerKnownCompany?: KnownCompanyIdentity;
  }
}

function normalizedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) return undefined;
  return text;
}

function normalizedEmail(value: unknown): string | undefined {
  const email = normalizedText(value, 254)?.toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export function companyDomainFromUrl(value: unknown): string | undefined {
  const text = normalizedText(value, 2_048);
  if (!text) return undefined;
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.hostname.toLowerCase().replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

export function companyDomainFromEmail(value: unknown): string | undefined {
  const email = normalizedEmail(value);
  return email ? companyDomainFromUrl(email.split("@")[1]) : undefined;
}

export function sanitizeKnownCompanyIdentity(input: KnownCompanyIdentity): KnownCompanyIdentity | null {
  const identity: KnownCompanyIdentity = {};
  const userId = normalizedText(input.userId, 128);
  const email = normalizedEmail(input.email);
  const companyDomain = companyDomainFromUrl(input.companyDomain);
  const companyName = normalizedText(input.companyName, 160);
  if (userId) identity.userId = userId;
  if (email) identity.email = email;
  if (companyDomain) identity.companyDomain = companyDomain;
  if (companyName) identity.companyName = companyName;
  return Object.keys(identity).length ? identity : null;
}

export function publishKnownCompanyIdentity(input: KnownCompanyIdentity): boolean {
  const identity = sanitizeKnownCompanyIdentity(input);
  if (!identity || typeof window === "undefined" || typeof CustomEvent === "undefined") return false;
  window.__opportunityScannerKnownCompany = identity;
  window.dispatchEvent(new CustomEvent(KNOWN_COMPANY_BROWSER_EVENT, { detail: identity }));
  return true;
}

export function publishCustomerSignOut(): boolean {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") return false;
  delete window.__opportunityScannerKnownCompany;
  window.dispatchEvent(new CustomEvent(CUSTOMER_SIGN_OUT_BROWSER_EVENT));
  return true;
}
