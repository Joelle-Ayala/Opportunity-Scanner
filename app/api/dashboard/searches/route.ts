import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { createMonitoredSearchFromScan, ensureCustomerAccount } from "@/lib/dashboard/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const scanId = String(form.get("scanId") || "");
  const session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies()).catch(() => null);
  if (!session?.user.email) redirect(`/auth/sign-in?next=${encodeURIComponent(`/reports/${scanId}`)}`);
  await ensureCustomerAccount(session.user.id, session.user.email);
  try {
    await createMonitoredSearchFromScan(session.user.id, scanId);
  } catch {
    redirect(`/pricing?source=monitor_search&scanId=${encodeURIComponent(scanId)}`);
  }
  redirect("/dashboard");
}
