# Deadline Alerts Rollout

## Migration

Apply the existing database files first, in their documented order, then run:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/deadline-alerts.sql
```

In the Supabase SQL editor, paste and run `db/deadline-alerts.sql` if direct database access is not configured. Apply this migration before deploying the application because it replaces the monitoring alert claim result shape.

## Environment

Keep the existing `APP_URL`, `CRON_SECRET`, `RESEND_API_KEY`, and verified `RESEND_FROM_EMAIL` values. Add a separate random secret of at least 32 characters:

```bash
openssl rand -base64 48
```

Store the result as `ALERT_UNSUBSCRIBE_SECRET` in local and Vercel Production, Preview, and Development environments. Do not commit the value.

## Verify

```bash
pnpm run typecheck
pnpm run test:deadline-alerts
pnpm run test:monitoring
pnpm run test:paid-customer-journey
```

Confirm the Resend sender domain is verified. In a staging account with an active Monitor or Growth subscription, save alert preferences, use an opportunity with an ISO deadline exactly 14, 7, or 1 day away, and invoke the protected monitoring cron once. Verify one `deadline_alerts` row and one Resend message. Invoke it again and verify no duplicate row or email is created.

## Deploy

1. Apply `db/deadline-alerts.sql`.
2. Add `ALERT_UNSUBSCRIBE_SECRET` to Vercel.
3. Deploy the application without changing the existing `/api/cron/monitoring` schedule.
4. Run the protected cron once and inspect its `delivery.deadlines` response.
5. Confirm the dashboard Alerts tab can disable all emails, then confirm another cron invocation suppresses pending jobs instead of sending them.

Rollback the application before rolling back the migration. The new tables are additive; leave them in place during an application rollback so queued delivery history and customer opt-outs are preserved.

