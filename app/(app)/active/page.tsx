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

export const dynamic = "force-dynamic";

export default async function ActivePage() {
  const trpc = await getServerCaller();
  const [cards, people] = await Promise.all([
    trpc.cards.list(),
    trpc.people.list(),
  ]);

  // Pin the clock at the RSC layer so SSR + client-hydration use the same
  // "now" for the priority/aging math. Date.now() is fine over Date —
  // BoardClockContext stores Date and the client constructs it from this
  // number on initial state.
  return (
    <Board initialCards={cards} people={people} serverNow={Date.now()} />
  );
}
