import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right) || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS
): boolean {
  if (!header || !secret || toleranceSeconds < 0) return false;
  const parts = header.split(",").map((part) => part.trim().split("=", 2));
  const timestampText = parts.find(([key]) => key === "t")?.[1] ?? "";
  const timestamp = Number(timestampText);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!Number.isInteger(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");
  return signatures.some((signature) => safeEqualHex(signature, expected));
}
