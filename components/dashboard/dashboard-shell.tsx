"use client";

import type { KeyboardEvent, ReactNode } from "react";

export type DashboardTabId = "overview" | "reports" | "saved-searches" | "alerts" | "billing";

export interface DashboardTab {
  id: DashboardTabId;
  label: string;
  shortLabel?: string;
  count?: number;
}

export interface DashboardShellProps {
  title?: string;
  description?: string;
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
  children: ReactNode;
  primaryAction?: ReactNode;
  accountSlot?: ReactNode;
  tabs?: DashboardTab[];
}

const defaultTabs: DashboardTab[] = [
  { id: "overview", label: "Overview" },
  { id: "reports", label: "Reports" },
  { id: "saved-searches", label: "Saved Searches", shortLabel: "Searches" },
  { id: "alerts", label: "Alerts" },
  { id: "billing", label: "Billing" }
];

export function DashboardShell({
  title = "Workspace",
  description = "Your reports, monitored searches, and account usage.",
  activeTab,
  onTabChange,
  children,
  primaryAction,
  accountSlot,
  tabs = defaultTabs
}: DashboardShellProps) {
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (tabIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    onTabChange(nextTab.id);
    document.getElementById(`dashboard-tab-${nextTab.id}`)?.focus();
  }

  return (
    <div className="min-h-screen bg-field text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a href="/" className="flex min-w-0 items-center gap-3" aria-label="Opportunity Scanner home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-ink text-xs font-bold text-white">
              OS
            </span>
            <span className="truncate text-sm font-semibold text-ink sm:text-base">Opportunity Scanner</span>
          </a>
          <div className="flex min-w-0 items-center gap-3">
            {accountSlot}
            {primaryAction}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
          </div>
        </div>

        <nav className="mt-6 overflow-x-auto border-b border-line" aria-label="Dashboard sections">
          <div className="flex min-w-max gap-3 sm:gap-6" role="tablist" aria-orientation="horizontal">
            {tabs.map((tab, tabIndex) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`dashboard-panel-${tab.id}`}
                  id={`dashboard-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
                  tabIndex={selected ? 0 : -1}
                  className={`flex min-h-11 items-center gap-1.5 border-b-2 px-0.5 text-xs font-semibold sm:gap-2 sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    selected
                      ? "border-accent text-accent"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-ink"
                  }`}
                >
                  {tab.shortLabel ? <><span className="sm:hidden">{tab.shortLabel}</span><span className="hidden sm:inline">{tab.label}</span></> : tab.label}
                  {typeof tab.count === "number" ? (
                    <span className="rounded-md bg-white px-1.5 py-0.5 text-xs text-slate-600">{tab.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        <main
          className="mt-6"
          role="tabpanel"
          id={`dashboard-panel-${activeTab}`}
          aria-labelledby={`dashboard-tab-${activeTab}`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
