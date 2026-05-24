"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useOpenCardId, useUIStore } from "@/stores/uiStore";
import type { CardData } from "./Card";
import {
  effectivePriority,
  priorityColor,
  priorityLabel,
  type PriorityLevel,
} from "@/lib/priority";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";

// CardEditModal — Radix Dialog port of reference/prototype/app.jsx
// TaskModal. Opens when openCardId is non-null; reads the card from the
// existing cards.list query (no separate cards.byId), writes through
// cards.update with an optimistic patch on the same list. "Delete" in
// the prototype becomes "Archive" — the card disappears from /active
// and surfaces on /archive (Block F) with a Restore action.
//
// Radix gives us focus trap, scroll lock, Escape-to-close,
// click-outside-to-close, and focus restoration on close for free.

const TASK_TYPE_LABELS: Record<"ESTIMATE" | "SCHEDULE" | "OTHER", string> = {
  ESTIMATE: "Estimate",
  SCHEDULE: "Schedule",
  OTHER: "Other",
};

type TaskType = keyof typeof TASK_TYPE_LABELS;

type UpdateInput = {
  id: string;
  title?: string;
  contractId?: string;
  type?: TaskType;
  assigneeId?: string | null;
  assignmentDate?: Date;
  dueDate?: Date;
  priorityOverride?: number | null;
  blockerNote?: string | null;
};

type DraftState = {
  title: string;
  contractId: string;
  type: TaskType;
  assigneeId: string | null;
  assignmentDate: string;
  dueDate: string;
  priorityOverride: number | null;
  blockerNote: string;
};

