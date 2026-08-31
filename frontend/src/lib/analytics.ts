import posthog from "posthog-js";

/**
 * Initialize PostHog on client side with Session Replay and Error Observation.
 */
export function initPostHog(): void {
  if (typeof window === "undefined") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!posthogKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "ℹ️ PostHog key not found in NEXT_PUBLIC_POSTHOG_KEY. Running in no-op mode."
      );
    }
    return;
  }

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: "identified_only",
      capture_pageview: false, // Handled dynamically via PostHogPageView in App Router
      capture_pageleave: true,
      autocapture: true,
      capture_performance: true,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug(false);
        }
      },
    });
  } catch (err) {
    console.error("Failed to initialize PostHog:", err);
  }
}

/**
 * Type-safe event tracking helper.
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      posthog.capture(eventName, properties);
    }
  } catch (err) {
    console.debug("PostHog trackEvent error:", err);
  }
}

/**
 * Identify a user (e.g. Letterboxd username).
 */
export function identifyUser(
  username: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      posthog.identify(username, properties);
    }
  } catch (err) {
    console.debug("PostHog identifyUser error:", err);
  }
}

/**
 * Capture an error or exception with contextual properties.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    const errorObj =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : JSON.stringify(error));

    if (posthog.__loaded) {
      posthog.captureException(errorObj, {
        extra: context,
      });
    }
  } catch (err) {
    console.debug("PostHog captureException error:", err);
  }
}

// -----------------------------------------------------------------------------
// Domain-Specific Funnel & Interaction Events
// -----------------------------------------------------------------------------

export function trackSearchStarted(params: {
  type: "taste_match" | "scout";
  filmCount?: number;
  location?: string;
  minShared?: number;
  maxPages?: number;
  sentiment?: string;
  sourceUsername?: string;
}): void {
  trackEvent("search_started", params);
}

export function trackSearchCompleted(params: {
  type: "taste_match" | "scout";
  matchesCount: number;
  durationMs?: number;
  location?: string;
}): void {
  trackEvent("search_completed", params);
}

export function trackSearchFailed(params: {
  type: "taste_match" | "scout";
  error: string;
  statusCode?: number;
}): void {
  trackEvent("search_failed", params);
  captureException(new Error(params.error), {
    search_type: params.type,
    status_code: params.statusCode,
  });
}

export function trackFilmSelected(film: {
  slug: string;
  title?: string;
  year?: number | null;
}): void {
  trackEvent("film_selected", film);
}

export function trackFilmRemoved(slug: string): void {
  trackEvent("film_removed", { slug });
}

export function trackMemberProfileViewed(params: {
  username: string;
  matchPercentage?: number;
  sharedFilmsCount?: number;
  location?: string;
}): void {
  trackEvent("member_profile_viewed", params);
}

export function trackOutboundLetterboxdClick(params: {
  target: "user" | "film";
  identifier: string;
}): void {
  trackEvent("outbound_letterboxd_clicked", params);
}

export function trackExport(params: {
  format: "csv" | "json" | "clipboard";
  count: number;
}): void {
  trackEvent("matches_exported", params);
}

export function trackNewsletterSubscribed(params: {
  source: string;
  feature?: string;
}): void {
  trackEvent("newsletter_subscribed", params);
}

export function trackWaitlistJoined(params: {
  featureKey: string;
}): void {
  trackEvent("waitlist_joined", params);
}
