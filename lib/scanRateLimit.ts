import { createHmac } from "crypto";
import { isIP } from "net";

type ScanRateLimitConfig = {
  ipLimit: number;
  ipWindowSeconds: number;
  emailLimit: number;
  emailWindowSeconds: number;
};

type ClaimResponse = {
  allowed: boolean;
  retry_after_seconds: number;
};

export type ScanRateLimitResult = {
  allowed: boolean;
  reason: "allowed" | "limited" | "unavailable" | "development_bypass";
  retryAfterSeconds: number;
};

const DEFAULT_CONFIG: ScanRateLimitConfig = {
  ipLimit: 5,
  ipWindowSeconds: 3600,
  emailLimit: 3,
  emailWindowSeconds: 3600
};

const MAX_LIMIT = 10000;
const MAX_WINDOW_SECONDS = 86400;
const DEVELOPMENT_HASH_SECRET = "opportunity-scanner-local-development-rate-limit";

function configuredInteger(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

export function getScanRateLimitConfig(): ScanRateLimitConfig {
  return {
    ipLimit: configuredInteger("SCAN_RATE_LIMIT_IP_MAX", DEFAULT_CONFIG.ipLimit, MAX_LIMIT),
    ipWindowSeconds: configuredInteger(
      "SCAN_RATE_LIMIT_IP_WINDOW_SECONDS",
      DEFAULT_CONFIG.ipWindowSeconds,
      MAX_WINDOW_SECONDS
    ),
    emailLimit: configuredInteger("SCAN_RATE_LIMIT_EMAIL_MAX", DEFAULT_CONFIG.emailLimit, MAX_LIMIT),
    emailWindowSeconds: configuredInteger(
      "SCAN_RATE_LIMIT_EMAIL_WINDOW_SECONDS",
      DEFAULT_CONFIG.emailWindowSeconds,
      MAX_WINDOW_SECONDS
    )
  };
}

export function normalizeRateLimitEmail(email?: string): string | null {
  const normalized = email?.trim().normalize("NFKC").toLowerCase();
  return normalized || null;
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim();
  if (!candidate || candidate.toLowerCase() === "unknown") return null;

  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    if (closingBracket > 0) candidate = candidate.slice(1, closingBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }

  const zoneIndex = candidate.indexOf("%");
  if (zoneIndex > 0) candidate = candidate.slice(0, zoneIndex);
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

export function clientIpFromRequest(request: Request): string | null {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip");
  if (!forwarded) return null;
  return normalizeIpCandidate(forwarded.split(",", 1)[0]);
}

export function hashRateLimitIdentity(
  kind: "ip" | "email",
  normalizedValue: string,
  secret: string
): string {
  return createHmac("sha256", secret).update(`${kind}:${normalizedValue}`).digest("hex");
}

function unavailableResult(): ScanRateLimitResult {
  if (process.env.NODE_ENV === "development") {
    return { allowed: true, reason: "development_bypass", retryAfterSeconds: 0 };
  }
  return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
}

function productionSecret(): string | null {
  const configured = process.env.SCAN_RATE_LIMIT_HASH_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "development") return DEVELOPMENT_HASH_SECRET;
  return null;
}

export async function claimScanRateLimit(request: Request, email?: string): Promise<ScanRateLimitResult> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const secret = productionSecret();
    if (!supabaseUrl || !serviceRoleKey || !secret) return unavailableResult();

    const ip = clientIpFromRequest(request);
    const normalizedEmail = normalizeRateLimitEmail(email);
    if (!ip && !normalizedEmail) return unavailableResult();

    const config = getScanRateLimitConfig();
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_scan_rate_limits`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_ip_hash: ip ? hashRateLimitIdentity("ip", ip, secret) : null,
        p_email_hash: normalizedEmail
          ? hashRateLimitIdentity("email", normalizedEmail, secret)
          : null,
        p_ip_limit: config.ipLimit,
        p_ip_window_seconds: config.ipWindowSeconds,
        p_email_limit: config.emailLimit,
        p_email_window_seconds: config.emailWindowSeconds
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return unavailableResult();
    const claim = (await response.json()) as Partial<ClaimResponse>;
    if (typeof claim.allowed !== "boolean" || !Number.isFinite(claim.retry_after_seconds)) {
      return unavailableResult();
    }

    const retryAfterSeconds = Math.max(0, Math.ceil(Number(claim.retry_after_seconds)));
    return claim.allowed
      ? { allowed: true, reason: "allowed", retryAfterSeconds: 0 }
      : { allowed: false, reason: "limited", retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  } catch {
    return unavailableResult();
  }
}
