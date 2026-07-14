import { dashboardSelect, dashboardSelectOne, inFilter } from "@/lib/dashboard/rest";

type AccountRow = { id: string; stripe_customer_id: string | null };
type ProfileOwnershipRow = { monitored_profile_id: string };
type GrantOwnershipRow = { report_access_grant_id: string };
type MonitoredProfileRow = { id: string; source_scan_id: string; latest_scan_id: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function hasActiveCustomerReportGrant(authUserId: string, scanId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(authUserId) || !UUID_PATTERN.test(scanId)) return false;
  const account = await dashboardSelectOne<AccountRow>("customer_accounts", {
    select: "id,stripe_customer_id",
    auth_user_id: `eq.${authUserId}`
  });
  if (!account) return false;
  const accountGrant = await dashboardSelectOne<{ scan_id: string }>("customer_scan_ownership", {
    select: "scan_id",
    customer_account_id: `eq.${account.id}`,
    scan_id: `eq.${scanId}`,
    access_level: "eq.full"
  });
  if (accountGrant) return true;
  const ownership = await dashboardSelect<GrantOwnershipRow>("customer_report_grant_ownership", {
    select: "report_access_grant_id",
    customer_account_id: `eq.${account.id}`
  });
  const grantIds = ownership.map((row) => row.report_access_grant_id);
  if (grantIds.length === 0) return false;
  const grant = await dashboardSelectOne<{ id: string }>("stripe_report_access_grants", {
    select: "id",
    id: inFilter(grantIds),
    scan_id: `eq.${scanId}`,
    status: "eq.active"
  });
  return Boolean(grant);
}

export async function hasActiveCustomerMonitoringEntitlement(
  authUserId: string,
  scanId: string
): Promise<boolean> {
  if (!UUID_PATTERN.test(authUserId) || !UUID_PATTERN.test(scanId)) return false;
  const account = await dashboardSelectOne<AccountRow>("customer_accounts", {
    select: "id,stripe_customer_id",
    auth_user_id: `eq.${authUserId}`
  });
  if (!account?.stripe_customer_id) return false;
  const subscription = await dashboardSelectOne<{ stripe_subscription_id: string }>("stripe_subscriptions", {
    select: "stripe_subscription_id",
    stripe_customer_id: `eq.${account.stripe_customer_id}`,
    status: "in.(active,trialing)",
    product: "in.(monitor,growth)"
  });
  if (!subscription) return false;
  const ownership = await dashboardSelect<ProfileOwnershipRow>("customer_monitored_profile_ownership", {
    select: "monitored_profile_id",
    customer_account_id: `eq.${account.id}`
  });
  const profileIds = ownership.map((row) => row.monitored_profile_id);
  if (profileIds.length === 0) return false;
  const profiles = await dashboardSelect<MonitoredProfileRow>("monitored_profiles", {
    select: "id,source_scan_id,latest_scan_id",
    id: inFilter(profileIds)
  });
  if (profiles.some((profile) => profile.source_scan_id === scanId || profile.latest_scan_id === scanId)) {
    return true;
  }
  const run = await dashboardSelectOne<{ id: string }>("monitoring_runs", {
    select: "id",
    monitored_profile_id: inFilter(profileIds),
    scan_id: `eq.${scanId}`,
    status: "eq.completed"
  });
  return Boolean(run);
}
