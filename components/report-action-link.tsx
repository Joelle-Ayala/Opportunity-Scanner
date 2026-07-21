"use client";

import type { ReactNode } from "react";
import {
  trackProductEvent,
  type ReportTier,
  type ReportValueAction
} from "@/lib/productAnalytics";

export function ReportActionLink({
  action,
  reportTier,
  href,
  className,
  target,
  rel,
  title,
  children
}: {
  action: ReportValueAction;
  reportTier: ReportTier;
  href: string;
  className?: string;
  target?: "_blank";
  rel?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      target={target}
      rel={rel}
      title={title}
      onClick={() => trackProductEvent("report_value_action_selected", {
        action,
        report_tier: reportTier
      })}
    >
      {children}
    </a>
  );
}
