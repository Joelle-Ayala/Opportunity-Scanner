import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { resolveAdminPageAccess, type AdminOperatorAccess } from "./access";

export async function requireAdminPage(
  nextPath: string,
  legacyAccess?: string
): Promise<AdminOperatorAccess> {
  const access = await resolveAdminPageAccess(cookies(), legacyAccess);
  if (access.status === "signed_out") {
    redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  if (access.status === "refresh_required") {
    redirect(`/api/auth/session?next=${encodeURIComponent(nextPath)}`);
  }
  return access;
}
