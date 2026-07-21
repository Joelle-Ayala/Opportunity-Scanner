"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics } from "@vercel/analytics/react";
import { track as trackVercelEvent } from "@vercel/analytics";
import {
  CUSTOMER_SIGN_OUT_BROWSER_EVENT,
  KNOWN_COMPANY_BROWSER_EVENT,
  sanitizeKnownCompanyIdentity,
  type KnownCompanyIdentity
} from "@/lib/companyAnalytics";
import {
  PRODUCT_ANALYTICS_BROWSER_EVENT,
  sanitizeProductAnalyticsEvent,
  stripUrlQuery,
  type ProductAnalyticsEnvelope
} from "@/lib/productAnalytics";
import {
  TRACKING_CONSENT_BROWSER_EVENT,
  currentTrackingConsent,
  type TrackingConsent
} from "@/lib/trackingConsent";

type PostHogClient = {
  capture: (name: string, properties: Record<string, string | boolean>) => void;
  group: (groupType: string, groupKey: string, properties?: Record<string, string>) => void;
  identify: (distinctId: string) => void;
  reset: () => void;
};

type HubSpotQueue = Array<[string, ...unknown[]]>;
const DEFAULT_HUBSPOT_PORTAL_ID = "44475527";

declare global {
  interface Window {
    _hsq?: HubSpotQueue;
  }
}

function sanitizePostHogProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...properties };
  for (const key of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"]) {
    if (typeof sanitized[key] === "string") sanitized[key] = stripUrlQuery(sanitized[key]);
  }
  return sanitized;
}

export function ProductAnalytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<TrackingConsent | null>(null);
  const postHogRef = useRef<PostHogClient | null>(null);
  const pendingPostHogEvents = useRef<ProductAnalyticsEnvelope[]>([]);
  const identityRef = useRef<KnownCompanyIdentity | null>(null);
  const hubSpotLoadedRef = useRef(false);
  const previousHubSpotPath = useRef<string | null>(null);

  useEffect(() => {
    setConsent(currentTrackingConsent());
    const handleConsent = (event: Event) => {
      const value = event instanceof CustomEvent ? event.detail : null;
      if (value === "analytics" || value === "necessary") setConsent(value);
    };
    window.addEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
    return () => window.removeEventListener(TRACKING_CONSENT_BROWSER_EVENT, handleConsent);
  }, []);

  useEffect(() => {
    const applyIdentity = (input: unknown) => {
      const identity = sanitizeKnownCompanyIdentity((input || {}) as KnownCompanyIdentity);
      if (!identity) return;
      identityRef.current = identity;

      const postHog = postHogRef.current;
      if (postHog && consent === "analytics") {
        if (identity.userId) postHog.identify(identity.userId);
        if (identity.companyDomain) {
          postHog.group("company", identity.companyDomain, {
            domain: identity.companyDomain,
            ...(identity.companyName ? { name: identity.companyName } : {})
          });
        }
      }

      if (consent === "analytics" && identity.email) {
        const queue = window._hsq = window._hsq || [];
        queue.push(["identify", { email: identity.email }]);
        if (hubSpotLoadedRef.current) queue.push(["trackPageView"]);
      }
    };

    if (window.__opportunityScannerKnownCompany) applyIdentity(window.__opportunityScannerKnownCompany);
    const handleIdentity = (event: Event) => {
      applyIdentity(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener(KNOWN_COMPANY_BROWSER_EVENT, handleIdentity);
    const handleSignOut = () => {
      identityRef.current = null;
      postHogRef.current?.reset();
      if (window._hsq) window._hsq.push(["revokeCookieConsent"]);
    };
    window.addEventListener(CUSTOMER_SIGN_OUT_BROWSER_EVENT, handleSignOut);
    return () => {
      window.removeEventListener(KNOWN_COMPANY_BROWSER_EVENT, handleIdentity);
      window.removeEventListener(CUSTOMER_SIGN_OUT_BROWSER_EVENT, handleSignOut);
    };
  }, [consent]);

  useEffect(() => {
    const postHogEnabled = Boolean(
      process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
      && process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim()
    );

    const handleProductEvent = (browserEvent: Event) => {
      const detail = browserEvent instanceof CustomEvent ? browserEvent.detail : null;
      const event = sanitizeProductAnalyticsEvent(detail?.name, detail?.properties);
      if (!event) return;

      trackVercelEvent(event.name, event.properties);
      if (consent !== "analytics") return;
      if (postHogRef.current) {
        postHogRef.current.capture(event.name, event.properties);
      } else if (postHogEnabled && pendingPostHogEvents.current.length < 100) {
        pendingPostHogEvents.current.push(event);
      }
    };

    window.addEventListener(PRODUCT_ANALYTICS_BROWSER_EVENT, handleProductEvent);
    return () => window.removeEventListener(PRODUCT_ANALYTICS_BROWSER_EVENT, handleProductEvent);
  }, [consent]);

  useEffect(() => {
    if (consent !== "analytics") {
      pendingPostHogEvents.current.length = 0;
      return;
    }

    const postHogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
    const hubSpotPortalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID?.trim() || DEFAULT_HUBSPOT_PORTAL_ID;
    let active = true;

    if (postHogKey && postHogHost && !postHogRef.current) {
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
          postHogRef.current = client;
          const identity = identityRef.current;
          if (identity?.userId) client.identify(identity.userId);
          if (identity?.companyDomain) {
            client.group("company", identity.companyDomain, {
              domain: identity.companyDomain,
              ...(identity.companyName ? { name: identity.companyName } : {})
            });
          }
          pendingPostHogEvents.current.splice(0).forEach((event) => {
            client.capture(event.name, event.properties);
          });
        })
        .catch(() => {
          pendingPostHogEvents.current.length = 0;
        });
    }

    if (/^\d+$/.test(hubSpotPortalId || "") && !document.getElementById("hs-script-loader")) {
      window._hsq = window._hsq || [];
      const identity = identityRef.current;
      if (identity?.email) window._hsq.push(["identify", { email: identity.email }]);
      const script = document.createElement("script");
      script.id = "hs-script-loader";
      script.async = true;
      script.defer = true;
      script.src = `https://js.hs-scripts.com/${hubSpotPortalId}.js`;
      script.addEventListener("load", () => {
        hubSpotLoadedRef.current = true;
        previousHubSpotPath.current = window.location.pathname;
      });
      document.body.appendChild(script);
    }

    return () => {
      active = false;
    };
  }, [consent]);

  useEffect(() => {
    if (consent !== "analytics" || !hubSpotLoadedRef.current) return;
    if (previousHubSpotPath.current === null) {
      previousHubSpotPath.current = pathname;
      return;
    }
    if (previousHubSpotPath.current === pathname) return;
    previousHubSpotPath.current = pathname;
    const queue = window._hsq = window._hsq || [];
    queue.push(["setPath", pathname]);
    queue.push(["trackPageView"]);
  }, [consent, pathname]);

  return (
    <Analytics
      beforeSend={(event) => ({
        ...event,
        url: stripUrlQuery(event.url)
      })}
    />
  );
}
