import { useCallback, useEffect, useRef } from "react";

let sessionId: string | null = null;
function getSessionId(): string {
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  return sessionId;
}

export function useTrackActivity() {
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

export function useTrackFormStep() {
  const track = useTrackActivity();
  return useCallback((formName: string, stepId: string, stepNumber: number, totalSteps: number) => {
    track("form_step_complete", undefined, { form: formName, step_id: stepId, step: stepNumber, total: totalSteps });
  }, [track]);
}

export function useTrackCta() {
  const track = useTrackActivity();
  return useCallback((ctaName: string, sourcePage?: string, metadata?: Record<string, any>) => {
    track("cta_click", sourcePage, { cta: ctaName, ...metadata });
  }, [track]);
}

export function useTrackFormStart() {
  const track = useTrackActivity();
  const tracked = useRef(false);
  return useCallback((formName: string) => {
    if (!tracked.current) {
      tracked.current = true;
      track("form_start", undefined, { form: formName });
    }
  }, [track]);
}

export function useTrackFormAbandon(formName: string, isActive: boolean) {
  const track = useTrackActivity();
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        try {
          const payload = JSON.stringify({
            activityType: "form_abandon",
            page: window.location.pathname,
            metadata: { form: formName },
            sessionId: getSessionId(),
          });
          if (navigator.sendBeacon) {
            navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
          }
        } catch {}
      }
    };
  }, [formName, track]);
}

export function useTrackPropertyInteraction() {
  const track = useTrackActivity();
  return useCallback((action: "property_click" | "property_save" | "property_search", metadata?: Record<string, any>) => {
    track(action, "/properties", metadata);
  }, [track]);
}

export function useTrackCoachSession() {
  const track = useTrackActivity();
  return useCallback((action: "coach_session_start" | "coach_message_sent" | "coach_session_complete", metadata?: Record<string, any>) => {
    track(action, "/ai-coach", metadata);
  }, [track]);
}

export function useTrackAccountEvent() {
  const track = useTrackActivity();
  return useCallback((action: "account_created" | "login" | "doc_uploaded" | "rate_viewed", metadata?: Record<string, any>) => {
    track(action, undefined, metadata);
  }, [track]);
}
