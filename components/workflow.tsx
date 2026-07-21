"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import type { WorkflowPayload } from "@/lib/workflowPayload";
import { trackProductEvent } from "@/lib/productAnalytics";

function prettyLabel(value?: string): string {
  return value ? value.replaceAll("_", " ") : "Needs review";
}

export function SendToWorkflowModal({
  payload,
  locked = false,
  access
}: {
  payload: WorkflowPayload;
  locked?: boolean;
  access?: string;
}) {
  const [open, setOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href], textarea, select"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  async function sendOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage("");
    const response = await fetch("/api/workflow/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookUrl,
        scanId: payload.scanId,
        opportunityId: payload.opportunityId,
        access
      })
    });
    if (response.ok) {
      setStatus("sent");
      trackProductEvent("report_value_action_selected", {
        action: "send_to_workflow",
        report_tier: "full"
      });
      return;
    }

    const result = await response.json().catch(() => null);
    setErrorMessage(
      typeof result?.error?.message === "string"
        ? result.error.message
        : "Could not send opportunity. Check the webhook URL and try again."
    );
    setStatus("error");
  }

  if (locked) {
    return (
      <button
        ref={triggerRef}
        type="button"
        disabled
        className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500"
        title="Unlock Full Scan to send opportunities to Zapier, Make, n8n, HubSpot workflows, Airtable, or your CRM."
      >
        Send to Workflow
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Send to Workflow
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid items-start overflow-y-auto bg-slate-950/40 p-4 sm:place-items-center">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-xl outline-none sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-ink">Send to Workflow</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Paste a Zapier, Make, n8n, or custom webhook URL. Opportunity Scanner will send
                  a workflow-ready opportunity payload so you can create a CRM deal, Slack alert,
                  Airtable record, Notion task, or outreach workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <form onSubmit={sendOpportunity} className="mt-5 grid gap-4">
              <div className="rounded-md border border-line bg-field p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Workflow preview</p>
                <div className="mt-3 grid min-w-0 gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-ink">Target:</span>{" "}
                    {payload.targetAccount || payload.targetOrganization}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-ink">Type:</span>{" "}
                    {prettyLabel(payload.opportunityType)}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-ink">Contact:</span>{" "}
                    {prettyLabel(payload.contactStrategy) || payload.contactPath}
                  </p>
                  <p className="min-w-0 break-words">
                    <span className="font-semibold text-ink">Source:</span>{" "}
                    {payload.sourceStatus || payload.source}
                  </p>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-ink">Next action:</span>{" "}
                  {payload.nextBestAction || payload.nextStep}
                </p>
                {payload.workflowPayloadReason ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500">{payload.workflowPayloadReason}</p>
                ) : null}
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-ink">Webhook URL</span>
                <input
                  required
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://hooks.zapier.com/..."
                  className="min-w-0 rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              {status === "sent" ? (
                <p aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Opportunity sent to workflow.
                </p>
              ) : null}
              {status === "error" ? (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage || "Could not send opportunity. Check the webhook URL and try again."}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 w-full rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="min-h-11 w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] disabled:opacity-70 sm:w-auto"
                >
                  {status === "sending" ? "Sending..." : "Send Opportunity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
