export type CustomerAccountRecord = {
  id: string;
  auth_user_id: string;
  stripe_customer_id: string | null;
  email: string;
  created_at: string;
  updated_at: string;
};

export type DashboardReport = {
  scanId: string;
  reportId: string | null;
  companyName: string | null;
  companyUrl: string;
  status: string;
  reportType: string;
  reportAccess: string;
  createdAt: string;
  completedAt: string | null;
  reportCreatedAt: string | null;
  pdfUrl: string | null;
  hasActiveGrant: boolean;
  savedSearchVersionId: string | null;
};

export type SavedSearchConfiguration = Record<string, unknown>;

export type DashboardSavedSearch = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived";
  currentVersion: {
    id: string;
    version: number;
    configuration: SavedSearchConfiguration;
    createdAt: string;
  } | null;
  monitoredProfile: DashboardMonitoredProfile | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMonitoredProfile = {
  id: string;
  sourceScanId: string;
  latestScanId: string | null;
  cadence: "daily" | "weekly";
  status: "active" | "paused" | "canceled";
  nextRunAt: string;
  lastRunAt: string | null;
  savedSearchVersionId: string | null;
};

export type DashboardMonitoringRun = {
  id: string;
  monitoredProfileId: string;
  scanId: string;
  status: "running" | "completed" | "failed";
  newOpportunityCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type DashboardBillingState = {
  stripeCustomerId: string | null;
  customerEmail: string;
  stripeEmail: string | null;
  subscriptions: Array<{
    id: string;
    product: "monitor" | "growth" | null;
    billingInterval: "monthly" | "annual" | null;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  }>;
  activeReportGrantCount: number;
};

export type DashboardSummary = {
  account: Pick<CustomerAccountRecord, "id" | "email" | "stripe_customer_id">;
  reportCount: number;
  completedReportCount: number;
  activeSavedSearchCount: number;
  activeMonitorCount: number;
  newOpportunityCount: number;
  billing: DashboardBillingState;
  recentReports: DashboardReport[];
};

export type DashboardPageOptions = {
  limit?: number;
  offset?: number;
};

export type OwnedMonitoringComparisonPair = {
  monitoredProfileId: string;
  currentScanId: string;
  previousScanId: string;
};
