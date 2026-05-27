import { auth } from "@/auth";
import { getServerCaller } from "@/lib/trpc/server";
import { Board } from "@/components/board/Board";

// Active board — Phase 5. RSC fetches the read-only payload (cards +
// people) in parallel via the tRPC server caller and hands off to the
// <Board /> client component, which owns the DnD wiring and the layout
// switch. Phase 6 wires mutations (cards.move) without changing this
// page; the Board's local state will become an optimistic-update cache.
//
// `force-dynamic` because the board is per-request data — the seed
// changes whenever someone runs db:seed and we don't want stale HTML.
//
// Post-v1 (blockers): also fetches blockers.list and the viewer's role
// in parallel. Both feed the CM-column blocker rendering inside <Board>.
// auth() is React.cache-memoized so this call dedupes with the (app)
// layout's call — no extra session decryption.

export const dynamic = "force-dynamic";

export default async function ActivePage() {
  const trpc = await getServerCaller();
  const [cards, people, blockers, session] = await Promise.all([
    trpc.cards.list(),
    trpc.people.list(),
    trpc.blockers.list(),
    auth(),
  ]);

  // proxy.ts guarantees signed-in here, but typing wants the narrowing.
  const viewer = session?.user
    ? { id: session.user.id, role: session.user.role }
    : null;

  // Pin the clock at the RSC layer so SSR + client-hydration use the same
  // "now" for the priority/aging math. Date.now() is fine over Date —
  // BoardClockContext stores Date and the client constructs it from this
  // number on initial state.
  return (
    <Board
      initialCards={cards}
      people={people}
      initialBlockers={blockers}
      viewer={viewer}
      serverNow={Date.now()}
    />
  );
}
