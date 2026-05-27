"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
import type { BlockerData, ViewerInfo } from "./Board";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";

// BlockerContextMenu — right-click menu for a single BlockerCard.
//
// Action ladder by viewer:
//   - CM / Admin       : "Mark as cleared" (acknowledge) when red, else
//                         "Mark as unclear" (unacknowledge) when green.
//   - Raiser OR Admin  : "Clear blocker" (hard delete; also clears the
//                         source card's blockerNote in the same tx).
//   - Anyone else      : no menu rendered (the trigger wrapper short-
//                         circuits to just rendering the children).
//
// Optimistic patches operate against blockers.list. Clear removes the
// row entirely; acknowledge / unacknowledge flip the two fields.

type Props = {
  blocker: BlockerData;
  viewer: ViewerInfo | null;
  children: ReactNode;
};

export function BlockerContextMenu({ blocker, viewer, children }: Props) {
  const utils = trpc.useUtils();

  const isAdmin = viewer?.role === "ADMIN";
  const isCM =
    viewer?.role === "ADMIN" || viewer?.role === "COMMERCIAL_MANAGER";
  const isRaiser = viewer?.id === blocker.raisedById;
  const canAcknowledge = isCM;
  const canClear = isAdmin || isRaiser;

  // No actions available → skip the ContextMenu wrapper entirely. The
  // children render bare so the surface is still visible but right-click
  // falls through to the browser default.
  if (!canAcknowledge && !canClear) {
    return <>{children}</>;
  }

  const acknowledged = blocker.acknowledgedAt != null;

  // Optimistic patch for acknowledge / unacknowledge — flips both fields
  // on the matching row inside blockers.list so the .is-acknowledged
  // class swaps colors immediately without waiting for the SSE round-trip.
  const ackPatch = (
    old: BlockerData[],
    { id, acknowledgedAt, acknowledgedById }: {
      id: string;
      acknowledgedAt: Date | null;
      acknowledgedById: string | null;
    },
  ): BlockerData[] =>
    old.map((b) =>
      b.id !== id
        ? b
        : { ...b, acknowledgedAt, acknowledgedById, acknowledgedBy: null },
    );

  const acknowledgeMutation = trpc.blockers.acknowledge.useMutation(
    useOptimisticListMutation(utils.blockers.list, (old, input: { id: string }) =>
      ackPatch(old, {
        id: input.id,
        acknowledgedAt: new Date(),
        acknowledgedById: viewer?.id ?? null,
      }),
    ),
  );

  const unacknowledgeMutation = trpc.blockers.unacknowledge.useMutation(
    useOptimisticListMutation(utils.blockers.list, (old, input: { id: string }) =>
      ackPatch(old, {
        id: input.id,
        acknowledgedAt: null,
        acknowledgedById: null,
      }),
    ),
  );

  // Clear has to patch TWO caches optimistically: blockers.list (drop
  // the row) AND cards.list (null out the source card's blockerNote so
  // the inline .card-blocker indicator disappears in the same tick).
  // The single-cache primitive can't express this, so we hand-roll the
  // mutation options. Without the cards.list patch, the source card
  // visibly keeps its blocker note for ~1 second until SSE round-trips
  // and useRealtimeSync invalidates cards.list — confusing because
  // Swati's column already lost the red card.
  const clearMutation = trpc.blockers.clear.useMutation({
    onMutate: async ({ id }) => {
      const snapshot = utils.blockers.list.getData() ?? [];
      const targetCardId = snapshot.find((b) => b.id === id)?.cardId;

      await Promise.all([
        utils.blockers.list.cancel(),
        utils.cards.list.cancel(),
      ]);
      const prevBlockers = utils.blockers.list.getData();
      const prevCards = utils.cards.list.getData();

      utils.blockers.list.setData(undefined, (old) =>
        old ? old.filter((b) => b.id !== id) : old,
      );
      if (targetCardId) {
        utils.cards.list.setData(undefined, (old) =>
          old
            ? old.map((c) =>
                c.id !== targetCardId ? c : { ...c, blockerNote: null },
              )
            : old,
        );
      }
      return { prevBlockers, prevCards };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prevBlockers) {
        utils.blockers.list.setData(undefined, ctx.prevBlockers);
      }
      if (ctx?.prevCards) {
        utils.cards.list.setData(undefined, ctx.prevCards);
      }
    },
    onSettled: () => {
      void utils.blockers.list.invalidate();
      void utils.cards.list.invalidate();
    },
  });

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger style={{ display: "contents" }}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        {/* Same Radix shift-crossAxis-off trap as CardContextMenu — see
            that file's note. Heavy .board-wrap padding-bottom keeps the
            menu clear of the viewport edge for cards near the bottom. */}
        <ContextMenu.Content className="ctx-menu" collisionPadding={12}>
          {canAcknowledge && !acknowledged && (
            <ContextMenu.Item
              className="ctx-item"
              onSelect={() => acknowledgeMutation.mutate({ id: blocker.id })}
            >
              <span aria-hidden="true">✓</span> Mark as cleared
            </ContextMenu.Item>
          )}
          {canAcknowledge && acknowledged && (
            <ContextMenu.Item
              className="ctx-item"
              onSelect={() =>
                unacknowledgeMutation.mutate({ id: blocker.id })
              }
            >
              <span aria-hidden="true">↺</span> Mark as unclear
            </ContextMenu.Item>
          )}
          {canAcknowledge && canClear && (
            <ContextMenu.Separator className="ctx-sep" />
          )}
          {canClear && (
            <ContextMenu.Item
              className="ctx-item danger"
              onSelect={() => clearMutation.mutate({ id: blocker.id })}
            >
              <span aria-hidden="true">✕</span> Clear blocker
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
