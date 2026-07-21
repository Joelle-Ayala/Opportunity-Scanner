"use client";

import { publishCustomerSignOut } from "@/lib/companyAnalytics";

export function CustomerSignOutForm() {
  return (
    <form action="/api/auth/sign-out" method="post" onSubmit={publishCustomerSignOut}>
      <button className="text-sm font-semibold text-steel hover:text-accent">Sign out</button>
    </form>
  );
}
