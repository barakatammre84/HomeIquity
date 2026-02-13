import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";

let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  return sessionId;
}

export function useTrackActivity() {
  const trackRef = useRef<(type: string, page?: string, metadata?: Record<string, any>) => void>();

  const track = useCallback((activityType: string, page?: string, metadata?: Record<string, any>) => {
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType,
          page: page || window.location.pathname,
          metadata,
          sessionId: getSessionId(),
        }),
      }).catch(() => {});
    } catch {}
  }, []);

  trackRef.current = track;
  return track;
}

export function usePageView(pageName?: string) {
  const track = useTrackActivity();
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      track("page_view", pageName || window.location.pathname);
    }
  }, [track, pageName]);
}
