import { cookies } from "next/headers";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import type { ScanRecord } from "@/lib/types";
import { hasCustomerServerReportAccess } from "./access";

export async function hasRequestReportAccess(
  requestUrl: string,
  access: string | undefined,
  scan: Pick<ScanRecord, "id" | "report_access">
): Promise<boolean> {
  return (await resolveRequestReportAccess(requestUrl, access, scan)).hasAccess;
}

export async function resolveRequestReportAccess(
  requestUrl: string,
  access: string | undefined,
  scan: Pick<ScanRecord, "id" | "report_access">,
  resolvedAuthUserId?: string | null
): Promise<{ hasAccess: boolean; authUserId: string | null }> {
  let authUserId = resolvedAuthUserId ?? null;
  if (resolvedAuthUserId === undefined) {
    try {
      const session = await resolveCustomerSession(getCustomerAuthConfig(requestUrl), cookies());
      authUserId = session?.user.id ?? null;
    } catch {
      authUserId = null;
    }
  }
  return {
    hasAccess: await hasCustomerServerReportAccess(access, scan, authUserId),
    authUserId
  };
}
