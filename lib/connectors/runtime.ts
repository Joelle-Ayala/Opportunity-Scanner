import type { OpportunitySignal } from "../types";

export type ConnectorHealthStatus =
  | "active"
  | "planned"
  | "needs_api_key"
  | "failing"
  | "disabled";

export type ConnectorRunOutcome = "matches_found" | "no_matches" | "failed" | "skipped";
export type ConnectorErrorCode = "timeout" | "http_error" | "network_error" | "connector_error";

export type ConnectorRunStatus = {
  source_id: string;
  source_name: string;
  status: ConnectorHealthStatus;
  outcome: ConnectorRunOutcome;
  credential_required: boolean;
  credential_configured: boolean;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  query_used: string[];
  query_count: number;
  request_count: number;
  result_count: number;
  actionable_count: number;
  partial_failure_count: number;
  error_code?: ConnectorErrorCode;
  error_message?: string;
  next_test: string;
  notes: string;
};

type ConnectorRequestFailure = {
  code: ConnectorErrorCode;
  message: string;
};

export type ConnectorExecutionContext = {
  signal: AbortSignal;
  request_timeout_ms: number;
  deadline_at_ms?: number;
  now?: () => number;
  diagnostics: ConnectorDiagnostics;
};

export type RunConnectorOptions = {
  sourceId: string;
  sourceName: string;
  enabled: boolean;
  disabled?: boolean;
  credentialRequired?: boolean;
  credentialConfigured?: boolean;
  queryPlan?: string[];
  timeoutMs?: number;
  requestTimeoutMs?: number;
  signal?: AbortSignal;
  deadlineAtMs?: number;
  now?: () => number;
  cleanupGraceMs?: number;
  nextTest: string;
  notes: string;
  execute: (context: ConnectorExecutionContext) => Promise<OpportunitySignal[]>;
};

export type ConnectorRunResult = {
  signals: OpportunitySignal[];
  run: ConnectorRunStatus;
};

export const DEFAULT_CONNECTOR_TIMEOUT_MS = 35_000;
export const DEFAULT_CONNECTOR_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_CONNECTOR_CLEANUP_GRACE_MS = 250;

class ConnectorRequestError extends Error {
  code: ConnectorErrorCode;

  constructor(code: ConnectorErrorCode, message: string) {
    super(message);
    this.name = "ConnectorRequestError";
    this.code = code;
  }
}

export class ConnectorDiagnostics {
  private readonly queries = new Set<string>();
  private readonly failures: ConnectorRequestFailure[] = [];
  private attempts = 0;
  private successes = 0;

  recordAttempt(query?: string): void {
    this.attempts += 1;
    if (query?.trim()) {
      this.queries.add(query.trim());
    }
  }

  recordSuccess(): void {
    this.successes += 1;
  }

  recordFailure(code: ConnectorErrorCode, message: string): void {
    this.failures.push({ code, message: sanitizeConnectorError(message) });
  }

  snapshot() {
    return {
      query_used: Array.from(this.queries),
      request_count: this.attempts,
      successful_request_count: this.successes,
      failures: [...this.failures]
    };
  }
}

export function sanitizeConnectorError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/https?:\/\/[^\s?]+\?[^\s]+/gi, (url) => `${url.split("?")[0]}?[redacted]`)
    .replace(/\b(api[_-]?key|authorization|token|client[_-]?secret)=?[^\s&,]*/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function errorDetails(error: unknown): ConnectorRequestFailure {
  if (error instanceof ConnectorRequestError) {
    return { code: error.code, message: sanitizeConnectorError(error) };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { code: "timeout", message: "Connector request timed out." };
  }
  return { code: "connector_error", message: sanitizeConnectorError(error) || "Connector failed." };
}

function elapsedMs(startedAtMs: number): number {
  return Math.max(0, Date.now() - startedAtMs);
}

function remainingDeadlineMs(deadlineAtMs: number | undefined, now: () => number): number {
  return deadlineAtMs === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, deadlineAtMs - now());
}

function boundedTimeoutMs(configuredTimeoutMs: number, remainingMs: number): number {
  return Math.max(0, Math.min(configuredTimeoutMs, remainingMs));
}

