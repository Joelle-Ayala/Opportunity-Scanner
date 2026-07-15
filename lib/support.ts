export const DEFAULT_SUPPORT_EMAIL = "support@opportunityscanner.ai";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function configuredSupportEmail(
  env: Record<string, string | undefined> = process.env
): string {
  const candidate = env.OPPORTUNITY_SCANNER_CONTACT_EMAIL?.trim().toLowerCase();
  return candidate && candidate.length <= 254 && EMAIL_PATTERN.test(candidate)
    ? candidate
    : DEFAULT_SUPPORT_EMAIL;
}
