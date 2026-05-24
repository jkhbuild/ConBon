"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import { type ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
import type { CardData } from "./Card";
import { useUIStore } from "@/stores/uiStore";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import {
  effectivePriority,
  priorityColor,
  priorityLabel,
  type PriorityLevel,
} from "@/lib/priority";

// CardContextMenu — Radix ContextMenu port of reference/prototype/app.jsx
// ContextMenu. Wraps a Card to add right-click affordances:
//   - Set priority (1..5 dots) — calls cards.update with priorityOverride.
//   - Clear manual override — only shown when an override is set.
//   - Edit task — opens CardEditModal via uiStore.openCard.
//   - Archive task — calls cards.archive.
//
// Radix provides keyboard navigation (arrow keys), focus trap inside the
// menu, Escape to close, and portaling. The Trigger uses display:contents
// so the wrapper doesn't disturb the flex/grid layout of the parent
// column / lane — its children (the Card div) become the layout child.

type Props = {
  card: CardData;
  children: ReactNode;
};

type UpdateInput = {
  id: string;
  priorityOverride?: number | null;
};

export function CardContextMenu({ card, children }: Props) {
  const openCard = useUIStore((s) => s.openCard);
  const utils = trpc.useUtils();

  const updateMutation = trpc.cards.update.useMutation(
    useOptimisticListMutation<UpdateInput, CardData>(
      utils.cards.list,
      (old, input) =>
        old.map((c) =>
          c.id !== input.id
            ? c
            : {
                ...c,
                ...(input.priorityOverride !== undefined && {
                  priorityOverride: input.priorityOverride,
                }),
              },
        ),
    ),
  );

  const archiveMutation = trpc.cards.archive.useMutation(
    useOptimisticListMutation<{ id: string }, CardData>(
      utils.cards.list,
      (old, input) => old.filter((c) => c.id !== input.id),
    ),
  );

  const currentLevel = effectivePriority(card);
  const overrideLevel = card.priorityOverride;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger style={{ display: "contents" }}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="ctx-menu">
          <div className="ctx-section">Set priority</div>
          <div className="ctx-priority-row">
            {([1, 2, 3, 4, 5] as PriorityLevel[]).map((lvl) => {
              const active =
                overrideLevel === lvl ||
                (overrideLevel == null && lvl === currentLevel);
              // Wrap each dot in ContextMenu.Item via asChild so Radix
              // auto-closes the menu on click + arrow-key+Enter fires
              // the same mutation. Arrow nav within the row is
              // suboptimal (Radix's roving focus is vertical by default)
              // but better than the alternative — a non-Item click that
              // leaves the menu open.
              return (
                <ContextMenu.Item
                  key={lvl}
                  asChild
                  onSelect={() =>
                    updateMutation.mutate({
                      id: card.id,
                      priorityOverride: lvl,
                    })
                  }
                >
                  <button
                    type="button"
                    className={
                      "ctx-priority-dot" + (active ? " active" : "")
                    }
                    style={{ background: priorityColor(lvl) }}
                    title={priorityLabel(lvl)}
                  >
                    {lvl}
                  </button>
                </ContextMenu.Item>
              );
            })}
          </div>
          {overrideLevel != null && (
            <ContextMenu.Item
              className="ctx-item"
              onSelect={() =>
                updateMutation.mutate({
                  id: card.id,
                  priorityOverride: null,
                })
              }
            >
              <span aria-hidden="true">↺</span> Clear manual override
            </ContextMenu.Item>
          )}
          <ContextMenu.Separator className="ctx-sep" />
          <ContextMenu.Item
            className="ctx-item"
            onSelect={() => openCard(card.id)}
          >
            <span aria-hidden="true">✎</span> Edit task…
          </ContextMenu.Item>
          <ContextMenu.Separator className="ctx-sep" />
          <ContextMenu.Item
            className="ctx-item danger"
            onSelect={() => archiveMutation.mutate({ id: card.id })}
          >
            <span aria-hidden="true">📦</span> Archive task
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
