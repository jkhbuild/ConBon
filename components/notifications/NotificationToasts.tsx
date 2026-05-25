"use client";

import * as Toast from "@radix-ui/react-toast";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { viewerSummary, type AuditEventRow } from "@/lib/audit/diff";

// Live notification toasts.
//
// Subscribes to audit.listForUser (the same list that backs the bell
// dropdown — Phase 8's SSE pipe invalidates it on every Card/Person
// NOTIFY via useRealtimeSync). On each refetch, diffs against the set
// of already-seen audit IDs and pushes new entries onto the toast
// queue. The seen set is seeded on first render so the user doesn't
// get peppered with toasts for events that landed before they loaded
// the page.
//
// Self-actions are stripped at two layers: the server filters by
// `actorId != viewerId`, and viewerSummary() returns null for events
// that don't have a viewer-relative phrasing. Either filter sufficient
// alone; both belt-and-suspenders so an event without an actor (system
// action) doesn't toast as "Someone did something to a card you don't
// own".

type Props = {
  viewerId: string;
};

type ToastEntry = {
  id: string;
  text: string;
  color: string;
  open: boolean;
};

export function NotificationToasts({ viewerId }: Props) {
  const { data: events } = trpc.audit.listForUser.useQuery();
  const seenRef = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    if (!events) return;

    // First-render seed: every currently-known event is considered
    // already-seen so we don't toast retroactively for older entries.
    if (seenRef.current === null) {
      seenRef.current = new Set(events.map((e) => e.id));
      return;
    }

    const seen = seenRef.current;
    const newToasts: ToastEntry[] = [];
    for (const raw of events) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      const event = raw as unknown as AuditEventRow;
      const text = viewerSummary(event, viewerId);
      if (!text) continue;
      newToasts.push({
        id: event.id,
        text,
        color: event.actor?.color ?? "var(--ink-3)",
        open: true,
      });
    }
    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts]);
    }
  }, [events, viewerId]);

  const closeToast = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
  };

  return (
    <Toast.Provider swipeDirection="right" duration={6000}>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          className="toast"
          open={t.open}
          onOpenChange={(o) => {
            if (!o) closeToast(t.id);
          }}
        >
          <span
            className="toast-dot"
            style={{ background: t.color }}
            aria-hidden="true"
          />
          <Toast.Title className="toast-title">{t.text}</Toast.Title>
          <Toast.Close className="toast-close" aria-label="Dismiss">
            ✕
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="toast-viewport" />
    </Toast.Provider>
  );
}
