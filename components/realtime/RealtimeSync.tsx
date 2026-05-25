"use client";

import { useRealtimeSync } from "@/lib/realtime/useRealtimeSync";

// Render-nothing wrapper that activates the SSE subscription in the
// (app) layout. Lifting the hook into a sibling component keeps the
// layout file an RSC and contains the "use client" boundary here.

export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
