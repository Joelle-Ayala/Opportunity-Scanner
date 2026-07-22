export const DEFAULT_SUPPORT_EMAIL = "support@opportunityscanner.ai";
export const SUPPORT_EMAIL_DOMAIN = "opportunityscanner.ai";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBrandedSupportEmail(value: string | undefined): boolean {
  const candidate = value?.trim().toLowerCase();
  if (!candidate || candidate.length > 254 || !EMAIL_PATTERN.test(candidate)) return false;

  return candidate.slice(candidate.lastIndexOf("@") + 1) === SUPPORT_EMAIL_DOMAIN;
}

export function supportMailboxIsReady(
  env: Record<string, string | undefined> = process.env
): boolean {
  return isBrandedSupportEmail(env.OPPORTUNITY_SCANNER_CONTACT_EMAIL)
    && env.SUPPORT_MAILBOX_READY?.trim() === "true";
}

export function configuredSupportEmail(
  env: Record<string, string | undefined> = process.env
): string {
  const candidate = env.OPPORTUNITY_SCANNER_CONTACT_EMAIL?.trim().toLowerCase();
  return isBrandedSupportEmail(candidate) ? candidate! : DEFAULT_SUPPORT_EMAIL;
}
