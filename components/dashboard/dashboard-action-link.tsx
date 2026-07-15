"use client";

import type { ReactNode } from "react";
import { trackProductEvent, type DashboardAction } from "@/lib/productAnalytics";

export function DashboardActionLink({
  action,
  href,
  className,
  children
}: {
  action: DashboardAction;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackProductEvent("dashboard_action_selected", { action })}
    >
      {children}
    </a>
  );
}
