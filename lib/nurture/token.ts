import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "scan-nurture-unsubscribe:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getNurtureUnsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.NURTURE_UNSUBSCRIBE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function signature(subscriberId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${TOKEN_CONTEXT}:${subscriberId.toLowerCase()}`)
    .digest("base64url");
}

export function createUnsubscribeToken(subscriberId: string, secret: string): string {
  if (!UUID_PATTERN.test(subscriberId) || secret.length < 32) {
    throw new Error("Invalid unsubscribe token input.");
  }
  return `${subscriberId.toLowerCase()}.${signature(subscriberId, secret)}`;
}

export function readUnsubscribeToken(token: string, secret: string): string | null {
  const [subscriberId, suppliedSignature, extra] = token.split(".");
  if (extra || !subscriberId || !suppliedSignature || !UUID_PATTERN.test(subscriberId)) return null;

  const expected = Buffer.from(signature(subscriberId, secret));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return subscriberId.toLowerCase();
}

export function hasValidUnsubscribeTokenShape(token?: string | null): boolean {
  if (!token) return false;
  const [subscriberId, suppliedSignature, extra] = token.split(".");
  return !extra && UUID_PATTERN.test(subscriberId || "") && /^[A-Za-z0-9_-]{43}$/.test(suppliedSignature || "");
}
