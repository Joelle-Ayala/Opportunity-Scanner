export const FIRST_TOUCH_COOKIE_NAME = "os_first_touch";
export const FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
export const FIRST_TOUCH_COOKIE_MAX_BYTES = 3_072;

const UTM_MAX_BYTES = 160;
const LANDING_PATH_MAX_BYTES = 512;
const REFERRER_HOST_MAX_BYTES = 253;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FirstTouchAttribution = {
  firstTouchId: string;
  firstTouchedAt: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  landingPath: string;
  referrerHost?: string;
};

type FirstTouchValues = {
  firstTouchId: unknown;
  firstTouchedAt: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  landingPath: unknown;
  referrerHost?: unknown;
};

export type ScanAttributionStorageFields = {
  first_touch_id: string | null;
  first_touch_at: string | null;
  first_touch_landing_path: string | null;
  first_touch_referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

type SerializedFirstTouch = {
  v: 1;
  i: string;
  a: string;
  us?: string;
  um?: string;
  uc?: string;
  uo?: string;
  ut?: string;
  p: string;
  rh?: string;
};

const SERIALIZED_KEYS = new Set(["v", "i", "a", "us", "um", "uc", "uo", "ut", "p", "rh"]);

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function normalizedText(value: unknown, maxBytes: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || CONTROL_CHARACTERS.test(normalized) || byteLength(normalized) > maxBytes) {
    return undefined;
  }
  return normalized;
}

function validIsoTimestamp(value: unknown, nowMs: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestampMs = Date.parse(value);
  if (!Number.isFinite(timestampMs) || new Date(timestampMs).toISOString() !== value) return undefined;
  if (timestampMs > nowMs + CLOCK_SKEW_MS) return undefined;
  if (timestampMs < nowMs - FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS * 1_000) return undefined;
  return value;
}

