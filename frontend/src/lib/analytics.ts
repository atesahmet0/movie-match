import posthog from "posthog-js";

/**
 * Initialize PostHog on client side with Session Replay and Error Observation.
 */
export function initPostHog(): void {
  if (typeof window === "undefined") return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!posthogKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(
        "ℹ️ PostHog key not found in NEXT_PUBLIC_POSTHOG_KEY. Running in no-op mode."
      );
    }
    return;
  }

  if (posthog.__loaded) {
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
      enable_recording_console_log: true,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
        captureJsonLd: true,
      },
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") {
          ph.debug(false);
        }
        try {
          ph.startSessionRecording(true);
        } catch (err) {
          console.debug("PostHog startSessionRecording error:", err);
        }
      },
    });
  } catch (err) {
    console.error("Failed to initialize PostHog:", err);
  }
}

/**
 * Start or force start session recording.
 */
export function startSessionRecording(forceOverride = false): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      posthog.startSessionRecording(forceOverride ? true : undefined);
    }
  } catch (err) {
    console.debug("PostHog startSessionRecording error:", err);
  }
}

/**
 * Stop or pause session recording.
 */
export function stopSessionRecording(): void {
  if (typeof window === "undefined") return;
  try {
    if (posthog.__loaded) {
      posthog.stopSessionRecording();
    }
  } catch (err) {
    console.debug("PostHog stopSessionRecording error:", err);
  }
}

/**
 * Check if session recording is currently active.
 */
export function isSessionRecordingActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(posthog.__loaded && posthog.sessionRecordingStarted());
  } catch {
    return false;
  }
}

/**
 * Retrieve the current PostHog Session Replay URL (useful for error tracing & bug reports).
 */
export function getSessionReplayUrl(options?: { withTimestamp?: boolean }): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (posthog.__loaded && typeof posthog.get_session_replay_url === "function") {
      return posthog.get_session_replay_url(options);
    }
  } catch (err) {
    console.debug("PostHog getSessionReplayUrl error:", err);
  }
  return null;
}

/**
 * Retrieve the current active PostHog session ID.
 */
export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    if (posthog.__loaded && typeof posthog.get_session_id === "function") {
      return posthog.get_session_id();
    }
  } catch (err) {
    console.debug("PostHog getSessionId error:", err);
  }
  return null;
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
 * Capture an error or exception with contextual properties and session replay link.
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
      const replayUrl = getSessionReplayUrl();
      const sessionId = getSessionId();
      posthog.captureException(errorObj, {
        extra: {
          ...context,
          ...(sessionId ? { posthog_session_id: sessionId } : {}),
          ...(replayUrl ? { posthog_replay_url: replayUrl } : {}),
        },
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
