"use client";

import { FormEvent, useState } from "react";
import type { WorkflowPayload } from "@/lib/workflowPayload";

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
        type="button"
        disabled
        className="rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-500"
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
        className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
      >
        Send to Workflow
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-lg border border-line bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Send to Workflow</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Paste a Zapier, Make, n8n, or custom webhook URL. Opportunity Scanner will send
                  a workflow-ready opportunity payload so you can create a CRM deal, Slack alert,
                  Airtable record, Notion task, or outreach workflow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-line bg-white px-2 py-1 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
            </div>
            <form onSubmit={sendOpportunity} className="mt-5 grid gap-4">
              <div className="rounded-md border border-line bg-field p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Workflow preview</p>
                <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-ink">Target:</span>{" "}
                    {payload.targetAccount || payload.targetOrganization}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Type:</span>{" "}
                    {prettyLabel(payload.opportunityType)}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Contact:</span>{" "}
                    {prettyLabel(payload.contactStrategy) || payload.contactPath}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">Source:</span>{" "}
                    {payload.sourceStatus || payload.source}
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">
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
                  className="rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              {status === "sent" ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Opportunity sent to workflow.
                </p>
              ) : null}
              {status === "error" ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage || "Could not send opportunity. Check the webhook URL and try again."}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] disabled:opacity-70"
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
