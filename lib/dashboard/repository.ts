import { dashboardInsert, dashboardSelect, dashboardSelectOne, dashboardUpdate, inFilter, pageParameters } from "./rest";
import type {
  CustomerAccountRecord,
  DashboardBillingState,
  DashboardMonitoringRun,
  DashboardPageOptions,
  DashboardReport,
  DashboardSavedSearch,
  DashboardSummary,
  SavedSearchConfiguration
} from "./types";

type ScanOwnershipRow = { scan_id: string };
type ScanRow = {
  id: string;
  company_name: string | null;
  company_url: string;
  status: string;
  report_type: string;
  report_access: string;
  created_at: string;
  completed_at: string | null;
};
type ReportRow = {
  id: string;
  scan_id: string;
  report_pdf_url: string | null;
  created_at: string;
};
type GrantOwnershipRow = { report_access_grant_id: string };
type GrantRow = { id: string; scan_id: string; status: "active" | "refunded" };
type ScanVersionRow = { scan_id: string; saved_search_version_id: string };
type MonitoredOwnershipRow = { monitored_profile_id: string };
type MonitoredProfileRow = {
  id: string;
  source_scan_id: string;
  latest_scan_id: string | null;
  cadence: "daily" | "weekly";
  status: "active" | "paused" | "canceled";
  next_run_at: string;
  last_run_at: string | null;
};
type MonitoredVersionRow = { monitored_profile_id: string; saved_search_version_id: string };
type SavedSearchRow = {
  id: string;
  name: string;
  status: "active" | "paused" | "archived";
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};
type SavedSearchVersionRow = {
  id: string;
  saved_search_id: string;
  version: number;
  configuration: SavedSearchConfiguration;
  created_at: string;
};
type MonitoringRunRow = {
  id: string;
  monitored_profile_id: string;
  scan_id: string;
  status: "running" | "completed" | "failed";
  new_opportunity_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};
type StripeCustomerRow = { stripe_customer_id: string; email: string | null };
type SubscriptionRow = {
  stripe_subscription_id: string;
  product: "monitor" | "growth" | null;
  billing_interval: "monthly" | "annual" | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function ensureCustomerAccount(authUserId: string, emailValue: string): Promise<CustomerAccountRecord> {
  if (!UUID_PATTERN.test(authUserId)) throw new Error("A valid authenticated user ID is required.");
  const email = emailValue.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("A valid verified customer email is required.");
  }
  let account = await dashboardSelectOne<CustomerAccountRecord>("customer_accounts", {
    select: "id,auth_user_id,stripe_customer_id,email,created_at,updated_at",
    auth_user_id: `eq.${authUserId}`
  });
  if (!account) {
    const stripe = await dashboardSelectOne<StripeCustomerRow>("stripe_customers", {
      select: "stripe_customer_id,email",
      email: `eq.${email}`,
      order: "created_at.desc"
    });
    account = await dashboardInsert<CustomerAccountRecord>("customer_accounts", {
      auth_user_id: authUserId,
      stripe_customer_id: stripe?.stripe_customer_id ?? null,
      email
    });
  }
  if (!account) throw new Error("Customer account could not be created.");

  const scans = await dashboardSelect<{ id: string }>("scans", { select: "id", email: `eq.${email}` });
  for (const scan of scans) {
    await dashboardInsert("customer_scan_ownership", {
      customer_account_id: account.id,
      scan_id: scan.id,
      ownership_kind: "claimed"
    }, { onConflict: "scan_id", ignoreDuplicates: true });
  }
  if (account.stripe_customer_id) {
    const [grants, profiles] = await Promise.all([
      dashboardSelect<{ id: string }>("stripe_report_access_grants", {
        select: "id",
        stripe_customer_id: `eq.${account.stripe_customer_id}`
      }),
      dashboardSelect<{ id: string }>("monitored_profiles", {
        select: "id",
        stripe_customer_id: `eq.${account.stripe_customer_id}`
      })
    ]);
    for (const grant of grants) {
      await dashboardInsert("customer_report_grant_ownership", {
        customer_account_id: account.id,
        report_access_grant_id: grant.id
      }, { onConflict: "report_access_grant_id", ignoreDuplicates: true });
    }
    for (const profile of profiles) {
      await dashboardInsert("customer_monitored_profile_ownership", {
        customer_account_id: account.id,
        monitored_profile_id: profile.id
      }, { onConflict: "monitored_profile_id", ignoreDuplicates: true });
    }
  }
  return account;
}

