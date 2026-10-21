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
  GOOGLE_ANALYTICS_SCRIPT_ID,
  googleAnalyticsMeasurementId,
  googleAnalyticsPageView,
  planGoogleAnalytics,
  type GoogleAnalyticsCommand
} from "@/lib/googleAnalytics";
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
type GoogleAnalyticsQueue = (...args: unknown[]) => void;
const DEFAULT_HUBSPOT_PORTAL_ID = "44475527";

interface GoogleAnalyticsRuntimeState {
  defaultSet: boolean;
  configured: boolean;
  lastPagePath: string | null;
}

declare global {
  interface Window {
    _hsq?: HubSpotQueue;
    dataLayer?: unknown[];
    gtag?: GoogleAnalyticsQueue;
    __opportunityScannerGoogleAnalytics?: GoogleAnalyticsRuntimeState;
  }
}

function installGoogleAnalyticsQueue(): GoogleAnalyticsQueue {
  window.dataLayer = window.dataLayer || [];
  const existing = window.gtag;
  if (existing) return existing;
  const queue: GoogleAnalyticsQueue = function gtag() {
    window.dataLayer?.push(arguments);
  };
  window.gtag = queue;
  return queue;
}

function googleAnalyticsRuntimeState(): GoogleAnalyticsRuntimeState {
  const state = window.__opportunityScannerGoogleAnalytics ?? {
    defaultSet: false,
    configured: false,
    lastPagePath: null
  };
  window.__opportunityScannerGoogleAnalytics = state;
  return state;
}

function runGoogleAnalyticsCommand(gtag: GoogleAnalyticsQueue, command: GoogleAnalyticsCommand) {
  if (command[0] === "js") {
    gtag("js", new Date());
    return;
  }
  if (command[0] === "config" && typeof command[1] === "string") {
    const page = googleAnalyticsPageView(window.location.origin, window.location.pathname);
    const options = typeof command[2] === "object" && command[2] !== null
      ? command[2] as Record<string, unknown>
      : {};
    gtag("config", command[1], { ...options, page_location: page.page_location });
    return;
  }
  gtag(...(command as [string, ...unknown[]]));
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

  useEffect(() => {
    const measurementId = googleAnalyticsMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
    if (!measurementId) return;

    const state = googleAnalyticsRuntimeState();
    const plan = planGoogleAnalytics({
      measurementId,
      consent,
      defaultSet: state.defaultSet,
      configured: state.configured
    });

    if (plan.commands.length > 0 || plan.loadScript) {
      const gtag = installGoogleAnalyticsQueue();
      for (const command of plan.commands) runGoogleAnalyticsCommand(gtag, command);
      if (plan.commands.some((command) => command[0] === "consent" && command[1] === "default")) {
        state.defaultSet = true;
      }
      if (plan.loadScript && !document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
        const script = document.createElement("script");
        script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
      }
      if (plan.loadScript) state.configured = true;
    }

    if (!plan.trackPageViews) state.lastPagePath = null;
  }, [consent]);

  useEffect(() => {
    if (consent !== "analytics") return;
    const measurementId = googleAnalyticsMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
    const state = window.__opportunityScannerGoogleAnalytics;
    if (!measurementId || !state?.configured || !window.gtag) return;

    const page = googleAnalyticsPageView(window.location.origin, pathname || "/", document.referrer);
    if (state.lastPagePath === page.page_path) return;
    state.lastPagePath = page.page_path;
    window.gtag("event", "page_view", {
      ...page,
      page_title: document.title
    });
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
