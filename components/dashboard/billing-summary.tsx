import type { ReactNode } from "react";
import { DashboardStatusBadge } from "./status-badge";

export interface BillingInvoiceRow {
  id: string;
  dateLabel: string;
  amountLabel: string;
  statusLabel: string;
  href?: string;
}

export interface BillingSummaryProps {
  planName: string;
  subscriptionStatus: "active" | "trialing" | "none";
  planIntervalLabel?: string;
  renewalLabel?: string;
  paymentMethodLabel?: string;
  paymentMethodDetail?: string;
  invoices?: BillingInvoiceRow[];
  manageAction?: ReactNode;
  upgradeAction?: ReactNode;
}

export function BillingSummary({
  planName,
  subscriptionStatus,
  planIntervalLabel,
  renewalLabel,
  paymentMethodLabel,
  paymentMethodDetail,
  invoices,
  manageAction,
  upgradeAction
}: BillingSummaryProps) {
  const hasSubscription = subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const statusLabel = subscriptionStatus === "trialing" ? "Trial" : hasSubscription ? "Active" : "No subscription";
  const hasPaymentMethodData = Boolean(paymentMethodLabel || paymentMethodDetail);

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="billing-plan-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase text-muted">Subscription</p>
              <DashboardStatusBadge tone={hasSubscription ? "success" : "neutral"}>{statusLabel}</DashboardStatusBadge>
            </div>
            <h2 id="billing-plan-title" className="mt-2 text-xl font-semibold text-ink">{planName}</h2>
            <p className="mt-1 text-sm text-muted">
              {hasSubscription ? renewalLabel || "Recurring monitoring is enabled." : "No recurring monitoring plan is active."}
            </p>
          </div>
          {hasSubscription && planIntervalLabel ? <p className="text-sm font-semibold capitalize text-steel">{planIntervalLabel} billing</p> : null}
        </div>
        {hasPaymentMethodData || manageAction || upgradeAction ? <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          {hasPaymentMethodData ? <div>
            <p className="text-sm font-semibold text-ink">Payment method</p>
            <p className="mt-1 text-sm text-muted">{[paymentMethodLabel, paymentMethodDetail].filter(Boolean).join(" / ")}</p>
          </div> : <div />}
          <div className="flex flex-wrap gap-2">{manageAction}{upgradeAction}</div>
        </div> : null}
      </section>

      {invoices !== undefined ? <section aria-labelledby="billing-history-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="billing-history-title" className="text-lg font-semibold text-ink">Billing history</h2>
            <p className="mt-1 text-sm text-muted">Receipts and past subscription charges.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
          {invoices.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">No invoices found.</p>
          ) : (
            <div className="divide-y divide-line">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{invoice.dateLabel}</p>
                    <p className="mt-1 text-xs text-muted">{invoice.id}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{invoice.amountLabel}</p>
                      <p className="mt-1 text-xs text-muted">{invoice.statusLabel}</p>
                    </div>
                    {invoice.href ? <a href={invoice.href} className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-accent hover:text-accent">Receipt</a> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section> : null}
    </div>
  );
}