export async function attachScanToCustomer(authUserId: string, scanId: string): Promise<void> {
  const account = await requireAccount(authUserId);
  if (!UUID_PATTERN.test(scanId)) throw new Error("A valid scan ID is required.");
  await dashboardInsert("customer_scan_ownership", {
    customer_account_id: account.id,
    scan_id: scanId,
    ownership_kind: "created"
  }, { onConflict: "scan_id", ignoreDuplicates: true });
}

export async function createMonitoredSearchFromScan(authUserId: string, scanId: string): Promise<string> {
  const account = await requireAccount(authUserId);
  if (!UUID_PATTERN.test(scanId)) throw new Error("A valid scan ID is required.");
  const owned = await dashboardSelectOne<{ scan_id: string }>("customer_scan_ownership", {
    select: "scan_id", customer_account_id: `eq.${account.id}`, scan_id: `eq.${scanId}`
  });
  if (!owned || !account.stripe_customer_id) throw new Error("A monitoring plan and owned report are required.");
  const subscription = await dashboardSelectOne<SubscriptionRow>("stripe_subscriptions", {
    select: "stripe_subscription_id,product,billing_interval,status,cancel_at_period_end,current_period_end",
    stripe_customer_id: `eq.${account.stripe_customer_id}`,
    status: "in.(active,trialing)",
    order: "created_at.desc"
  });
  if (!subscription?.product) throw new Error("An active monitoring plan is required.");
  const limit = subscription.product === "growth" ? 3 : 1;
  const profiles = await ownedMonitoredProfiles(account.id);
  if (profiles.filter((profile) => profile.status !== "canceled").length >= limit) throw new Error("Your monitored profile limit has been reached.");
  const scan = await dashboardSelectOne<Record<string, unknown> & { company_name: string | null; company_url: string }>("scans", {
    select: "company_name,company_url,industry,headquarters_state,target_states,customer_type,opportunity_focus,include_terms,exclude_terms,priority_signals",
    id: `eq.${scanId}`
  });
  if (!scan) throw new Error("Report not found.");
  const search = await dashboardInsert<{ id: string }>("customer_saved_searches", {
    customer_account_id: account.id,
    name: scan.company_name || new URL(scan.company_url).hostname.replace(/^www\./, ""),
    status: "active"
  });
  if (!search) throw new Error("Saved search could not be created.");
  const version = await dashboardInsert<{ id: string }>("customer_saved_search_versions", {
    saved_search_id: search.id,
    version: 1,
    configuration: { companyUrl: scan.company_url, industry: scan.industry, headquartersState: scan.headquarters_state, targetStates: scan.target_states, customerType: scan.customer_type, opportunityFocus: scan.opportunity_focus, includeTerms: scan.include_terms, excludeTerms: scan.exclude_terms, prioritySignals: scan.priority_signals },
    created_by_auth_user_id: authUserId
  });
  if (!version) throw new Error("Saved search version could not be created.");
  await dashboardUpdate("customer_saved_searches", { id: `eq.${search.id}` }, { current_version_id: version.id, updated_at: new Date().toISOString() });
  const profile = await dashboardInsert<{ id: string }>("monitored_profiles", {
    stripe_customer_id: account.stripe_customer_id,
    source_scan_id: scanId,
    latest_scan_id: scanId,
    cadence: subscription.product === "growth" ? "daily" : "weekly",
    status: "active",
    next_run_at: new Date().toISOString()
  });
  if (!profile) throw new Error("Monitored profile could not be created.");
  await Promise.all([
    dashboardInsert("customer_scan_saved_search_versions", { scan_id: scanId, saved_search_version_id: version.id }, { onConflict: "scan_id", ignoreDuplicates: true }),
    dashboardInsert("customer_monitored_profile_ownership", { customer_account_id: account.id, monitored_profile_id: profile.id }, { onConflict: "monitored_profile_id", ignoreDuplicates: true }),
    dashboardInsert("customer_monitored_profile_saved_search_versions", { monitored_profile_id: profile.id, saved_search_version_id: version.id })
  ]);
  return search.id;
}

