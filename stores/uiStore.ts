import { create } from "zustand";

// Transient client-only UI state — anything that doesn't belong in the
// server cache (React Query). The split, from the architecture notes:
//   React Query → server state (cards, people, contracts)
//   Zustand     → drag preview, modal open/close, toasts
//
// Selectors throughout the app must return primitives, not object
// references, so React's bailout works against ===. See
// `useDraggingCardId` etc. below — never expose the whole store object.
//
// Phase 5 filled the slots the board needs (drag id + layout).
// Phase 6 added `openCardId` (edit modal) and `creatingForAssigneeId`
// (new-card modal, where null means Backlog and the sentinel
// CREATING_NONE means closed). Phase 10 added the toast queue.
// Phase 11 moved `layout` out of this store onto a DB-backed
// UserPreference (read via useBoardLayout from PreferencesBridge); a
// per-user pref doesn't belong in transient process memory.

// Sentinel for the "new card modal closed" state — we can't use `null`
// because null is a meaningful assignee value (Backlog).
export const CREATING_NONE = Symbol("creating-none");
export type CreatingForAssigneeId = string | null | typeof CREATING_NONE;

type UIState = {
  draggingCardId: string | null;
  openCardId: string | null;
  creatingForAssigneeId: CreatingForAssigneeId;

  setDraggingCardId: (id: string | null) => void;
  openCard: (id: string) => void;
  closeCard: () => void;
  openNewCard: (forAssigneeId: string | null) => void;
  closeNewCard: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  draggingCardId: null,
  openCardId: null,
  creatingForAssigneeId: CREATING_NONE,

  setDraggingCardId: (id) => set({ draggingCardId: id }),
  openCard: (id) => set({ openCardId: id }),
  closeCard: () => set({ openCardId: null }),
  openNewCard: (forAssigneeId) => set({ creatingForAssigneeId: forAssigneeId }),
  closeNewCard: () => set({ creatingForAssigneeId: CREATING_NONE }),
}));

// Primitive selectors. Components should import these (not `useUIStore`
// directly) so the equality check is structural-free.
export const useDraggingCardId = () => useUIStore((s) => s.draggingCardId);
export const useOpenCardId = () => useUIStore((s) => s.openCardId);
export const useCreatingForAssigneeId = () =>
  useUIStore((s) => s.creatingForAssigneeId);
