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
  subscriptionStatus: "active" | "trialing" | "canceling" | "past_due" | "incomplete" | "canceled" | "none";
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
  const status = {
    active: {
      label: "Active",
      tone: "success" as const,
      description: renewalLabel || "Recurring monitoring is enabled."
    },
    trialing: {
      label: "Trial",
      tone: "success" as const,
      description: renewalLabel || "Recurring monitoring is enabled during your trial."
    },
    canceling: {
      label: "Cancels at period end",
      tone: "warning" as const,
      description: renewalLabel || "Monitoring remains available until the current billing period ends."
    },
    past_due: {
      label: "Past due",
      tone: "danger" as const,
      description: "Monitoring is paused until the payment issue is resolved."
    },
    incomplete: {
      label: "Activation pending",
      tone: "warning" as const,
      description: "Complete billing setup before monitoring can begin."
    },
    canceled: {
      label: "Canceled",
      tone: "neutral" as const,
      description: "This subscription is canceled and monitoring is not active."
    },
    none: {
      label: "No subscription",
      tone: "neutral" as const,
      description: "No recurring monitoring plan is active."
    }
  }[subscriptionStatus];
  const hasPlanRecord = subscriptionStatus !== "none";
  const hasPaymentMethodData = Boolean(paymentMethodLabel || paymentMethodDetail);
  const showBillingAttention = ["past_due", "incomplete", "canceling"].includes(subscriptionStatus);
  const attention = subscriptionStatus === "past_due"
    ? {
        title: "Payment needs attention",
        description: "Update your payment method to restore monitoring and keep new opportunity alerts running.",
        className: "border-red-200 bg-red-50 text-red-950"
      }
    : subscriptionStatus === "incomplete"
      ? {
          title: "Finish activating your subscription",
          description: "Complete billing setup before recurring monitoring can begin.",
          className: "border-amber-200 bg-amber-50 text-amber-950"
        }
      : subscriptionStatus === "canceling"
        ? {
            title: renewalLabel || "Your monitoring access is scheduled to end",
            description: "Your reports remain available, and monitoring continues until that date. You can review the cancellation in billing before access ends.",
            className: "border-amber-200 bg-amber-50 text-amber-950"
          }
        : null;

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="billing-plan-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase text-muted">Subscription</p>
              <DashboardStatusBadge tone={status.tone}>{status.label}</DashboardStatusBadge>
            </div>
            <h2 id="billing-plan-title" className="mt-2 text-xl font-semibold text-ink">{planName}</h2>
            <p className="mt-1 text-sm text-muted">{status.description}</p>
          </div>
          {hasPlanRecord && planIntervalLabel ? <p className="text-sm font-semibold capitalize text-steel">{planIntervalLabel} billing</p> : null}
        </div>
        {showBillingAttention && attention ? (
          <div className={`m-4 flex flex-wrap items-center justify-between gap-4 rounded-md border px-4 py-4 ${attention.className}`}>
            <div>
              <p className="text-sm font-semibold">{attention.title}</p>
              <p className="mt-1 max-w-2xl text-sm leading-6">{attention.description}</p>
            </div>
            {manageAction}
          </div>
        ) : null}
        {hasPaymentMethodData || manageAction || upgradeAction ? <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          {hasPaymentMethodData ? <div>
            <p className="text-sm font-semibold text-ink">Payment method</p>
            <p className="mt-1 text-sm text-muted">{[paymentMethodLabel, paymentMethodDetail].filter(Boolean).join(" / ")}</p>
          </div> : <div />}
          <div className="flex flex-wrap gap-2">{showBillingAttention ? null : manageAction}{upgradeAction}</div>
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