async function requireOwnedSavedSearch(
  authUserId: string,
  savedSearchId: string
): Promise<{ account: CustomerAccountRecord; search: SavedSearchRow; version: SavedSearchVersionRow | null; profile: MonitoredProfileRow | null }> {
  if (!UUID_PATTERN.test(savedSearchId)) throw new Error("A valid saved search ID is required.");
  const account = await requireAccount(authUserId);
  const search = await dashboardSelectOne<SavedSearchRow>("customer_saved_searches", {
    select: "id,name,status,current_version_id,created_at,updated_at",
    id: `eq.${savedSearchId}`,
    customer_account_id: `eq.${account.id}`
  });
  if (!search) throw new Error("Saved search was not found.");
  const version = search.current_version_id
    ? await dashboardSelectOne<SavedSearchVersionRow>("customer_saved_search_versions", {
        select: "id,saved_search_id,version,configuration,created_at",
        id: `eq.${search.current_version_id}`,
        saved_search_id: `eq.${search.id}`
      })
    : null;
  const profileLinks = version
    ? await dashboardSelect<MonitoredVersionRow>(
        "customer_monitored_profile_saved_search_versions",
        { select: "monitored_profile_id,saved_search_version_id", saved_search_version_id: `eq.${version.id}` }
      )
    : [];
  const profileId = profileLinks[0]?.monitored_profile_id;
  const profile = profileId
    ? await dashboardSelectOne<MonitoredProfileRow>("monitored_profiles", {
        select: "id,source_scan_id,latest_scan_id,cadence,status,next_run_at,last_run_at",
        id: `eq.${profileId}`
      })
    : null;
  return { account, search, version, profile };
}

export async function updateSavedSearch(
  authUserId: string,
  savedSearchId: string,
  input: { name?: string; configuration: SavedSearchConfiguration }
): Promise<string> {
  const owned = await requireOwnedSavedSearch(authUserId, savedSearchId);
  if (!owned.version) throw new Error("Saved search has no current version.");
  const name = input.name?.trim();
  if (name && name.length > 120) throw new Error("Saved search name is too long.");
  const allowedKeys = [
    "companyUrl", "industry", "headquartersState", "targetStates", "customerType",
    "opportunityFocus", "includeTerms", "excludeTerms", "prioritySignals"
  ];
  const configuration: SavedSearchConfiguration = {};
  for (const key of allowedKeys) {
    const value = input.configuration[key];
    if (typeof value === "string") configuration[key] = value.trim().slice(0, 2000);
    else if (key === "prioritySignals" && Array.isArray(value)) {
      configuration[key] = value.filter((item): item is string => typeof item === "string").slice(0, 20);
    }
  }
  const version = await dashboardInsert<{ id: string }>("customer_saved_search_versions", {
    saved_search_id: owned.search.id,
    version: owned.version.version + 1,
    configuration: { ...owned.version.configuration, ...configuration },
    created_by_auth_user_id: authUserId
  });
  if (!version) throw new Error("Saved search version could not be created.");
  await dashboardUpdate("customer_saved_searches", { id: `eq.${owned.search.id}` }, {
    current_version_id: version.id,
    ...(name ? { name } : {}),
    updated_at: new Date().toISOString()
  });
  if (owned.profile) {
    await dashboardUpdate(
      "customer_monitored_profile_saved_search_versions",
      { monitored_profile_id: `eq.${owned.profile.id}` },
      { saved_search_version_id: version.id }
    );
  }
  return version.id;
}

