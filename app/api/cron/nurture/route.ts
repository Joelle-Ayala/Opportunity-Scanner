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

  const config = getNurtureEmailConfig();
  if (!config) {
    return Response.json({ ok: false, error: "Nurture email is not configured." }, { status: 503 });
  }

  let jobs;
  try {
    jobs = await claimDueNurtureJobs(10);
  } catch {
    return Response.json({ ok: false, error: "Nurture storage is unavailable." }, { status: 503 });
  }

  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const job of jobs) {
    try {
      const providerMessageId = await sendNurtureEmail(config, job);
      await completeNurtureJob(job.job_id, providerMessageId);
      delivered += 1;
    } catch (cause) {
      const status = await releaseNurtureJob(job.job_id, cause).catch(() => null);
      if (status === "dead_letter") deadLettered += 1;
      else retried += 1;
    }
  }

  return Response.json({
    ok: true,
    claimed: jobs.length,
    delivered,
    retried,
    deadLettered
  });
}
