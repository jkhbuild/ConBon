import { create } from "zustand";

// Transient client-only UI state — anything that doesn't belong in the
// server cache (React Query). The split, from the architecture notes:
//   React Query → server state (cards, people, contracts)
//   Zustand     → drag preview, modal open/close, layout, toasts
//
// Selectors throughout the app must return primitives, not object
// references, so React's bailout works against ===. See
// `useDraggingCardId` etc. below — never expose the whole store object.
//
// Phase 5 fills only the slots the board needs (drag id + layout).
// Phase 6 adds `openCardId`. Phase 10 adds the toast queue.
// Phase 11 replaces `layout` with a server-backed UserPreference,
// migrating callers via the same selector.

export type BoardLayout = "columns" | "swimlanes";

type UIState = {
  draggingCardId: string | null;
  layout: BoardLayout;

  setDraggingCardId: (id: string | null) => void;
  setLayout: (layout: BoardLayout) => void;
};

export const useUIStore = create<UIState>((set) => ({
  draggingCardId: null,
  layout: "columns",

  setDraggingCardId: (id) => set({ draggingCardId: id }),
  setLayout: (layout) => set({ layout }),
}));

// Primitive selectors. Components should import these (not `useUIStore`
// directly) so the equality check is structural-free.
export const useDraggingCardId = () =>
  useUIStore((s) => s.draggingCardId);
export const useBoardLayout = () => useUIStore((s) => s.layout);