export async function setSavedSearchStatus(
  authUserId: string,
  savedSearchId: string,
  status: "active" | "paused" | "archived"
): Promise<void> {
  const owned = await requireOwnedSavedSearch(authUserId, savedSearchId);
  await dashboardUpdate("customer_saved_searches", { id: `eq.${owned.search.id}` }, {
    status,
    updated_at: new Date().toISOString()
  });
  if (owned.profile) {
    await dashboardUpdate("monitored_profiles", { id: `eq.${owned.profile.id}` }, {
      status: status === "archived" ? "canceled" : status,
      lease_expires_at: null,
      updated_at: new Date().toISOString()
    });
  }
}

export async function requestSavedSearchRunNow(authUserId: string, savedSearchId: string): Promise<string> {
  const owned = await requireOwnedSavedSearch(authUserId, savedSearchId);
  if (!owned.profile || owned.profile.status !== "active") {
    throw new Error("Resume this saved search before running it.");
  }
  await dashboardUpdate("monitored_profiles", { id: `eq.${owned.profile.id}` }, {
    next_run_at: new Date().toISOString(),
    lease_expires_at: null,
    updated_at: new Date().toISOString()
  });
  return owned.profile.id;
}

async function requireAccount(authUserId: string): Promise<CustomerAccountRecord> {
  if (!UUID_PATTERN.test(authUserId)) throw new Error("A valid authenticated user ID is required.");
  const account = await dashboardSelectOne<CustomerAccountRecord>("customer_accounts", {
    select: "id,auth_user_id,stripe_customer_id,email,created_at,updated_at",
    auth_user_id: `eq.${authUserId}`
  });
  if (!account) throw new Error("Customer dashboard account was not found.");
  return account;
}

async function ownedScanIds(accountId: string): Promise<string[]> {
  const rows = await dashboardSelect<ScanOwnershipRow>("customer_scan_ownership", {
    select: "scan_id",
    customer_account_id: `eq.${accountId}`
  });
  return rows.map((row) => row.scan_id);
}

export async function loadDashboardReports(
  authUserId: string,
  options: DashboardPageOptions = {}
): Promise<DashboardReport[]> {
  const account = await requireAccount(authUserId);
  const scanIds = await ownedScanIds(account.id);
  if (scanIds.length === 0) return [];

  const page = pageParameters(options);
  const scans = await dashboardSelect<ScanRow>("scans", {
    select: "id,company_name,company_url,status,report_type,report_access,created_at,completed_at",
    id: inFilter(scanIds),
    order: "created_at.desc",
    ...page
  });
  if (scans.length === 0) return [];
  const pageScanIds = scans.map((scan) => scan.id);

  const [reports, scanVersions, grantOwnership] = await Promise.all([
    dashboardSelect<ReportRow>("reports", {
      select: "id,scan_id,report_pdf_url,created_at",
      scan_id: inFilter(pageScanIds),
      order: "created_at.desc"
    }),
    dashboardSelect<ScanVersionRow>("customer_scan_saved_search_versions", {
      select: "scan_id,saved_search_version_id",
      scan_id: inFilter(pageScanIds)
    }),
    dashboardSelect<GrantOwnershipRow>("customer_report_grant_ownership", {
      select: "report_access_grant_id",
      customer_account_id: `eq.${account.id}`
    })
  ]);

  const grantIds = grantOwnership.map((row) => row.report_access_grant_id);
  const grants = grantIds.length
    ? await dashboardSelect<GrantRow>("stripe_report_access_grants", {
        select: "id,scan_id,status",
        id: inFilter(grantIds),
        scan_id: inFilter(pageScanIds)
      })
    : [];

  const reportByScan = new Map<string, ReportRow>();
  for (const report of reports) {
    if (!reportByScan.has(report.scan_id)) reportByScan.set(report.scan_id, report);
  }
  const versionByScan = new Map(scanVersions.map((row) => [row.scan_id, row.saved_search_version_id]));
  const activeGrantScans = new Set(
    grants.filter((grant) => grant.status === "active").map((grant) => grant.scan_id)
  );

  return scans.map((scan) => {
    const report = reportByScan.get(scan.id);
    return {
      scanId: scan.id,
      reportId: report?.id ?? null,
      companyName: scan.company_name,
      companyUrl: scan.company_url,
      status: scan.status,
      reportType: scan.report_type,
      reportAccess: scan.report_access,
      createdAt: scan.created_at,
      completedAt: scan.completed_at,
      reportCreatedAt: report?.created_at ?? null,
      pdfUrl: report?.report_pdf_url ?? null,
      hasActiveGrant: activeGrantScans.has(scan.id),
      savedSearchVersionId: versionByScan.get(scan.id) ?? null
    };
  });
}