function normalizedLandingPath(value: unknown): string | undefined {
  const path = normalizedText(value, LANDING_PATH_MAX_BYTES);
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[?#]/.test(path)) return undefined;
  return path;
}

function normalizedReferrerHost(value: unknown): string | undefined {
  const host = normalizedText(value, REFERRER_HOST_MAX_BYTES)?.toLowerCase();
  if (!host || /[\s/@?#]/.test(host)) return undefined;

  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname.toLowerCase() === host ? host : undefined;
  } catch {
    return undefined;
  }
}

export function validateFirstTouchAttribution(
  values: FirstTouchValues,
  nowMs: number
): FirstTouchAttribution | null {
  const firstTouchId = typeof values.firstTouchId === "string" && UUID_V4.test(values.firstTouchId)
    ? values.firstTouchId.toLowerCase()
    : undefined;
  const firstTouchedAt = validIsoTimestamp(values.firstTouchedAt, nowMs);
  const landingPath = normalizedLandingPath(values.landingPath);
  if (!firstTouchId || !firstTouchedAt || !landingPath) return null;

  const attribution: FirstTouchAttribution = {
    firstTouchId,
    firstTouchedAt,
    landingPath
  };
  const optionalFields = {
    utmSource: normalizedText(values.utmSource, UTM_MAX_BYTES),
    utmMedium: normalizedText(values.utmMedium, UTM_MAX_BYTES),
    utmCampaign: normalizedText(values.utmCampaign, UTM_MAX_BYTES),
    utmContent: normalizedText(values.utmContent, UTM_MAX_BYTES),
    utmTerm: normalizedText(values.utmTerm, UTM_MAX_BYTES),
    referrerHost: normalizedReferrerHost(values.referrerHost)
  };

  for (const [key, value] of Object.entries(optionalFields)) {
    if (value) Object.assign(attribution, { [key]: value });
  }
  return attribution;
}

export function firstTouchAttributionFromUrl(input: {
  firstTouchId: string;
  firstTouchedAt: string;
  landingUrl: string;
  referrerUrl?: string;
  nowMs: number;
}): FirstTouchAttribution | null {
  let landing: URL;
  try {
    landing = new URL(input.landingUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(landing.protocol)) return null;

  let referrerHost: string | undefined;
  if (input.referrerUrl) {
    try {
      const referrer = new URL(input.referrerUrl);
      referrerHost = ['http:', 'https:'].includes(referrer.protocol) ? referrer.hostname : undefined;
    } catch {
      referrerHost = undefined;
    }
  }

  return validateFirstTouchAttribution(
    {
      firstTouchId: input.firstTouchId,
      firstTouchedAt: input.firstTouchedAt,
      landingPath: landing.pathname || "/",
      referrerHost,
      utmSource: landing.searchParams.get("utm_source"),
      utmMedium: landing.searchParams.get("utm_medium"),
      utmCampaign: landing.searchParams.get("utm_campaign"),
      utmContent: landing.searchParams.get("utm_content"),
      utmTerm: landing.searchParams.get("utm_term")
    },
    input.nowMs
  );
}

export function landingPathFromUrl(value: string | null): string {
  if (!value) return "/";
  try {
    return normalizedLandingPath(new URL(value).pathname) ?? "/";
  } catch {
    return "/";
  }
}

export function serializeFirstTouchAttribution(
  attribution: FirstTouchAttribution,
  nowMs: number
): string | null {
  const valid = validateFirstTouchAttribution(attribution, nowMs);
  if (!valid) return null;

  const serialized: SerializedFirstTouch = {
    v: 1,
    i: valid.firstTouchId,
    a: valid.firstTouchedAt,
    p: valid.landingPath
  };
  if (valid.utmSource) serialized.us = valid.utmSource;
  if (valid.utmMedium) serialized.um = valid.utmMedium;
  if (valid.utmCampaign) serialized.uc = valid.utmCampaign;
  if (valid.utmContent) serialized.uo = valid.utmContent;
  if (valid.utmTerm) serialized.ut = valid.utmTerm;
  if (valid.referrerHost) serialized.rh = valid.referrerHost;

  const encoded = encodeURIComponent(JSON.stringify(serialized));
  return byteLength(encoded) <= FIRST_TOUCH_COOKIE_MAX_BYTES ? encoded : null;
}

export function parseFirstTouchCookie(value: string | undefined, nowMs: number): FirstTouchAttribution | null {
  if (!value || byteLength(value) > FIRST_TOUCH_COOKIE_MAX_BYTES) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (record.v !== 1 || Object.keys(record).some((key) => !SERIALIZED_KEYS.has(key))) return null;
    for (const [value, maxBytes] of [
      [record.us, UTM_MAX_BYTES],
      [record.um, UTM_MAX_BYTES],
      [record.uc, UTM_MAX_BYTES],
      [record.uo, UTM_MAX_BYTES],
      [record.ut, UTM_MAX_BYTES]
    ] as const) {
      if (value !== undefined && normalizedText(value, maxBytes) !== value) return null;
    }
    if (record.rh !== undefined && normalizedReferrerHost(record.rh) !== record.rh) return null;
    if (normalizedLandingPath(record.p) !== record.p) return null;

    return validateFirstTouchAttribution(
      {
        firstTouchId: record.i,
        firstTouchedAt: record.a,
        utmSource: record.us,
        utmMedium: record.um,
        utmCampaign: record.uc,
        utmContent: record.uo,
        utmTerm: record.ut,
        landingPath: record.p,
        referrerHost: record.rh
      },
      nowMs
    );
  } catch {
    return null;
  }
}

export function resolveFirstTouchAttribution(input: {
  cookieValue?: string;
  fallback: FirstTouchValues;
  nowMs: number;
}): FirstTouchAttribution | null {
  return (
    parseFirstTouchCookie(input.cookieValue, input.nowMs) ??
    validateFirstTouchAttribution(input.fallback, input.nowMs)
  );
}

export function firstTouchCookieAssignment(value: string, secure: boolean): string {
  const secureAttribute = secure ? "; Secure" : "";
  return `${FIRST_TOUCH_COOKIE_NAME}=${value}; Path=/; Max-Age=${FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureAttribute}`;
}

export function scanAttributionStorageFields(
  attribution?: FirstTouchAttribution,
  legacyUtms?: Pick<
    FirstTouchAttribution,
    "utmSource" | "utmMedium" | "utmCampaign" | "utmContent" | "utmTerm"
  >
): ScanAttributionStorageFields {
  return {
    first_touch_id: attribution?.firstTouchId ?? null,
    first_touch_at: attribution?.firstTouchedAt ?? null,
    first_touch_landing_path: attribution?.landingPath ?? null,
    first_touch_referrer_host: attribution?.referrerHost ?? null,
    utm_source: attribution?.utmSource ?? legacyUtms?.utmSource ?? null,
    utm_medium: attribution?.utmMedium ?? legacyUtms?.utmMedium ?? null,
    utm_campaign: attribution?.utmCampaign ?? legacyUtms?.utmCampaign ?? null,
    utm_content: attribution?.utmContent ?? legacyUtms?.utmContent ?? null,
    utm_term: attribution?.utmTerm ?? legacyUtms?.utmTerm ?? null
  };
}
