"use client";

import type { ReactNode } from "react";
import { trackProductEvent } from "@/lib/productAnalytics";

export function PursuitActionLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => trackProductEvent("report_value_action_selected", { action: "review_source", report_tier: "full" })}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