async function ownedMonitoredProfiles(accountId: string): Promise<MonitoredProfileRow[]> {
  const ownership = await dashboardSelect<MonitoredOwnershipRow>(
    "customer_monitored_profile_ownership",
    {
      select: "monitored_profile_id",
      customer_account_id: `eq.${accountId}`
    }
  );
  const ids = ownership.map((row) => row.monitored_profile_id);
  if (ids.length === 0) return [];
  return dashboardSelect<MonitoredProfileRow>("monitored_profiles", {
    select: "id,source_scan_id,latest_scan_id,cadence,status,next_run_at,last_run_at",
    id: inFilter(ids),
    order: "created_at.desc"
  });
}

export async function loadDashboardSavedSearches(authUserId: string): Promise<DashboardSavedSearch[]> {
  const account = await requireAccount(authUserId);
  const [searches, profiles] = await Promise.all([
    dashboardSelect<SavedSearchRow>("customer_saved_searches", {
      select: "id,name,status,current_version_id,created_at,updated_at",
      customer_account_id: `eq.${account.id}`,
      order: "updated_at.desc"
    }),
    ownedMonitoredProfiles(account.id)
  ]);
  if (searches.length === 0) return [];

  const [versions, profileVersions] = await Promise.all([
    dashboardSelect<SavedSearchVersionRow>("customer_saved_search_versions", {
      select: "id,saved_search_id,version,configuration,created_at",
      saved_search_id: inFilter(searches.map((search) => search.id)),
      order: "version.desc"
    }),
    profiles.length
      ? dashboardSelect<MonitoredVersionRow>("customer_monitored_profile_saved_search_versions", {
          select: "monitored_profile_id,saved_search_version_id",
          monitored_profile_id: inFilter(profiles.map((profile) => profile.id))
        })
      : Promise.resolve([])
  ]);

  const versionById = new Map(versions.map((version) => [version.id, version]));
  const profileVersionById = new Map(
    profileVersions.map((row) => [row.monitored_profile_id, row.saved_search_version_id])
  );
  const profileBySearch = new Map<
    string,
    { profile: MonitoredProfileRow; savedSearchVersionId: string }
  >();
  for (const profile of profiles) {
    const versionId = profileVersionById.get(profile.id);
    const version = versionId ? versionById.get(versionId) : null;
    if (version && versionId) {
      profileBySearch.set(version.saved_search_id, {
        profile,
        savedSearchVersionId: versionId
      });
    }
  }

  return searches.map((search) => {
    const currentVersion = search.current_version_id
      ? versionById.get(search.current_version_id) ?? null
      : null;
    const monitored = profileBySearch.get(search.id) ?? null;
    return {
      id: search.id,
      name: search.name,
      status: search.status,
      currentVersion: currentVersion
        ? {
            id: currentVersion.id,
            version: currentVersion.version,
            configuration: currentVersion.configuration,
            createdAt: currentVersion.created_at
          }
        : null,
      monitoredProfile: monitored
        ? {
            id: monitored.profile.id,
            sourceScanId: monitored.profile.source_scan_id,
            latestScanId: monitored.profile.latest_scan_id,
            cadence: monitored.profile.cadence,
            status: monitored.profile.status,
            nextRunAt: monitored.profile.next_run_at,
            lastRunAt: monitored.profile.last_run_at,
            savedSearchVersionId: monitored.savedSearchVersionId
          }
        : null,
      createdAt: search.created_at,
      updatedAt: search.updated_at
    };
  });
}

