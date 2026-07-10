export const LEAD_MAGNET_CATALOG = {
  "public-sector-revenue-opportunity-playbook-2026": {
    accessPath: "/lead-magnets/public-sector-revenue-opportunity-playbook-2026.pdf",
    title: "The 2026 Public-Sector Revenue Opportunity Playbook",
    shortTitle: "Public-Sector Revenue Playbook",
    category: "Flagship guide",
    description:
      "A source-backed method for finding agencies, funded buyers, recipients, primes, partners, contact paths, and practical next actions.",
    promise:
      "Turn official public records into a qualified opportunity pipeline without treating every record as a bid or grant.",
    includes: [
      "Seven-step opportunity method",
      "Source and status comparison",
      "Qualification scorecard",
      "30-day operating plan"
    ],
    updatedAt: "July 2026"
  },
  "healthcare-dme-public-sector-opportunity-report-2026": {
    accessPath: "/lead-magnets/healthcare-dme-public-sector-opportunity-report-2026.pdf",
    title: "The 2026 Healthcare and DME Public-Sector Opportunity Report",
    shortTitle: "Healthcare and DME Opportunity Report",
    category: "Industry report",
    description:
      "A practical guide to VA procurement, Medicare supplier signals, funded providers, recipients, channel partners, and source-backed next actions.",
    promise:
      "Separate six healthcare opportunity lanes before deciding whether to sell, partner, apply, monitor, or research.",
    includes: [
      "Six-lane healthcare opportunity map",
      "Current 2026 CMS constraint",
      "VA, HRSA, and Medicare source guide",
      "Healthcare 30-day action plan"
    ],
    updatedAt: "July 2026"
  }
} as const;

export type LeadMagnetSlug = keyof typeof LEAD_MAGNET_CATALOG;

export const leadMagnets = Object.entries(LEAD_MAGNET_CATALOG).map(([slug, guide]) => ({
  slug: slug as LeadMagnetSlug,
  ...guide
}));

export function getLeadMagnet(slug: string) {
  return slug in LEAD_MAGNET_CATALOG
    ? { slug: slug as LeadMagnetSlug, ...LEAD_MAGNET_CATALOG[slug as LeadMagnetSlug] }
    : undefined;
}

export type LeadMagnetCaptureInput = {
  leadMagnetSlug: LeadMagnetSlug;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  source: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  marketingConsent: boolean;
  consentedAt: string | null;
};

type LeadMagnetAccessDependencies = {
  saveCapture(input: LeadMagnetCaptureInput): Promise<unknown>;
};

type ValidationError = { ok: false; status: number; code: string; message: string };

type ValidationResult =
  | { ok: true; input: LeadMagnetCaptureInput; accessPath: string }
  | ValidationError;

const MAX_REQUEST_BYTES = 8_192;
const FIELD_LIMITS = {
  slug: 80,
  name: 120,
  email: 254,
  company: 160,
  website: 500,
  source: 100,
  utm: 160
} as const;

const ALLOWED_FIELDS = new Set([
  "slug",
  "name",
  "email",
  "company",
  "website",
  "source",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "marketingConsent"
]);

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().replace(/\s+/g, " ");
}

function requiredText(
  body: Record<string, unknown>,
  field: "slug" | "name" | "email",
  maxLength: number
): string | ValidationError {
  const value = normalizedText(body[field]);
  if (!value) {
    return {
      ok: false,
      status: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `${field === "slug" ? "Lead magnet" : field[0].toUpperCase() + field.slice(1)} is required.`
    };
  }
  if (value.length > maxLength) {
    return {
      ok: false,
      status: 400,
      code: `INVALID_${field.toUpperCase()}`,
      message: `${field === "slug" ? "Lead magnet" : field[0].toUpperCase() + field.slice(1)} is too long.`
    };
  }
  return value;
}

function optionalText(
  body: Record<string, unknown>,
  field: string,
  maxLength: number
): string | null | ValidationError {
  if (!(field in body) || body[field] === null || body[field] === "") return null;
  const value = normalizedText(body[field]);
  if (value === null || !value || value.length > maxLength) {
    return {
      ok: false,
      status: 400,
      code: `INVALID_${field.replace(/([A-Z])/g, "_$1").toUpperCase()}`,
      message: `${field.replace(/([A-Z])/g, " $1").toLowerCase()} is invalid or too long.`
    };
  }
  return value;
}

function aliasedOptionalText(
  body: Record<string, unknown>,
  camelField: string,
  snakeField: string,
  maxLength: number
): string | null | ValidationError {
  const camel = optionalText(body, camelField, maxLength);
  if (typeof camel !== "string" && camel !== null) return camel;
  const snake = optionalText(body, snakeField, maxLength);
  if (typeof snake !== "string" && snake !== null) return snake;
  if (camel && snake && camel !== snake) {
    return {
      ok: false,
      status: 400,
      code: "AMBIGUOUS_UTM_FIELD",
      message: `Send either ${camelField} or ${snakeField}, not conflicting values.`
    };
  }
  return camel || snake;
}