async function waitForExecutionCleanup(
  executionPromise: Promise<OpportunitySignal[]>,
  graceMs: number
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      executionPromise.then(
        () => undefined,
        () => undefined
      ),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, Math.max(0, graceMs));
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function baseRun(
  options: RunConnectorOptions,
  startedAt: string,
  startedAtMs: number,
  overrides: Partial<ConnectorRunStatus>
): ConnectorRunStatus {
  const completedAt = new Date().toISOString();
  return {
    source_id: options.sourceId,
    source_name: options.sourceName,
    status: "planned",
    outcome: "skipped",
    credential_required: options.credentialRequired ?? false,
    credential_configured: options.credentialConfigured ?? !(options.credentialRequired ?? false),
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: elapsedMs(startedAtMs),
    query_used: options.queryPlan ?? [],
    query_count: 0,
    request_count: 0,
    result_count: 0,
    actionable_count: 0,
    partial_failure_count: 0,
    next_test: options.nextTest,
    notes: options.notes,
    ...overrides
  };
}

export async function fetchConnectorJson<T>(
  context: ConnectorExecutionContext,
  sourceName: string,
  input: string | URL,
  init: RequestInit = {},
  queryUsed?: string
): Promise<T> {
  context.diagnostics.recordAttempt(queryUsed);

  const now = context.now ?? Date.now;
  const remainingMs = remainingDeadlineMs(context.deadline_at_ms, now);
  if (context.signal.aborted || remainingMs <= 0) {
    const message = `${sourceName} connector deadline expired.`;
    context.diagnostics.recordFailure("timeout", message);
    throw new ConnectorRequestError("timeout", message);
  }

  const requestTimeoutMs = boundedTimeoutMs(context.request_timeout_ms, remainingMs);
  if (requestTimeoutMs <= 0) {
    const message = `${sourceName} request deadline expired.`;
    context.diagnostics.recordFailure("timeout", message);
    throw new ConnectorRequestError("timeout", message);
  }

  const controller = new AbortController();
  let requestTimedOut = false;
  const abortFromConnector = () => controller.abort();
  if (context.signal.aborted) {
    controller.abort();
  } else {
    context.signal.addEventListener("abort", abortFromConnector, { once: true });
  }

  const abortFromRequest = () => controller.abort();
  if (init.signal?.aborted) {
    controller.abort();
  } else {
    init.signal?.addEventListener("abort", abortFromRequest, { once: true });
  }

  const timeout = setTimeout(() => {
    requestTimedOut = true;
    controller.abort();
  }, requestTimeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new ConnectorRequestError(
        "http_error",
        `${sourceName} request failed with HTTP ${response.status}.`
      );
    }
    const data = (await response.json()) as T;
    context.diagnostics.recordSuccess();
    return data;
  } catch (error) {
    const detail = requestTimedOut
      ? { code: "timeout" as const, message: `${sourceName} request timed out.` }
      : context.signal.aborted
      ? { code: "timeout" as const, message: `${sourceName} connector timed out.` }
      : error instanceof ConnectorRequestError
      ? { code: error.code, message: error.message }
      : { code: "network_error" as const, message: `${sourceName} request failed.` };
    context.diagnostics.recordFailure(detail.code, detail.message);
    throw new ConnectorRequestError(detail.code, detail.message);
  } finally {
    clearTimeout(timeout);
    context.signal.removeEventListener("abort", abortFromConnector);
    init.signal?.removeEventListener("abort", abortFromRequest);
  }
}

export function connectorShouldStop(context: ConnectorExecutionContext): boolean {
  return (
    context.signal.aborted ||
    remainingDeadlineMs(context.deadline_at_ms, context.now ?? Date.now) <= 0
  );
}

