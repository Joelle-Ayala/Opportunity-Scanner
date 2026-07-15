import { timingSafeEqual } from "node:crypto";
import { getNurtureEmailConfig, sendNurtureEmail } from "@/lib/nurture/delivery";
import {
  claimDueNurtureJobs,
  completeNurtureJob,
  releaseNurtureJob
} from "@/lib/nurture/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NurtureCronSummary = {
  ok: boolean;
  outcome: "completed" | "configuration_error" | "storage_error" | "delivery_failed";
  claimed: number;
  delivered: number;
  failed: number;
  retried: number;
  deadLettered: number;
  finalizationFailed: number;
  releaseFailed: number;
  durationMs: number;
};

function respondWithSummary(summary: NurtureCronSummary, status: number): Response {
  const log = { event: "cron.nurture.summary", httpStatus: status, ...summary };
  if (summary.ok) console.info(log);
  else console.error(log);
  return Response.json(summary, { status });
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();
  const config = getNurtureEmailConfig();
  if (!config) {
    return respondWithSummary({
      ok: false,
      outcome: "configuration_error",
      claimed: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0,
      finalizationFailed: 0,
      releaseFailed: 0,
      durationMs: Date.now() - startedAt
    }, 503);
  }

  let jobs;
  try {
    jobs = await claimDueNurtureJobs(10);
  } catch (cause) {
    console.error("Unable to claim due nurture jobs", {
      error: cause instanceof Error ? cause.message : "Unknown nurture storage error"
    });
    return respondWithSummary({
      ok: false,
      outcome: "storage_error",
      claimed: 0,
      delivered: 0,
      failed: 0,
      retried: 0,
      deadLettered: 0,
      finalizationFailed: 0,
      releaseFailed: 0,
      durationMs: Date.now() - startedAt
    }, 503);
  }

  let delivered = 0;
  let failed = 0;
  let retried = 0;
  let deadLettered = 0;
  let finalizationFailed = 0;
  let releaseFailed = 0;

  for (const job of jobs) {
    let providerMessageId: string;
    try {
      providerMessageId = await sendNurtureEmail(config, job);
    } catch (cause) {
      failed += 1;
      console.error("Nurture email delivery failed", {
        jobId: job.job_id,
        touchNumber: job.touch_number,
        attemptCount: job.attempt_count,
        error: cause instanceof Error ? cause.message : "Unknown nurture delivery error"
      });
      const status = await releaseNurtureJob(job.job_id, cause).catch(() => null);
      if (status === "dead_letter") deadLettered += 1;
      else if (status === "pending") retried += 1;
      else releaseFailed += 1;
      continue;
    }

    delivered += 1;
    try {
      const completed = await completeNurtureJob(job.job_id, providerMessageId);
      if (!completed) {
        failed += 1;
        finalizationFailed += 1;
        console.error("Nurture delivery could not be finalized", {
          jobId: job.job_id,
          providerMessageId
        });
      }
    } catch (cause) {
      failed += 1;
      finalizationFailed += 1;
      console.error("Nurture delivery finalization failed", {
        jobId: job.job_id,
        providerMessageId,
        error: cause instanceof Error ? cause.message : "Unknown nurture storage error"
      });
      const status = await releaseNurtureJob(job.job_id, cause).catch(() => null);
      if (status === "dead_letter") deadLettered += 1;
      else if (status === "pending") retried += 1;
      else releaseFailed += 1;
    }
  }

  const storageFailed = finalizationFailed > 0 || releaseFailed > 0;
  const ok = failed === 0 && deadLettered === 0 && releaseFailed === 0;
  const status = ok ? 200 : storageFailed ? 503 : 502;
  return respondWithSummary({
    ok,
    outcome: ok ? "completed" : storageFailed ? "storage_error" : "delivery_failed",
    claimed: jobs.length,
    delivered,
    failed,
    retried,
    deadLettered,
    finalizationFailed,
    releaseFailed,
    durationMs: Date.now() - startedAt
  }, status);
}
