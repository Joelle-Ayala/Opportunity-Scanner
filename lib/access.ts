import { ScanRecord } from "./types";

function configuredCode(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function matchesCode(value: string | undefined, code: string | null): boolean {
  return Boolean(value && code && value === code);
}

export function accessSuffix(access?: string): string {
  return access ? `&access=${encodeURIComponent(access)}` : "";
}

export function reportAccessHref(path: string, access?: string): string {
  if (!access) return path;
  return `${path}${path.includes("?") ? "&" : "?"}access=${encodeURIComponent(access)}`;
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