function normalizedWebsite(value: string): string | null {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes(".") || parsed.hostname === "localhost") {
      return null;
    }
    parsed.hash = "";
    parsed.search = "";
    const normalized = parsed.pathname === "/" ? parsed.origin : `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
    return normalized.length <= FIELD_LIMITS.website ? normalized : null;
  } catch {
    return null;
  }
}

function isValidationError(value: string | null | ValidationError): value is ValidationError {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

function validateBody(body: unknown): ValidationResult {
  if (!isObject(body)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_JSON",
      message: "Send a JSON object with slug, name, and email."
    };
  }

  const unsupportedField = Object.keys(body).find((field) => !ALLOWED_FIELDS.has(field));
  if (unsupportedField) {
    return {
      ok: false,
      status: 400,
      code: "UNSUPPORTED_FIELD",
      message: "The request includes an unsupported field."
    };
  }

  const slug = requiredText(body, "slug", FIELD_LIMITS.slug);
  if (typeof slug !== "string") return slug;
  if (!(slug in LEAD_MAGNET_CATALOG)) {
    return {
      ok: false,
      status: 404,
      code: "LEAD_MAGNET_NOT_FOUND",
      message: "That resource is not available."
    };
  }
  const leadMagnetSlug = slug as LeadMagnetSlug;

  const name = requiredText(body, "name", FIELD_LIMITS.name);
  if (typeof name !== "string") return name;

  const emailValue = requiredText(body, "email", FIELD_LIMITS.email);
  if (typeof emailValue !== "string") return emailValue;
  const email = emailValue.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EMAIL",
      message: "Enter a valid email address."
    };
  }

  const company = optionalText(body, "company", FIELD_LIMITS.company);
  if (isValidationError(company)) return company;

  const websiteValue = optionalText(body, "website", FIELD_LIMITS.website);
  if (isValidationError(websiteValue)) return websiteValue;
  const website = websiteValue ? normalizedWebsite(websiteValue) : null;
  if (websiteValue && !website) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_WEBSITE",
      message: "Enter a valid public website."
    };
  }

  const source = optionalText(body, "source", FIELD_LIMITS.source);
  if (isValidationError(source)) return source;
  const utmSource = aliasedOptionalText(body, "utmSource", "utm_source", FIELD_LIMITS.utm);
  if (isValidationError(utmSource)) return utmSource;
  const utmMedium = aliasedOptionalText(body, "utmMedium", "utm_medium", FIELD_LIMITS.utm);
  if (isValidationError(utmMedium)) return utmMedium;
  const utmCampaign = aliasedOptionalText(body, "utmCampaign", "utm_campaign", FIELD_LIMITS.utm);
  if (isValidationError(utmCampaign)) return utmCampaign;
  const utmContent = aliasedOptionalText(body, "utmContent", "utm_content", FIELD_LIMITS.utm);
  if (isValidationError(utmContent)) return utmContent;
  const utmTerm = aliasedOptionalText(body, "utmTerm", "utm_term", FIELD_LIMITS.utm);
  if (isValidationError(utmTerm)) return utmTerm;

  const marketingConsentValue = body.marketingConsent;
  if (marketingConsentValue !== undefined && typeof marketingConsentValue !== "boolean") {
    return {
      ok: false,
      status: 400,
      code: "INVALID_MARKETING_CONSENT",
      message: "Marketing consent must be true or false."
    };
  }
  const marketingConsent = marketingConsentValue === true;

  return {
    ok: true,
    accessPath: LEAD_MAGNET_CATALOG[leadMagnetSlug].accessPath,
    input: {
      leadMagnetSlug,
      name,
      email,
      company,
      website,
      source,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      marketingConsent,
      consentedAt: marketingConsent ? new Date().toISOString() : null
    }
  };
}

export async function handleLeadMagnetAccessRequest(
  request: Request,
  dependencies: LeadMagnetAccessDependencies
): Promise<Response> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > MAX_REQUEST_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Send a valid JSON request.");
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return errorResponse(413, "PAYLOAD_TOO_LARGE", "The request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, "INVALID_JSON", "Send a valid JSON request.");
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return errorResponse(validation.status, validation.code, validation.message);
  }

  try {
    await dependencies.saveCapture(validation.input);
  } catch {
    return errorResponse(
      503,
      "ACCESS_UNAVAILABLE",
      "We could not save your request. Please try again."
    );
  }

  return jsonResponse(
    {
      ok: true,
      leadMagnet: { slug: validation.input.leadMagnetSlug },
      accessPath: validation.accessPath
    },
    201
  );
}
