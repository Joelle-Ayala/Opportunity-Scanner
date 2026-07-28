import { NextResponse } from "next/server";
import { hasRequestReportAccess } from "@/lib/payments/requestAccess";
import { getScan } from "@/lib/storage";
import { getCompletedReportReadiness } from "@/lib/reportReadiness";
import { buildWorkflowPayload, type WorkflowPayload } from "@/lib/workflowPayload";
import { classifyOpportunityRecord } from "@/lib/opportunityRecordClassification";
import {
  fetchSafeOutboundUrl,
  HTTPS_OUTBOUND_PROTOCOLS,
  parseOutboundUrl
} from "@/lib/url";

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

function hasCurrentOpportunityFraming(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /\b(deadline|closing soon|closes? (?:in|on|by)|close date|due date|urgent|urgency|expires?|live opportunity|open opportunity|current opportunity|apply (?:now|before|by))\b/i.test(
    value
  );
}

function classSafeOutboundPayload(payload: WorkflowPayload): WorkflowPayload {
  if (payload.recordClass !== "evidence") return payload;

  const target = payload.targetAccount || payload.targetOrganization || "the funded recipient";
  const yearText = payload.awardYear ? ` in ${payload.awardYear}` : "";
  const fundingContext = `${target} received public funding${yearText}. This historical record is proof of past buyer budget; verify present needs before outreach.`;
  const presentNeedsStep = `Research ${target} and ask about present needs before proposing a vendor or partnership path.`;

  return {
    ...payload,
    opportunity: `Historical funded-buyer evidence: ${target}${yearText}`,
    signalType: "Funded-buyer evidence",
    opportunityType: "Historical funded-buyer evidence",
    buyerPartnerType: "Award recipient / funded buyer",
    revenueMotion: "Sell to Funded Buyer",
    nextStep: presentNeedsStep,
    nextBestAction: presentNeedsStep,
    manualResearchInstruction: `Verify ${target}'s present needs and identify the responsible program, procurement, or partnership owner.`,
    crmNote: `${fundingContext} Verify present needs before outreach.`,
    outreachAngle: `Reference the historical funded work as context and ask how ${target} is handling the same need now.`,
    followUpTask: `Ask ${target} about present needs and identify the responsible owner.`,
    timeSensitivity: "historical",
    sourceStatus: "Funded-buyer evidence",
    sourceEvidence: fundingContext,
    workflowPayloadReason: "Historical evidence is ready for present-needs research."
  };
}

function isAllowedWebhookUrl(value: string): boolean {
  try {
    parseOutboundUrl(value, HTTPS_OUTBOUND_PROTOCOLS);
    return true;
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

  if (payload.recordClass !== "current" && payload.recordClass !== "evidence") {
    return {
      ok: false,
      status: 422,
      code: "INVALID_RECORD_CLASS",
      message: "Workflow payload must identify the record as current or funded-buyer evidence."
    };
  }

  const canonicalRecord = classifyOpportunityRecord({
    recordClass: payload.recordClass,
    currentValidatedAt: payload.currentValidatedAt,
    sourceName: payload.source,
    sourceType: payload.signalType,
    deadline: payload.sourceDeadline,
    awardYear: payload.awardYear,
    periodEnd: payload.periodEnd
  });

  const dateFieldsMatch =
    canonicalRecord.recordClass === payload.recordClass &&
    (canonicalRecord.currentValidatedAt ?? undefined) === payload.currentValidatedAt &&
    (canonicalRecord.deadline ?? undefined) === payload.sourceDeadline &&
    (canonicalRecord.awardYear ?? undefined) === payload.awardYear &&
    (canonicalRecord.periodEnd ?? undefined) === payload.periodEnd;

  if (!dateFieldsMatch) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_RECORD_FRESHNESS",
      message:
        payload.recordClass === "current"
          ? "Current opportunities require a recently verified future deadline and cannot include historical award fields."
          : "Funded-buyer evidence cannot include a deadline or current-validation timestamp, and its historical fields must be valid."
    };
  }

  if (
    payload.recordClass === "evidence" &&
    (payload.timeSensitivity !== "historical" ||
      payload.sourceStatus !== "Funded-buyer evidence")
  ) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_EVIDENCE_FRAMING",
      message: "Funded-buyer evidence must use historical status and cannot use current-opportunity framing."
    };
  }

  if (
    payload.recordClass === "evidence" &&
    [
      payload.opportunity,
      payload.nextStep,
      payload.nextBestAction,
      payload.crmNote,
      payload.outreachAngle,
      payload.followUpTask,
      payload.sourceEvidence,
      payload.workflowPayloadReason
    ].some(hasCurrentOpportunityFraming)
  ) {
    return {
      ok: false,
      status: 422,
      code: "INVALID_EVIDENCE_MESSAGING",
      message: "Funded-buyer evidence contains deadline or urgency language and cannot be sent."
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
  if (!(await hasRequestReportAccess(request.url, access, scan))) {
    return jsonError(403, "FULL_REPORT_ACCESS_REQUIRED", "Full report access is required to send workflow payloads.");
  }

  const readiness = await getCompletedReportReadiness(scan);
  if (!readiness.ready) {
    return jsonError(readiness.status, readiness.code, readiness.message);
  }

  const signal = readiness.signals.find((item) => item.id === validation.opportunityId);
  if (!signal) {
    return jsonError(404, "OPPORTUNITY_NOT_FOUND", "Opportunity not found for this scan.");
  }

  const builtPayload = buildWorkflowPayload({
    scanId: validation.scanId,
    signal,
    profile: readiness.profile,
    includeSourceUrl: true
  });
  const payload = classSafeOutboundPayload(builtPayload);
  const payloadValidation = validateWorkflowPayload(payload);
  if (payloadValidation) {
    return jsonError(payloadValidation.status, payloadValidation.code, payloadValidation.message);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetchSafeOutboundUrl(
      validation.webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          product: "Opportunity Scanner",
          sent_at: new Date().toISOString(),
          opportunity: payload
        })
      },
      { allowedProtocols: HTTPS_OUTBOUND_PROTOCOLS }
    );

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
