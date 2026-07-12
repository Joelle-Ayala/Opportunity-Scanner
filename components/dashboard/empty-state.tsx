import type { ReactNode } from "react";

export interface DashboardEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function DashboardEmptyState({ title, description, action, icon }: DashboardEmptyStateProps) {
  return (
    <div className="grid min-h-64 place-items-center border-y border-line bg-white px-5 py-12 text-center sm:rounded-lg sm:border">
      <div className="max-w-md">
        {icon ? (
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-line bg-field text-accent" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <h3 className={`${icon ? "mt-4" : ""} text-base font-semibold text-ink`}>{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
