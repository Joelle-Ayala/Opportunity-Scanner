"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { track as trackVercelEvent } from "@vercel/analytics";
import {
  PRODUCT_ANALYTICS_BROWSER_EVENT,
  sanitizeProductAnalyticsEvent,
  stripUrlQuery,
  type ProductAnalyticsEnvelope
} from "@/lib/productAnalytics";

type PostHogClient = {
  capture: (name: string, properties: Record<string, string | boolean>) => void;
};

function sanitizePostHogProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...properties };
  for (const key of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"]) {
    if (typeof sanitized[key] === "string") sanitized[key] = stripUrlQuery(sanitized[key]);
  }
  return sanitized;
}

export function ProductAnalytics() {
  useEffect(() => {
    const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
    const postHogEnabled = Boolean(postHogKey && postHogHost);
    const pendingPostHogEvents: ProductAnalyticsEnvelope[] = [];
    let postHog: PostHogClient | null = null;
    let active = true;

    const handleProductEvent = (browserEvent: Event) => {
      const detail = browserEvent instanceof CustomEvent ? browserEvent.detail : null;
      const event = sanitizeProductAnalyticsEvent(detail?.name, detail?.properties);
      if (!event) return;

      trackVercelEvent(event.name, event.properties);
      if (postHog) {
        postHog.capture(event.name, event.properties);
      } else if (postHogEnabled && pendingPostHogEvents.length < 100) {
        pendingPostHogEvents.push(event);
      }
    };

    window.addEventListener(PRODUCT_ANALYTICS_BROWSER_EVENT, handleProductEvent);

    if (postHogEnabled) {
      void import("posthog-js")
        .then(({ default: client }) => {
          if (!active) return;
          client.init(postHogKey!, {
            api_host: postHogHost,
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
            person_profiles: "identified_only",
            persistence: "memory",
            sanitize_properties: sanitizePostHogProperties
          });
          postHog = client;
          pendingPostHogEvents.splice(0).forEach((event) => {
            postHog?.capture(event.name, event.properties);
          });
        })
        .catch(() => {
          pendingPostHogEvents.length = 0;
        });
    }

    return () => {
      active = false;
      pendingPostHogEvents.length = 0;
      window.removeEventListener(PRODUCT_ANALYTICS_BROWSER_EVENT, handleProductEvent);
    };
  }, []);

  return (
    <Analytics
      beforeSend={(event) => ({
        ...event,
        url: stripUrlQuery(event.url)
      })}
    />
  );
}

