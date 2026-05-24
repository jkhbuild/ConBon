"use client";

import { useUIStore } from "@/stores/uiStore";

// NewCardButton — small "+" affordance per column / lane. Opens the
// CardEditModal in create mode with the column's assigneeId prefilled
// (null for Backlog). The modal handles the form + cards.create.

type Props = {
  assigneeId: string | null;
  label?: string;
};

export function NewCardButton({ assigneeId, label = "Add task" }: Props) {
  const openNewCard = useUIStore((s) => s.openNewCard);
  return (
    <button
      type="button"
      className="new-card-btn"
      onClick={() => openNewCard(assigneeId)}
      aria-label={label}
      title={label}
    >
      +
    </button>
  );
}
