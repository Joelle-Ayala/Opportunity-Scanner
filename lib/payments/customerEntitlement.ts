import { dashboardSelect, dashboardSelectOne, inFilter } from "@/lib/dashboard/rest";

type AccountRow = { id: string; stripe_customer_id: string | null };
type ProfileOwnershipRow = { monitored_profile_id: string };
type GrantOwnershipRow = { report_access_grant_id: string };
type DemoEntitlementScanRow = { scan_id: string };
export type CustomerDemoEntitlementRow = {
  id: string;
  customer_account_id: string;
  plan: "growth";
  status: "active" | "expired" | "revoked";
  starts_at: string;
  expires_at: string;
};
type MonitoredProfileRow = {
  id: string;
  stripe_customer_id: string | null;
  customer_demo_entitlement_id: string | null;
  source_scan_id: string;
  latest_scan_id: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isActiveCustomerDemoEntitlement(
  entitlement: CustomerDemoEntitlementRow | null,
  now = new Date()
): boolean {
  if (!entitlement || entitlement.plan !== "growth" || entitlement.status !== "active") return false;
  const startsAt = Date.parse(entitlement.starts_at);
  const expiresAt = Date.parse(entitlement.expires_at);
  const nowMs = now.getTime();
  return Number.isFinite(startsAt)
    && Number.isFinite(expiresAt)
    && startsAt <= nowMs
    && expiresAt > nowMs;
}

async function loadActiveCustomerDemoEntitlement(
  accountId: string,
  now = new Date()
): Promise<CustomerDemoEntitlementRow | null> {
  const timestamp = now.toISOString();
  const entitlement = await dashboardSelectOne<CustomerDemoEntitlementRow>(
    "customer_demo_entitlements",
    {
      select: "id,customer_account_id,plan,status,starts_at,expires_at",
      customer_account_id: `eq.${accountId}`,
      plan: "eq.growth",
      status: "eq.active",
      starts_at: `lte.${timestamp}`,
      expires_at: `gt.${timestamp}`,
      order: "expires_at.desc"
    }
  );
  return isActiveCustomerDemoEntitlement(entitlement, now) ? entitlement : null;
}

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
  const demoEntitlement = await loadActiveCustomerDemoEntitlement(account.id);
  if (demoEntitlement) {
    const demoOwnedScan = await dashboardSelectOne<DemoEntitlementScanRow>("customer_demo_entitlement_scans", {
      select: "scan_id",
      customer_demo_entitlement_id: `eq.${demoEntitlement.id}`,
      scan_id: `eq.${scanId}`
    });
    if (demoOwnedScan) return true;
  }
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
  if (!account) return false;
  const [subscription, demoEntitlement] = await Promise.all([
    account.stripe_customer_id
      ? dashboardSelectOne<{ stripe_subscription_id: string }>("stripe_subscriptions", {
          select: "stripe_subscription_id",
          stripe_customer_id: `eq.${account.stripe_customer_id}`,
          livemode: "eq.true",
          status: "in.(active,trialing)",
          product: "in.(monitor,growth)"
        })
      : Promise.resolve(null),
    loadActiveCustomerDemoEntitlement(account.id)
  ]);
  if (!subscription && !demoEntitlement) return false;
  const ownership = await dashboardSelect<ProfileOwnershipRow>("customer_monitored_profile_ownership", {
    select: "monitored_profile_id",
    customer_account_id: `eq.${account.id}`
  });
  const profileIds = ownership.map((row) => row.monitored_profile_id);
  if (profileIds.length === 0) return false;
  const profiles = await dashboardSelect<MonitoredProfileRow>("monitored_profiles", {
    select: "id,stripe_customer_id,customer_demo_entitlement_id,source_scan_id,latest_scan_id",
    id: inFilter(profileIds)
  });
  const demoScanIds = demoEntitlement
    ? new Set(
        (
          await dashboardSelect<DemoEntitlementScanRow>("customer_demo_entitlement_scans", {
            select: "scan_id",
            customer_demo_entitlement_id: `eq.${demoEntitlement.id}`
          })
        ).map((row) => row.scan_id)
      )
    : new Set<string>();
  const entitledProfileIds = new Set(
    profiles
      .filter((profile) =>
        (
          Boolean(subscription)
          && profile.stripe_customer_id === account.stripe_customer_id
        )
        || (
          Boolean(demoEntitlement)
          && Boolean(profile.customer_demo_entitlement_id)
          && demoScanIds.has(profile.source_scan_id)
        )
      )
      .map((profile) => profile.id)
  );
  if (entitledProfileIds.size === 0) return false;
  if (profiles.some((profile) =>
    entitledProfileIds.has(profile.id)
    && (profile.source_scan_id === scanId || profile.latest_scan_id === scanId)
  )) {
    return true;
  }
  profileIds.splice(0, profileIds.length, ...entitledProfileIds);
  const run = await dashboardSelectOne<{ id: string }>("monitoring_runs", {
    select: "id",
    monitored_profile_id: inFilter(profileIds),
    scan_id: `eq.${scanId}`,
    status: "eq.completed"
  });
  return Boolean(run);
}
