"use client";

import { useEffect } from "react";
import {
  FIRST_TOUCH_COOKIE_NAME,
  firstTouchAttributionFromUrl,
  firstTouchCookieAssignment,
  parseFirstTouchCookie,
  serializeFirstTouchAttribution
} from "@/lib/acquisitionAttribution";

function cookieValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function FirstTouchAttributionCapture() {
  useEffect(() => {
    const now = new Date();
    const existing = cookieValue(FIRST_TOUCH_COOKIE_NAME);
    if (parseFirstTouchCookie(existing, now.getTime())) return;

    const attribution = firstTouchAttributionFromUrl({
      firstTouchId: crypto.randomUUID(),
      firstTouchedAt: now.toISOString(),
      landingUrl: window.location.href,
      referrerUrl: document.referrer || undefined,
      nowMs: now.getTime()
    });
    if (!attribution) return;

    const serialized = serializeFirstTouchAttribution(attribution, now.getTime());
    if (!serialized) return;

    document.cookie = firstTouchCookieAssignment(serialized, process.env.NODE_ENV === "production");
  }, []);

  return null;
}