export async function runConnector(options: RunConnectorOptions): Promise<ConnectorRunResult> {
  const now = options.now ?? Date.now;
  const startedAtMs = now();
  const startedAt = new Date(startedAtMs).toISOString();

  if (options.disabled) {
    return {
      signals: [],
      run: baseRun(options, startedAt, startedAtMs, {
        status: "disabled",
        outcome: "skipped",
        notes: options.notes || "Connector is deliberately disabled."
      })
    };
  }

  if (!options.enabled) {
    return {
      signals: [],
      run: baseRun(options, startedAt, startedAtMs, {
        status: "planned",
        outcome: "skipped",
        notes: options.notes || "Connector was not activated for this profile."
      })
    };
  }

  if (options.credentialRequired && !options.credentialConfigured) {
    return {
      signals: [],
      run: baseRun(options, startedAt, startedAtMs, {
        status: "needs_api_key",
        outcome: "skipped",
        error_message: `${options.sourceName} credentials are not configured.`
      })
    };
  }

  const diagnostics = new ConnectorDiagnostics();
  const configuredTimeoutMs = options.timeoutMs ?? DEFAULT_CONNECTOR_TIMEOUT_MS;
  const timeoutMs = boundedTimeoutMs(
    configuredTimeoutMs,
    remainingDeadlineMs(options.deadlineAtMs, now)
  );

  if (options.signal?.aborted || timeoutMs <= 0) {
    return {
      signals: [],
      run: baseRun(options, startedAt, startedAtMs, {
        status: "failing",
        outcome: "failed",
        partial_failure_count: 1,
        error_code: "timeout",
        error_message: `${options.sourceName} connector deadline expired before execution.`
      })
    };
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cancellationReason: "parent" | "timeout" | undefined;
  let rejectCancellation: ((error: ConnectorRequestError) => void) | undefined;
  const connectorDeadlineAtMs = Math.min(
    options.deadlineAtMs ?? Number.POSITIVE_INFINITY,
    startedAtMs + timeoutMs
  );
  const context: ConnectorExecutionContext = {
    signal: controller.signal,
    request_timeout_ms: Math.max(
      1,
      Math.min(options.requestTimeoutMs ?? DEFAULT_CONNECTOR_REQUEST_TIMEOUT_MS, timeoutMs)
    ),
    deadline_at_ms: connectorDeadlineAtMs,
    now,
    diagnostics
  };

  const cancelConnector = (reason: "parent" | "timeout") => {
    if (cancellationReason) return;
    cancellationReason = reason;
    rejectCancellation?.(
      new ConnectorRequestError("timeout", `${options.sourceName} connector timed out.`)
    );
    controller.abort();
  };
  const cancellationPromise = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
    timeoutId = setTimeout(() => {
      cancelConnector("timeout");
    }, timeoutMs);
  });
  const abortFromParent = () => cancelConnector("parent");
  options.signal?.addEventListener("abort", abortFromParent, { once: true });
  if (options.signal?.aborted) {
    cancelConnector("parent");
  }
  const executionPromise = cancellationReason
    ? Promise.resolve([] as OpportunitySignal[])
    : options.execute(context);

  try {
    const signals = await Promise.race([executionPromise, cancellationPromise]);
    const snapshot = diagnostics.snapshot();
    const allRequestsFailed = snapshot.request_count > 0 && snapshot.successful_request_count === 0;
    const lastFailure = snapshot.failures.at(-1);

    if (allRequestsFailed) {
      return {
        signals: [],
        run: baseRun(options, startedAt, startedAtMs, {
          status: "failing",
          outcome: "failed",
          query_used: snapshot.query_used,
          query_count: snapshot.query_used.length,
          request_count: snapshot.request_count,
          partial_failure_count: snapshot.failures.length,
          error_code: lastFailure?.code,
          error_message: lastFailure?.message || `${options.sourceName} did not complete a request.`
        })
      };
    }

    return {
      signals,
      run: baseRun(options, startedAt, startedAtMs, {
        status: "active",
        outcome: signals.length > 0 ? "matches_found" : "no_matches",
        query_used: snapshot.query_used,
        query_count: snapshot.query_used.length,
        request_count: snapshot.request_count,
        result_count: signals.length,
        actionable_count: signals.filter((signal) => signal.actionability === "yes").length,
        partial_failure_count: snapshot.failures.length,
        error_code: lastFailure?.code,
        error_message: lastFailure?.message,
        notes:
          snapshot.failures.length > 0
            ? `${options.notes} ${snapshot.failures.length} request(s) failed, but the connector completed with usable source responses.`.trim()
            : options.notes
      })
    };
  } catch (error) {
    if (cancellationReason) {
      await waitForExecutionCleanup(
        executionPromise,
        options.cleanupGraceMs ?? DEFAULT_CONNECTOR_CLEANUP_GRACE_MS
      );
    }
    const detail = cancellationReason
      ? { code: "timeout" as const, message: `${options.sourceName} connector timed out.` }
      : errorDetails(error);
    const snapshot = diagnostics.snapshot();
    return {
      signals: [],
      run: baseRun(options, startedAt, startedAtMs, {
        status: "failing",
        outcome: "failed",
        query_used: snapshot.query_used,
        query_count: snapshot.query_used.length,
        request_count: snapshot.request_count,
        partial_failure_count: Math.max(1, snapshot.failures.length),
        error_code: detail.code,
        error_message: detail.message
      })
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    options.signal?.removeEventListener("abort", abortFromParent);
  }
}

export function failedConnectorRun(
  options: RunConnectorOptions,
  error: unknown
): ConnectorRunResult {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const detail = errorDetails(error);
  return {
    signals: [],
    run: baseRun(options, startedAt, startedAtMs, {
      status: "failing",
      outcome: "failed",
      partial_failure_count: 1,
      error_code: detail.code,
      error_message: detail.message
    })
  };
}
