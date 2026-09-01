"use client";

import React, { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import {
  initPostHog,
  captureException,
  startSessionRecording,
  getSessionReplayUrl,
} from "@/lib/analytics";

function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && typeof window !== "undefined") {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = `${url}?${searchParams.toString()}`;
      }

      if (posthog.__loaded) {
        posthog.capture("$pageview", {
          $current_url: url,
        });
      }
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initPostHog();

    // Ensure session recording is actively initiated
    startSessionRecording(true);

    // Global client-side error observation with replay URL context
    const handleGlobalError = (event: ErrorEvent) => {
      const replayUrl = getSessionReplayUrl();
      captureException(event.error || event.message, {
        source: "window.onerror",
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        ...(replayUrl ? { session_replay_url: replayUrl } : {}),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const replayUrl = getSessionReplayUrl();
      captureException(event.reason, {
        source: "window.unhandledrejection",
        ...(replayUrl ? { session_replay_url: replayUrl } : {}),
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
