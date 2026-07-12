import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "opportunity-alert-unsubscribe:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getAlertUnsubscribeSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const secret = env.ALERT_UNSUBSCRIBE_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function signature(accountId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${TOKEN_CONTEXT}:${accountId.toLowerCase()}`)
    .digest("base64url");
}

export function createAlertUnsubscribeToken(accountId: string, secret: string): string {
  if (!UUID_PATTERN.test(accountId) || secret.length < 32) {
    throw new Error("Invalid alert unsubscribe token input.");
  }
  return `${accountId.toLowerCase()}.${signature(accountId, secret)}`;
}

export function readAlertUnsubscribeToken(token: string, secret: string): string | null {
  const [accountId, suppliedSignature, extra] = token.split(".");
  if (extra || !accountId || !suppliedSignature || !UUID_PATTERN.test(accountId)) return null;

  const expected = Buffer.from(signature(accountId, secret));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return accountId.toLowerCase();
}

export function hasValidAlertUnsubscribeTokenShape(token?: string | null): boolean {
  if (!token) return false;
  const [accountId, suppliedSignature, extra] = token.split(".");
  return !extra && UUID_PATTERN.test(accountId || "") && /^[A-Za-z0-9_-]{43}$/.test(suppliedSignature || "");
}

