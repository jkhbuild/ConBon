"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc/client";

// Client-side companion to /api/events.
//
// Opens an EventSource, parses each NOTIFY payload, and invalidates the
// matching React Query key. Mounted once in app/(app)/layout.tsx via the
// <RealtimeSync /> wrapper so every authenticated route participates.
//
// Reconnect strategy: we call es.close() inside onerror, which disables
// EventSource's built-in retry, then schedule our own exponential backoff
// (1s → 2s → 4s → 8s → 16s → 30s cap). This gives predictable behavior
// when the server is restarting; the native retry's variable interval
// would make dev hot-reload reconnects feel flaky.

type NotifyPayload = {
  type: "Card" | "Person" | "Contract";
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
};

const MAX_BACKOFF_MS = 30_000;

export function useRealtimeSync() {
  const utils = trpc.useUtils();

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource("/api/events");

      es.onopen = () => {
        retry = 0;
      };

      es.onmessage = (e) => {
        if (!e.data) return;
        let payload: NotifyPayload;
        try {
          payload = JSON.parse(e.data) as NotifyPayload;
        } catch {
          return;
        }
        switch (payload.type) {
          case "Card":
            void utils.cards.list.invalidate();
            void utils.cards.listArchived.invalidate();
            break;
          case "Person":
            void utils.people.list.invalidate();
            break;
          case "Contract":
            void utils.contracts.list.invalidate();
            break;
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retry);
        retry += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [utils]);
}
