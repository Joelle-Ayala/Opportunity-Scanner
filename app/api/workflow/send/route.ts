import { NextResponse } from "next/server";
import { hasFullReportAccess } from "@/lib/access";
import { getCompanyProfile, getScan, getStoredOpportunitySignal } from "@/lib/storage";
import { ensureProfileRefinementFields } from "@/lib/profileRefinement";
import { buildWorkflowPayload, type WorkflowPayload } from "@/lib/workflowPayload";

export const runtime = "nodejs";

const MAX_WEBHOOK_PAYLOAD_BYTES = 25_000;
const WEBHOOK_TIMEOUT_MS = 8_000;

type ValidationResult =
  | { ok: true; webhookUrl: string; scanId: string; opportunityId: string }
  | { ok: false; status: number; code: string; message: string };
type ValidationError = Extract<ValidationResult, { ok: false }>;

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(payload: unknown, key: string): string {
  const value = isObject(payload) ? payload[key] : undefined;
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function validateRequestBody(body: unknown): ValidationResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      message: "Send a JSON body with webhookUrl, scanId, and opportunityId."
    };
  }

  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  if (!webhookUrl) {
    return { ok: false, status: 400, code: "MISSING_WEBHOOK_URL", message: "Webhook URL is required." };
  }

  if (!isAllowedWebhookUrl(webhookUrl)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_WEBHOOK_URL",
      message: "Webhook URL must be HTTPS and cannot include embedded credentials."
    };
  }

  const scanId = stringValue(body, "scanId");
  const opportunityId = stringValue(body, "opportunityId");

  if (!scanId || !opportunityId) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_WORKFLOW_TARGET",
      message: "Scan ID and opportunity ID are required."
    };
  }

  return { ok: true, webhookUrl, scanId, opportunityId };
}

function validateWorkflowPayload(payload: WorkflowPayload): ValidationError | null {
  const requiredTextFields = [
    "scanId",
    "opportunityId",
    "opportunity",
    "source",
    "revenueMotion",
    "contactStrategy",
    "nextBestAction",
    "crmNote",
    "sourceEvidence",
    "workflowPayloadReason"
  ];
  const missingFields = requiredTextFields.filter((field) => !stringValue(payload, field));

  if (!stringValue(payload, "targetAccount") && !stringValue(payload, "targetOrganization")) {
    missingFields.push("targetAccount");
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      status: 422,
      code: "PAYLOAD_NOT_WORKFLOW_READY",
      message: `Workflow payload is missing required field(s): ${missingFields.join(", ")}.`
    };
  }

  if (payload.workflowPayloadReady !== true) {
    return {
      ok: false,
      status: 422,
      code: "OPPORTUNITY_NOT_WORKFLOW_READY",
      message:
        typeof payload.workflowPayloadReason === "string" && payload.workflowPayloadReason.trim()
          ? payload.workflowPayloadReason
          : "This opportunity needs research before it can be sent to workflow."
    };
  }

  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (payloadBytes > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Workflow payload is too large for beta webhook delivery."
    };
  }

  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateRequestBody(body);

  if (!validation.ok) {
    return jsonError(validation.status, validation.code, validation.message);
  }

  const access = isObject(body) && typeof body.access === "string" ? body.access.trim() : undefined;
  const scan = await getScan(validation.scanId);
  if (!scan) {
    return jsonError(404, "SCAN_NOT_FOUND", "Scan not found.");
  }
  if (!hasFullReportAccess(access, scan)) {
    return jsonError(403, "FULL_REPORT_ACCESS_REQUIRED", "Full report access is required to send workflow payloads.");
  }

  const signal = await getStoredOpportunitySignal(validation.scanId, validation.opportunityId);
  if (!signal) {
    return jsonError(404, "OPPORTUNITY_NOT_FOUND", "Opportunity not found for this scan.");
  }

  const profileRecord = await getCompanyProfile(validation.scanId);
  const profile = profileRecord ? ensureProfileRefinementFields(profileRecord.profile_json) : undefined;
  const payload = buildWorkflowPayload({
    scanId: validation.scanId,
    signal,
    profile,
    includeSourceUrl: true
  });
  const payloadValidation = validateWorkflowPayload(payload);
  if (payloadValidation) {
    return jsonError(payloadValidation.status, payloadValidation.code, payloadValidation.message);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(validation.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        product: "Opportunity Scanner",
        sent_at: new Date().toISOString(),
        opportunity: payload
      })
    });

    if (!response.ok) {
      return jsonError(
        502,
        "WEBHOOK_DELIVERY_FAILED",
        `Webhook delivery failed with destination status ${response.status}.`
      );
    }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return jsonError(
      timedOut ? 504 : 502,
      timedOut ? "WEBHOOK_TIMEOUT" : "WEBHOOK_DELIVERY_FAILED",
      timedOut ? "Webhook delivery timed out." : "Webhook delivery failed before the destination accepted it."
    );
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({ ok: true, message: "Opportunity sent to workflow." });
}
