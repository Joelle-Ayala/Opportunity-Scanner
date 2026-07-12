import type { ReactNode } from "react";

export type DashboardStatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface DashboardStatusBadgeProps {
  children: ReactNode;
  tone?: DashboardStatusTone;
}

const toneClasses: Record<DashboardStatusTone, string> = {
  neutral: "border-line bg-field text-slate-600",
  info: "border-cyan-100 bg-mist text-accent",
  success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  warning: "border-amber-100 bg-amber-50 text-amber-800",
  danger: "border-red-100 bg-red-50 text-red-700"
};

export function DashboardStatusBadge({ children, tone = "neutral" }: DashboardStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
