"use client";

import { useEffect } from "react";
import { publishKnownCompanyIdentity } from "@/lib/companyAnalytics";

export function KnownCompanyAnalytics({
  userId,
  email,
  companyDomain,
  companyName
}: {
  userId?: string;
  email?: string;
  companyDomain?: string;
  companyName?: string;
}) {
  useEffect(() => {
    publishKnownCompanyIdentity({ userId, email, companyDomain, companyName });
  }, [companyDomain, companyName, email, userId]);

  return null;
}
