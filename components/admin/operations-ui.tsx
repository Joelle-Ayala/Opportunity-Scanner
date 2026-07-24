import type { AdminOperationsSnapshot } from "@/lib/admin/operations";

type Tone = "healthy" | "attention" | "neutral";

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const classes = tone === "healthy"
    ? "bg-emerald-50 text-emerald-700"
    : tone === "attention"
      ? "bg-amber-50 text-amber-800"
      : "bg-slate-100 text-slate-700";
  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="border-l-2 border-line pl-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value ?? "Unavailable"}</p>
    </div>
  );
}

function formatTime(value: string | null): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function HealthSection({
  title,
  description,
  badge,
  children
}: {
  title: string;
  description: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line py-6 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {badge}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function availabilityBadge(available: boolean, healthy: boolean) {
  if (!available) return <StatusBadge label="Unavailable" tone="neutral" />;
  return healthy
    ? <StatusBadge label="Healthy" tone="healthy" />
    : <StatusBadge label="Needs attention" tone="attention" />;
}

export function OperationsOverview({ snapshot }: { snapshot: AdminOperationsSnapshot }) {
  return (
    <div className="mt-6 rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
      <HealthSection
        title="Launch readiness"
        description="Customer-facing gates stay closed until every required operational dependency is ready."
        badge={snapshot.launch.subscriptionCheckout
          ? <StatusBadge label="Subscriptions ready" tone="healthy" />
          : <StatusBadge label="Launch gates closed" tone="attention" />}
      >
        <Metric label="Demo" value={snapshot.launch.demo ? "Ready" : "Blocked"} />
        <Metric label="Paid signup" value={snapshot.launch.paidSignup ? "Ready" : "Blocked"} />
        <Metric label="Report checkout" value={snapshot.launch.reportCheckout ? "Open" : "Closed"} />
        <Metric label="Subscriptions" value={snapshot.launch.subscriptionCheckout ? "Open" : "Closed"} />
        <Metric label="Support mailbox" value={snapshot.launch.support ? "Ready" : "Not ready"} />
        <Metric label="Lifecycle email" value={snapshot.launch.email ? "Ready" : "Not ready"} />
        <Metric label="Analytics" value={snapshot.launch.analytics ? "Ready" : "Not ready"} />
        <Metric label="Release" value={snapshot.release.version} />
      </HealthSection>

      <HealthSection
        title="Monitoring scheduler"
        description="Recent scheduler activity, queue pressure, and delivery reliability."
        badge={availabilityBadge(snapshot.monitoring.available, snapshot.monitoring.healthy)}
      >
        <Metric label="Last completed run" value={formatTime(snapshot.monitoring.latestRunAt)} />
        <Metric label="HTTP status" value={snapshot.monitoring.latestHttpStatus} />
        <Metric label="Due backlog" value={snapshot.monitoring.backlog} />
        <Metric label="Retrying" value={snapshot.monitoring.retrying} />
        <Metric label="Dead letters" value={snapshot.monitoring.deadLetters} />
        <Metric label="Stale leases" value={snapshot.monitoring.staleLeases} />
        <Metric label="Recent cadence" value={snapshot.monitoring.schedulerRecent ? "On time" : "Missing"} />
        <Metric label="Outcome" value={snapshot.monitoring.latestOutcome?.replaceAll("_", " ") ?? null} />
      </HealthSection>

      <HealthSection
        title="Subscription recovery"
        description="Aggregate activation and reminder recovery status. No customer records are shown here."
        badge={availabilityBadge(snapshot.subscriptions.available, snapshot.subscriptions.healthy)}
      >
        <Metric label="Without monitoring" value={snapshot.subscriptions.activeWithoutProfile} />
        <Metric label="Pending recovery" value={snapshot.subscriptions.pendingRecovery} />
        <Metric label="Stale recovery" value={snapshot.subscriptions.staleRecovery} />
        <Metric label="Recovery dead letters" value={snapshot.subscriptions.deadLetterRecovery} />
        <Metric label="Pending reminders" value={snapshot.subscriptions.pendingReminder} />
        <Metric label="Reminder dead letters" value={snapshot.subscriptions.deadLetterReminder} />
      </HealthSection>

      <HealthSection
        title="Paid report operations"
        description="Payment event and fulfillment summaries for purchased reports."
        badge={availabilityBadge(snapshot.paidReports.available, snapshot.paidReports.healthy)}
      >
        <Metric label="Recent webhooks" value={snapshot.paidReports.recentWebhooks} />
        <Metric label="Pending delivery" value={snapshot.paidReports.pendingDelivery} />
        <Metric label="Failed delivery" value={snapshot.paidReports.failedDelivery} />
        <Metric label="Active grants" value={snapshot.paidReports.activeGrants} />
        <Metric label="Unclaimed grants" value={snapshot.paidReports.unclaimedGrants} />
      </HealthSection>

      <HealthSection
        title="Quality and source coverage"
        description="Recent review workload, customer fit feedback, and configured source coverage."
        badge={snapshot.review.available && snapshot.feedback.available
          ? <StatusBadge label="Available" tone="healthy" />
          : <StatusBadge label="Partially unavailable" tone="neutral" />}
      >
        <Metric label={`Reports held (recent ${snapshot.review.limitedTo})`} value={snapshot.review.held} />
        <Metric label={`Reports completed (recent ${snapshot.review.limitedTo})`} value={snapshot.review.completed} />
        <Metric label={`Positive feedback (recent ${snapshot.feedback.limitedTo})`} value={snapshot.feedback.positive} />
        <Metric label={`Negative feedback (recent ${snapshot.feedback.limitedTo})`} value={snapshot.feedback.negative} />
        <Metric label="Active sources" value={`${snapshot.sources.active} of ${snapshot.sources.total}`} />
        <Metric label="Sources needing attention" value={snapshot.sources.needsAttention} />
      </HealthSection>
    </div>
  );
}
