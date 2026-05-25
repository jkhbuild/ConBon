import { auth } from "@/auth";
import {
  addSubscriber,
  removeSubscriber,
  type Subscriber,
} from "@/lib/realtime/listener";
import type { NextRequest } from "next/server";

// SSE endpoint backing the real-time sync pipe.
//
// Phase 8. Authenticated clients open EventSource('/api/events'); we
// subscribe them to the long-lived NOTIFY listener and stream each
// pg_notify payload as an SSE `data:` line.
//
// Auth shape: JSON 401 on unauth, same as tRPC. The proxy matcher
// excludes /api/events so this 401 reaches the client instead of an
// HTML 307 to /signin — EventSource can't follow redirects.
//
// Heartbeat every 25s keeps idle-killing proxies (Caddy buffering,
// browser quirks, NAT timeouts) from dropping the connection.

export const runtime = "nodejs"; // pg.Client needs Node, not edge
export const dynamic = "force-dynamic"; // never statically cached

const HEARTBEAT_MS = 25_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let subscriber: Subscriber | undefined;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (heartbeat) clearInterval(heartbeat);
    if (subscriber) removeSubscriber(subscriber);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client disconnected); drop.
        }
      };

      safeEnqueue(": connected\n\n");

      subscriber = (payload) => {
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      };
      await addSubscriber(subscriber);

      heartbeat = setInterval(() => {
        safeEnqueue(": ping\n\n");
      }, HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  req.signal.addEventListener("abort", cleanup);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
