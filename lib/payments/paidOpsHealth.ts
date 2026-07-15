import { evaluateLaunchHealth } from "../launchHealth.ts";
import { getStripeServerConfig } from "./config.ts";
import {
  verifyReportCatalogCached,
  type ReportCatalogPreflightResult
} from "./reportCatalogPreflight.ts";

type PaidOpsEnvironment = Record<string, string | undefined>;

const WEBHOOK_FRESHNESS_MS = 24 * 60 * 60_000;
const PENDING_DELIVERY_GRACE_MS = 15 * 60_000;
const CATALOG_TIMEOUT_MS = 1_500;
const DATABASE_TIMEOUT_MS = 2_500;
const MAX_DELIVERY_BACKLOG_ROWS = 1_000;

type PaidOperationalSnapshot = {
  recentWebhookCount: number;
  latestWebhookProcessedAt: string | null;
  pendingDeliveries: number;
  stalePendingDeliveries: number;
  failedDeliveries: number;
  activeGrants: number;
  refundedGrants: number;
  disputedGrants: number;
  claimedActiveGrants: number;
  deliveredRecoveryGrants: number;
  activeGrantsWithoutDeliveryAttempt: number;
};

type PaidOpsHealthDependencies = {
  now: () => Date;
  checkCatalog: () => Promise<ReportCatalogPreflightResult>;
  loadOperationalSnapshot: (
    env: PaidOpsEnvironment,
    now: Date
  ) => Promise<PaidOperationalSnapshot>;
};

type CountResponse = {
  count: number;
};

type RowsResponse<T> = CountResponse & {
  rows: T[];
};

type BillingRestConfig = {
  baseUrl: string;
  serviceRoleKey: string;
};

type DeliveryBacklogRow = {
  status?: unknown;
  updated_at?: unknown;
};

export type PaidOpsHealth = {
  ok: boolean;
  ready: {
    paidReport: boolean;
  };
  checkedAt: string;
  checks: {
    configuration: {
      ok: boolean;
      reportCheckoutEnabled: boolean;
      liveStripe: boolean;
      database: boolean;
      auth: boolean;
      scans: boolean;
      deliveryEmail: boolean;
      support: boolean;
      analytics: boolean;
    };
    catalog: {
      ok: boolean;
      status: "verified" | "invalid" | "unavailable" | "not_checked";
      checkedAt: string | null;
    };
    webhooks: {
      ok: boolean;
      recentPersisted: number | null;
      latestPersistedAt: string | null;
      freshnessWindowMinutes: number;
    };
    delivery: {
      ok: boolean;
      pending: number | null;
      stalePending: number | null;
      failed: number | null;
      pendingGraceMinutes: number;
    };
    grants: {
      ok: boolean;
      active: number | null;
      refunded: number | null;
      disputed: number | null;
    };
    claimRecovery: {
      ok: boolean;
      claimedActive: number | null;
      unclaimedActive: number | null;
      deliveredRecovery: number | null;
      activeWithoutDeliveryAttempt: number | null;
    };
  };
};

function paidCatalogCheck(): Promise<ReportCatalogPreflightResult> {
  const config = getStripeServerConfig();
  return verifyReportCatalogCached({
    ...config,
    prices: { ...config.prices, requireLivemode: true }
  });
}

const defaultDependencies: PaidOpsHealthDependencies = {
  now: () => new Date(),
  checkCatalog: paidCatalogCheck,
  loadOperationalSnapshot: loadPaidOperationalSnapshot
};

function billingRestConfig(env: PaidOpsEnvironment): BillingRestConfig {
  const rawUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceRoleKey) throw new Error("Paid operations database is not configured.");

  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Paid operations database URL is invalid.");
  }
  return { baseUrl: rawUrl.replace(/\/$/, ""), serviceRoleKey };
}

function contentRangeCount(response: Response): number {
  const contentRange = response.headers.get("content-range");
  const match = contentRange?.match(/\/(\d+)$/);
  const count = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Paid operations aggregate count could not be verified.");
  }
  return count;
}

function restUrl(config: BillingRestConfig, table: string, parameters: Record<string, string>): string {
  return `${config.baseUrl}/rest/v1/${table}?${new URLSearchParams(parameters).toString()}`;
}