function toDateInput(d: Date): string {
  // YYYY-MM-DD for <input type="date">. Use local-tz components so the
  // user sees the same calendar date they picked.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CardEditModal() {
  const openCardId = useOpenCardId();
  const closeCard = useUIStore((s) => s.closeCard);
  const utils = trpc.useUtils();

  const { data: cards } = trpc.cards.list.useQuery();
  const { data: people = [] } = trpc.people.list.useQuery();
  const { data: contracts = [] } = trpc.contracts.list.useQuery();

  const card = cards?.find((c) => c.id === openCardId) ?? null;

  const updateMutation = trpc.cards.update.useMutation(
    useOptimisticListMutation<UpdateInput, CardData>(
      utils.cards.list,
      (old, input) =>
        old.map((c) => {
          if (c.id !== input.id) return c;
          const nextAssignee =
            input.assigneeId === undefined
              ? c.assignee
              : input.assigneeId === null
                ? null
                : (people.find((p) => p.id === input.assigneeId) ?? c.assignee);
          const nextContract =
            input.contractId === undefined
              ? c.contract
              : (contracts.find((co) => co.id === input.contractId) ?? c.contract);
          return {
            ...c,
            ...(input.title !== undefined && { title: input.title }),
            ...(input.contractId !== undefined && { contractId: input.contractId }),
            contract: nextContract,
            ...(input.type !== undefined && { type: input.type }),
            ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
            assignee: nextAssignee,
            ...(input.assignmentDate !== undefined && {
              assignmentDate: input.assignmentDate,
            }),
            ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
            ...(input.priorityOverride !== undefined && {
              priorityOverride: input.priorityOverride,
            }),
            ...(input.blockerNote !== undefined && {
              blockerNote: input.blockerNote,
            }),
          };
        }),
    ),
  );

  const archiveMutation = trpc.cards.archive.useMutation(
    useOptimisticListMutation<{ id: string }, CardData>(
      utils.cards.list,
      (old, input) => old.filter((c) => c.id !== input.id),
    ),
  );

  const [draft, setDraft] = useState<DraftState | null>(null);

  // Seed the draft when a different card is opened. We deliberately
  // depend only on `openCardId` (not `card`) — re-seeding on each
  // optimistic patch would clobber the user's in-progress edits.
  useEffect(() => {
    if (!card) {
      setDraft(null);
      return;
    }
    setDraft({
      title: card.title,
      contractId: card.contractId,
      type: card.type as TaskType,
      assigneeId: card.assigneeId,
      assignmentDate: toDateInput(card.assignmentDate),
      dueDate: toDateInput(card.dueDate),
      priorityOverride: card.priorityOverride,
      blockerNote: card.blockerNote ?? "",
    });
    // Intentionally only reacting to openCardId — re-seeding the draft
    // on every cards.list refetch would clobber the user's in-progress
    // edits. react-hooks/exhaustive-deps isn't loaded in this config so
    // there's no eslint-disable to silence here.
  }, [openCardId]);

  if (!card || !draft) return null;

  const currentLevel = effectivePriority(card);
  const open = openCardId !== null;

  const set = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const handleSave = () => {
    updateMutation.mutate({
      id: card.id,
      title: draft.title.trim(),
      contractId: draft.contractId,
      type: draft.type,
      assigneeId: draft.assigneeId,
      assignmentDate: new Date(draft.assignmentDate),
      dueDate: new Date(draft.dueDate),
      priorityOverride: draft.priorityOverride,
      blockerNote: draft.blockerNote.trim().length === 0
        ? null
        : draft.blockerNote.trim(),
    });
    closeCard();
  };

  const handleArchive = () => {
    archiveMutation.mutate({ id: card.id });
    closeCard();
  };

  const canSave = draft.title.trim().length > 0;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) closeCard();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal">
          <div className="modal-head">
            <Dialog.Title asChild>
              <h2>Edit task</h2>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Edit the title, contract, assignee, dates, priority, and blocker
              note for this task.
            </Dialog.Description>
            <Dialog.Close
              className="modal-close"
              aria-label="Close"
              // Reset focus to body on close — Dialog.Close inside Content
              // by default returns focus to the trigger; that's the card,
              // which is what we want.
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="modal-body">
            <div className="field">
              <label className="field-label" htmlFor="card-title">Title</label>
              <input
                id="card-title"
                type="text"
                autoFocus
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="card-contract">
                  Contract
                </label>
                <select
                  id="card-contract"
                  value={draft.contractId}
                  onChange={(e) => set("contractId", e.target.value)}
                >
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="card-type">Type</label>
                <select
                  id="card-type"
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value as TaskType)}
                >
                  {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Assignee</label>
              <div className="assignee-picker">
                <button
                  type="button"
                  className={draft.assigneeId == null ? "active" : ""}
                  onClick={() => set("assigneeId", null)}
                >
                  <span
                    className="avatar"
                    style={{
                      width: 22,
                      height: 22,
                      background: "transparent",
                      border: "1.5px dashed var(--line-strong)",
                      color: "var(--ink-3)",
                      fontSize: 11,
                    }}
                  >
                    ?
                  </span>
                  Backlog
                </button>
                {people.map((p) => {
                  const initials = p.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("");
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={draft.assigneeId === p.id ? "active" : ""}
                      onClick={() => set("assigneeId", p.id)}
                    >
                      <span
                        className="avatar"
                        style={{
                          width: 22,
                          height: 22,
                          background: p.color,
                          fontSize: 10,
                        }}
                      >
                        {initials}
                      </span>
                      {p.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="card-assignment-date">
                  Assignment date
                </label>
                <input
                  id="card-assignment-date"
                  type="date"
                  value={draft.assignmentDate}
                  onChange={(e) => set("assignmentDate", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="card-due-date">
                  Due date
                </label>
                <input
                  id="card-due-date"
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">
                Priority{" "}
                {draft.priorityOverride != null
                  ? "(manual override)"
                  : "(auto from age)"}
              </label>
              <div className="priority-picker">
                {([1, 2, 3, 4, 5] as PriorityLevel[]).map((lvl) => {
                  const active =
                    draft.priorityOverride === lvl ||
                    (draft.priorityOverride == null && lvl === currentLevel);
                  return (
                    <button
                      type="button"
                      key={lvl}
                      className={active ? "active" : ""}
                      style={{ background: priorityColor(lvl) }}
                      onClick={() => set("priorityOverride", lvl)}
                      title={priorityLabel(lvl)}
                    >
                      {lvl} · {priorityLabel(lvl)}
                    </button>
                  );
                })}
              </div>
              {draft.priorityOverride != null && (
                <button
                  type="button"
                  className="link-muted"
                  onClick={() => set("priorityOverride", null)}
                >
                  Clear override → use auto-aging
                </button>
              )}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="card-blocker">
                Blocker note (optional)
              </label>
              <textarea
                id="card-blocker"
                value={draft.blockerNote}
                onChange={(e) => set("blockerNote", e.target.value)}
                placeholder="Anything stopping work on this task?"
              />
            </div>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn-ghost btn-danger"
              onClick={handleArchive}
              style={{ marginRight: "auto" }}
            >
              Archive task
            </button>
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost">
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              Save changes
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
