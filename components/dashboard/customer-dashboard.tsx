"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { BillingSummary, type BillingSummaryProps } from "./billing-summary";
import { AlertPreferences, type AlertPreferencesProps } from "./alert-preferences";
import { DashboardOverview, type DashboardOverviewProps } from "./dashboard-overview";
import { DashboardShell, type DashboardTab, type DashboardTabId } from "./dashboard-shell";
import { ReportList, type ReportListProps } from "./report-list";
import { SavedSearchList, type SavedSearchListProps } from "./saved-search-list";

export interface CustomerDashboardProps {
  overview: DashboardOverviewProps;
  reports: ReportListProps;
  savedSearches: SavedSearchListProps;
  alerts: AlertPreferencesProps;
  billing: BillingSummaryProps;
  title?: string;
  description?: string;
  initialTab?: DashboardTabId;
  activeTab?: DashboardTabId;
  onTabChange?: (tab: DashboardTabId) => void;
  primaryAction?: ReactNode;
  accountSlot?: ReactNode;
}

export function CustomerDashboard({
  overview,
  reports,
  savedSearches,
  alerts,
  billing,
  title,
  description,
  initialTab = "overview",
  activeTab: controlledTab,
  onTabChange,
  primaryAction,
  accountSlot
}: CustomerDashboardProps) {
  const [internalTab, setInternalTab] = useState<DashboardTabId>(initialTab);
  const activeTab = controlledTab ?? internalTab;

  function changeTab(tab: DashboardTabId) {
    if (controlledTab === undefined) setInternalTab(tab);
    onTabChange?.(tab);
  }

  const tabs: DashboardTab[] = [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Reports", count: reports.reports.length },
    { id: "saved-searches", label: "Saved Searches", count: savedSearches.searches.length },
    { id: "alerts", label: "Alerts" },
    { id: "billing", label: "Billing" }
  ];

  return (
    <DashboardShell
      title={title}
      description={description}
      activeTab={activeTab}
      onTabChange={changeTab}
      primaryAction={primaryAction}
      accountSlot={accountSlot}
      tabs={tabs}
    >
      {activeTab === "overview" ? <DashboardOverview {...overview} /> : null}
      {activeTab === "reports" ? <ReportList {...reports} /> : null}
      {activeTab === "saved-searches" ? <SavedSearchList {...savedSearches} /> : null}
      {activeTab === "alerts" ? <AlertPreferences {...alerts} /> : null}
      {activeTab === "billing" ? <BillingSummary {...billing} /> : null}
    </DashboardShell>
  );
}