export async function loadDashboardMonitoredSearches(
  authUserId: string
): Promise<DashboardSavedSearch[]> {
  const searches = await loadDashboardSavedSearches(authUserId);
  return searches.filter((search) => search.monitoredProfile !== null);
}

export async function loadDashboardMonitoringRuns(
  authUserId: string,
  options: DashboardPageOptions = {}
): Promise<DashboardMonitoringRun[]> {
  const account = await requireAccount(authUserId);
  const profiles = await ownedMonitoredProfiles(account.id);
  if (profiles.length === 0) return [];
  const page = pageParameters(options);
  const rows = await dashboardSelect<MonitoringRunRow>("monitoring_runs", {
    select:
      "id,monitored_profile_id,scan_id,status,new_opportunity_count,error_message,started_at,completed_at",
    monitored_profile_id: inFilter(profiles.map((profile) => profile.id)),
    order: "started_at.desc",
    ...page
  });
  return rows.map((row) => ({
    id: row.id,
    monitoredProfileId: row.monitored_profile_id,
    scanId: row.scan_id,
    status: row.status,
    newOpportunityCount: row.new_opportunity_count,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at
  }));
}

export async function loadDashboardBillingState(authUserId: string): Promise<DashboardBillingState> {
  const account = await requireAccount(authUserId);
  const grantOwnership = await dashboardSelect<GrantOwnershipRow>(
    "customer_report_grant_ownership",
    {
      select: "report_access_grant_id",
      customer_account_id: `eq.${account.id}`
    }
  );
  const grantIds = grantOwnership.map((row) => row.report_access_grant_id);
  const [customer, subscriptions, grants] = await Promise.all([
    account.stripe_customer_id
      ? dashboardSelectOne<StripeCustomerRow>("stripe_customers", {
          select: "stripe_customer_id,email",
          stripe_customer_id: `eq.${account.stripe_customer_id}`
        })
      : Promise.resolve(null),
    account.stripe_customer_id
      ? dashboardSelect<SubscriptionRow>("stripe_subscriptions", {
          select:
            "stripe_subscription_id,product,billing_interval,status,cancel_at_period_end,current_period_end",
          stripe_customer_id: `eq.${account.stripe_customer_id}`,
          order: "created_at.desc"
        })
      : Promise.resolve([]),
    grantIds.length
      ? dashboardSelect<GrantRow>("stripe_report_access_grants", {
          select: "id,scan_id,status",
          id: inFilter(grantIds)
        })
      : Promise.resolve([])
  ]);

  return {
    stripeCustomerId: account.stripe_customer_id,
    customerEmail: account.email,
    stripeEmail: customer?.email ?? null,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.stripe_subscription_id,
      product: subscription.product,
      billingInterval: subscription.billing_interval,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end
    })),
    activeReportGrantCount: grants.filter((grant) => grant.status === "active").length
  };
}

export async function loadDashboardSummary(authUserId: string): Promise<DashboardSummary> {
  const account = await requireAccount(authUserId);
  const [reports, savedSearches, runs, billing] = await Promise.all([
    loadDashboardReports(authUserId, { limit: 5 }),
    loadDashboardSavedSearches(authUserId),
    loadDashboardMonitoringRuns(authUserId, { limit: 100 }),
    loadDashboardBillingState(authUserId)
  ]);
  const scanIds = await ownedScanIds(account.id);
  const allScans = scanIds.length
    ? await dashboardSelect<Pick<ScanRow, "id" | "status">>("scans", {
        select: "id,status",
        id: inFilter(scanIds)
      })
    : [];

  return {
    account: {
      id: account.id,
      email: account.email,
      stripe_customer_id: account.stripe_customer_id
    },
    reportCount: allScans.length,
    completedReportCount: allScans.filter((scan) => scan.status === "completed").length,
    activeSavedSearchCount: savedSearches.filter((search) => search.status === "active").length,
    activeMonitorCount: savedSearches.filter(
      (search) => search.monitoredProfile?.status === "active"
    ).length,
    newOpportunityCount: runs.reduce((total, run) => total + run.newOpportunityCount, 0),
    billing,
    recentReports: reports
  };
}