function restHeaders(config: BillingRestConfig, range: string): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Prefer: "count=exact",
    Range: range
  };
}

async function countRows(
  config: BillingRestConfig,
  table: string,
  parameters: Record<string, string>,
  signal: AbortSignal
): Promise<CountResponse> {
  const response = await fetch(restUrl(config, table, parameters), {
    method: "HEAD",
    headers: restHeaders(config, "0-0"),
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error("Paid operations aggregate query failed.");
  return { count: contentRangeCount(response) };
}

async function selectRowsWithCount<T>(
  config: BillingRestConfig,
  table: string,
  parameters: Record<string, string>,
  maximumRows: number,
  signal: AbortSignal,
  requireCompleteResult = true
): Promise<RowsResponse<T>> {
  const response = await fetch(restUrl(config, table, parameters), {
    headers: restHeaders(config, `0-${maximumRows - 1}`),
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error("Paid operations aggregate query failed.");
  const count = contentRangeCount(response);
  if (requireCompleteResult && count > maximumRows) {
    throw new Error("Paid operations backlog exceeds the safe query bound.");
  }
  const rows = (await response.json()) as T[];
  const expectedRows = Math.min(count, maximumRows);
  if (!Array.isArray(rows) || rows.length !== expectedRows) {
    throw new Error("Paid operations aggregate rows could not be verified.");
  }
  return { count, rows };
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function exactNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function assertValidSnapshot(snapshot: PaidOperationalSnapshot): void {
  const counts = [
    snapshot.recentWebhookCount,
    snapshot.pendingDeliveries,
    snapshot.stalePendingDeliveries,
    snapshot.failedDeliveries,
    snapshot.activeGrants,
    snapshot.refundedGrants,
    snapshot.disputedGrants,
    snapshot.claimedActiveGrants,
    snapshot.deliveredRecoveryGrants,
    snapshot.activeGrantsWithoutDeliveryAttempt
  ];
  if (
    !counts.every(exactNonNegativeInteger)
    || snapshot.claimedActiveGrants > snapshot.activeGrants
    || snapshot.deliveredRecoveryGrants > snapshot.activeGrants
    || snapshot.activeGrantsWithoutDeliveryAttempt > snapshot.activeGrants
    || snapshot.stalePendingDeliveries > snapshot.pendingDeliveries
    || (snapshot.latestWebhookProcessedAt !== null && !validDate(snapshot.latestWebhookProcessedAt))
  ) {
    throw new Error("Paid operations snapshot is invalid.");
  }
}

export async function loadPaidOperationalSnapshot(
  env: PaidOpsEnvironment,
  now: Date
): Promise<PaidOperationalSnapshot> {
  const config = billingRestConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATABASE_TIMEOUT_MS);
  const recentSince = new Date(now.getTime() - WEBHOOK_FRESHNESS_MS).toISOString();
  const pendingStaleBefore = now.getTime() - PENDING_DELIVERY_GRACE_MS;

  try {
    const [webhooks, deliveryBacklog, active, refunded, disputed, claimedActive, deliveredRecovery, missingDelivery] =
      await Promise.all([
        selectRowsWithCount<{ processed_at?: unknown }>(
          config,
          "stripe_webhook_events",
          {
            select: "processed_at",
            processed_at: `gte.${recentSince}`,
            order: "processed_at.desc",
            limit: "1"
          },
          1,
          controller.signal,
          false
        ),
        selectRowsWithCount<DeliveryBacklogRow>(
          config,
          "paid_report_delivery_attempts",
          {
            select: "status,updated_at",
            status: "in.(pending,failed)",
            order: "updated_at.asc",
            limit: String(MAX_DELIVERY_BACKLOG_ROWS)
          },
          MAX_DELIVERY_BACKLOG_ROWS,
          controller.signal
        ),
        countRows(config, "stripe_report_access_grants", { select: "id", status: "eq.active" }, controller.signal),
        countRows(config, "stripe_report_access_grants", { select: "id", status: "eq.refunded" }, controller.signal),
        countRows(config, "stripe_report_access_grants", { select: "id", status: "eq.disputed" }, controller.signal),
        countRows(
          config,
          "customer_report_grant_ownership",
          {
            select: "report_access_grant_id,stripe_report_access_grants!inner(id)",
            "stripe_report_access_grants.status": "eq.active"
          },
          controller.signal
        ),
        countRows(
          config,
          "paid_report_delivery_attempts",
          {
            select: "report_access_grant_id,stripe_report_access_grants!inner(id)",
            status: "eq.delivered",
            "stripe_report_access_grants.status": "eq.active"
          },
          controller.signal
        ),
        countRows(
          config,
          "stripe_report_access_grants",
          {
            select: "id,paid_report_delivery_attempts!left(id)",
            status: "eq.active",
            "paid_report_delivery_attempts.id": "is.null"
          },
          controller.signal
        )
      ]);

    const latestWebhook = validDate(webhooks.rows[0]?.processed_at);
    if (webhooks.count > 0 && !latestWebhook) {
      throw new Error("Recent Stripe webhook persistence timestamp is invalid.");
    }

    let pendingDeliveries = 0;
    let stalePendingDeliveries = 0;
    let failedDeliveries = 0;
    for (const row of deliveryBacklog.rows) {
      if (row.status === "failed") {
        failedDeliveries += 1;
        continue;
      }
      if (row.status !== "pending") throw new Error("Paid delivery backlog status is invalid.");
      const updatedAt = validDate(row.updated_at);
      if (!updatedAt) throw new Error("Paid delivery backlog timestamp is invalid.");
      pendingDeliveries += 1;
      if (updatedAt.getTime() < pendingStaleBefore) stalePendingDeliveries += 1;
    }

    const snapshot: PaidOperationalSnapshot = {
      recentWebhookCount: webhooks.count,
      latestWebhookProcessedAt: latestWebhook?.toISOString() ?? null,
      pendingDeliveries,
      stalePendingDeliveries,
      failedDeliveries,
      activeGrants: active.count,
      refundedGrants: refunded.count,
      disputedGrants: disputed.count,
      claimedActiveGrants: claimedActive.count,
      deliveredRecoveryGrants: deliveredRecovery.count,
      activeGrantsWithoutDeliveryAttempt: missingDelivery.count
    };
    assertValidSnapshot(snapshot);
    return snapshot;
  } finally {
    clearTimeout(timeout);
  }
}

function unavailableOperationalChecks(): Pick<
  PaidOpsHealth["checks"],
  "webhooks" | "delivery" | "grants" | "claimRecovery"
> {
  return {
    webhooks: {
      ok: false,
      recentPersisted: null,
      latestPersistedAt: null,
      freshnessWindowMinutes: WEBHOOK_FRESHNESS_MS / 60_000
    },
    delivery: {
      ok: false,
      pending: null,
      stalePending: null,
      failed: null,
      pendingGraceMinutes: PENDING_DELIVERY_GRACE_MS / 60_000
    },
    grants: { ok: false, active: null, refunded: null, disputed: null },
    claimRecovery: {
      ok: false,
      claimedActive: null,
      unclaimedActive: null,
      deliveredRecovery: null,
      activeWithoutDeliveryAttempt: null
    }
  };
}

export async function evaluatePaidOpsHealth(
  env: PaidOpsEnvironment = process.env,
  dependencies: PaidOpsHealthDependencies = defaultDependencies
): Promise<PaidOpsHealth> {
  const now = dependencies.now();
  const checkedAt = Number.isFinite(now.getTime()) ? now.toISOString() : new Date(0).toISOString();
  const reportCheckoutEnabled = env.ENABLE_PAID_REPORT_CHECKOUT?.trim() === "true";
  const liveStripe = env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") === true;
  const databaseConfigured = Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  const catalogPromise = (async () => {
    if (!reportCheckoutEnabled || !liveStripe) {
      return { catalog: null, unavailable: false };
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), CATALOG_TIMEOUT_MS);
      });
      const catalog = await Promise.race([dependencies.checkCatalog(), timedOut]);
      return { catalog, unavailable: catalog === null };
    } catch {
      return { catalog: null, unavailable: true };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  })();

  const snapshotPromise = (async () => {
    if (!databaseConfigured) return null;
    try {
      const loaded = await dependencies.loadOperationalSnapshot(env, now);
      assertValidSnapshot(loaded);
      return loaded;
    } catch {
      return null;
    }
  })();

  const [{ catalog, unavailable: catalogUnavailable }, snapshot] = await Promise.all([
    catalogPromise,
    snapshotPromise
  ]);

  const catalogForLaunch = catalog ?? {
    ok: false as const,
    code: "STRIPE_UNAVAILABLE" as const,
    reason: "Report catalog could not be verified.",
    checkedAt
  };
  const launch = evaluateLaunchHealth(env, catalogForLaunch);
  const configurationOk = launch.ready.reportCheckout && liveStripe;
  const configuration = {
    ok: configurationOk,
    reportCheckoutEnabled,
    liveStripe,
    database: launch.services.database,
    auth: launch.services.auth,
    scans: launch.services.scans,
    deliveryEmail: launch.services.email,
    support: launch.services.support,
    analytics: launch.services.analytics
  };

  const catalogCheckedAt = validDate(catalog?.checkedAt)?.toISOString() ?? null;
  const catalogCheck = {
    ok: catalog?.ok === true,
    status: (
      !reportCheckoutEnabled || !liveStripe
        ? "not_checked"
        : catalogUnavailable || catalog?.code === "STRIPE_UNAVAILABLE"
          ? "unavailable"
          : catalog?.ok
            ? "verified"
            : "invalid"
    ) as PaidOpsHealth["checks"]["catalog"]["status"],
    checkedAt: catalogCheckedAt
  };

  if (!snapshot) {
    const unavailable = unavailableOperationalChecks();
    return {
      ok: false,
      ready: { paidReport: false },
      checkedAt,
      checks: { configuration, catalog: catalogCheck, ...unavailable }
    };
  }

  const latestWebhook = validDate(snapshot.latestWebhookProcessedAt);
  const webhooksOk = snapshot.recentWebhookCount > 0
    && latestWebhook !== null
    && latestWebhook.getTime() >= now.getTime() - WEBHOOK_FRESHNESS_MS
    && latestWebhook.getTime() <= now.getTime() + 60_000;
  const deliveryOk = snapshot.failedDeliveries === 0 && snapshot.stalePendingDeliveries === 0;
  const grantsOk = snapshot.claimedActiveGrants <= snapshot.activeGrants
    && snapshot.deliveredRecoveryGrants <= snapshot.activeGrants;
  const claimRecoveryOk = snapshot.activeGrantsWithoutDeliveryAttempt === 0;
  const ready = configurationOk && catalogCheck.ok && webhooksOk && deliveryOk && grantsOk && claimRecoveryOk;

  return {
    ok: ready,
    ready: { paidReport: ready },
    checkedAt,
    checks: {
      configuration,
      catalog: catalogCheck,
      webhooks: {
        ok: webhooksOk,
        recentPersisted: snapshot.recentWebhookCount,
        latestPersistedAt: latestWebhook?.toISOString() ?? null,
        freshnessWindowMinutes: WEBHOOK_FRESHNESS_MS / 60_000
      },
      delivery: {
        ok: deliveryOk,
        pending: snapshot.pendingDeliveries,
        stalePending: snapshot.stalePendingDeliveries,
        failed: snapshot.failedDeliveries,
        pendingGraceMinutes: PENDING_DELIVERY_GRACE_MS / 60_000
      },
      grants: {
        ok: grantsOk,
        active: snapshot.activeGrants,
        refunded: snapshot.refundedGrants,
        disputed: snapshot.disputedGrants
      },
      claimRecovery: {
        ok: claimRecoveryOk,
        claimedActive: snapshot.claimedActiveGrants,
        unclaimedActive: snapshot.activeGrants - snapshot.claimedActiveGrants,
        deliveredRecovery: snapshot.deliveredRecoveryGrants,
        activeWithoutDeliveryAttempt: snapshot.activeGrantsWithoutDeliveryAttempt
      }
    }
  };
}

export function paidOpsHealthStatus(health: PaidOpsHealth): 200 | 503 {
  return health.ready.paidReport ? 200 : 503;
}
