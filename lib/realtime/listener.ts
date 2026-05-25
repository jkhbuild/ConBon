import "server-only";
import { Client } from "pg";

// Real-time NOTIFY listener.
//
// Phase 8. A dedicated long-lived pg.Client holds a `LISTEN conbon_events`
// connection per Node process and fans out each parsed payload to every
// SSE subscriber registered via addSubscriber(). Single-process by design
// — LISTEN is per-connection, so scaling to multiple Node processes would
// need Redis Pub/Sub (or similar) between them.
//
// Why a fresh pg.Client instead of the Prisma pool? PrismaPg manages a
// pool and may rotate or close connections, which would drop the LISTEN
// registration. We want one dedicated connection that survives as long
// as the process.
//
// Hot-reload survival: Next dev re-evaluates modules on file changes,
// which would otherwise spawn a fresh listener per change and leak the
// previous one. Pinning state on globalThis keeps one listener per Node
// process across reloads.

export type NotifyPayload = {
  type: "Card" | "Person" | "Contract";
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
};

export type Subscriber = (payload: NotifyPayload) => void;

type ListenerState = {
  client: Client | null;
  subscribers: Set<Subscriber>;
  starting: Promise<void> | null;
};

const globalForListener = globalThis as unknown as {
  __conbonListener?: ListenerState;
};

function getState(): ListenerState {
  globalForListener.__conbonListener ??= {
    client: null,
    subscribers: new Set(),
    starting: null,
  };
  return globalForListener.__conbonListener;
}

async function connect(state: ListenerState): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; cannot open LISTEN connection");
  }
  const client = new Client({ connectionString });

  client.on("notification", (msg) => {
    if (msg.channel !== "conbon_events" || !msg.payload) return;
    let parsed: NotifyPayload;
    try {
      parsed = JSON.parse(msg.payload) as NotifyPayload;
    } catch {
      return;
    }
    for (const sub of state.subscribers) {
      try {
        sub(parsed);
      } catch (err) {
        console.error("[realtime] subscriber threw", err);
      }
    }
  });

  client.on("error", (err) => {
    console.error("[realtime] pg client error, will reconnect", err);
    if (state.client === client) state.client = null;
    setTimeout(() => {
      void ensureListening().catch((retryErr) => {
        console.error("[realtime] reconnect failed", retryErr);
      });
    }, 1000);
  });

  client.on("end", () => {
    if (state.client === client) state.client = null;
  });

  await client.connect();
  await client.query("LISTEN conbon_events");
  state.client = client;
}

export async function ensureListening(): Promise<void> {
  const state = getState();
  if (state.client) return;
  if (state.starting) {
    await state.starting;
    return;
  }
  state.starting = connect(state).finally(() => {
    state.starting = null;
  });
  await state.starting;
}

export async function addSubscriber(sub: Subscriber): Promise<void> {
  await ensureListening();
  getState().subscribers.add(sub);
}

export function removeSubscriber(sub: Subscriber): void {
  getState().subscribers.delete(sub);
}
