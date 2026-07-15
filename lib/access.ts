import type { ScanRecord } from "./types";

const PRODUCTION_LEGACY_URL_CODE_OVERRIDE =
  "OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION";
const MINIMUM_PRODUCTION_LEGACY_CODE_LENGTH = 32;

function productionLegacyUrlCodesEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env[PRODUCTION_LEGACY_URL_CODE_OVERRIDE]?.trim() === "true"
  );
}

function configuredCode(...names: string[]): string | null {
  if (!productionLegacyUrlCodesEnabled()) return null;
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (
      value &&
      (process.env.NODE_ENV !== "production" || value.length >= MINIMUM_PRODUCTION_LEGACY_CODE_LENGTH)
    ) {
      return value;
    }
  }
  return null;
}

function matchesCode(value: string | undefined, code: string | null): boolean {
  return Boolean(value && code && value === code);
}

function shouldPropagateCode(value: string | undefined): boolean {
  if (!value || !productionLegacyUrlCodesEnabled()) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return (
    matchesCode(value, configuredCode("OPPORTUNITY_SCANNER_ADMIN_CODE", "ADMIN_REPORT_ACCESS_CODE")) ||
    matchesCode(value, configuredCode("OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE", "REPORT_ACCESS_CODE"))
  );
}

export function accessSuffix(access?: string): string {
  return shouldPropagateCode(access) ? `&access=${encodeURIComponent(access!)}` : "";
}

export function reportAccessHref(path: string, access?: string): string {
  if (!shouldPropagateCode(access)) return path;
  return `${path}${path.includes("?") ? "&" : "?"}access=${encodeURIComponent(access!)}`;
}

export function hasAdminAccess(access?: string, scan?: Pick<ScanRecord, "report_access"> | null): boolean {
  if (scan?.report_access === "admin") return true;
  return matchesCode(
    access,
    configuredCode("OPPORTUNITY_SCANNER_ADMIN_CODE", "ADMIN_REPORT_ACCESS_CODE")
  );
}

export function hasFullReportAccess(access?: string, scan?: Pick<ScanRecord, "report_access"> | null): boolean {
  if (scan?.report_access === "admin" || scan?.report_access === "unlocked") return true;
  if (hasAdminAccess(access, scan)) return true;
  return matchesCode(
    access,
    configuredCode("OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE", "REPORT_ACCESS_CODE")
  );
}
