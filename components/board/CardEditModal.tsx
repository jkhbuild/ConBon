"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  CREATING_NONE,
  useCreatingForAssigneeId,
  useOpenCardId,
  useUIStore,
} from "@/stores/uiStore";
import type { CardData } from "./Card";
import {
  effectivePriority,
  priorityColor,
  priorityLabel,
  type PriorityLevel,
} from "@/lib/priority";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import { HistoryButton } from "@/components/audit/HistoryButton";

// CardEditModal — Radix Dialog port of reference/prototype/app.jsx
// TaskModal. Drives two flows:
//
//   Edit mode (uiStore.openCardId is set): reads the card from the
//   existing cards.list cache, writes via cards.update with an
//   optimistic patch on cards.list. Archive button is visible.
//
//   Create mode (uiStore.creatingForAssigneeId is set, possibly null
//   for Backlog): empty defaults seeded into the draft, save calls
//   cards.create then invalidates cards.list (no optimistic insert —
//   that would require client-side temp IDs to swap on success).
//   Archive button hidden.
//
// Radix gives us focus trap, scroll lock, Escape-to-close,
// click-outside-to-close, and focus restoration on close.

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
  // YYYY-MM-DD for <input type="date">. Use UTC accessors: `@db.Date`
  // columns round-trip as UTC-midnight Date objects, and the previous
  // local-tz accessors caused a one-day drift west of UTC (user picked
  // May 21, modal re-opened showing May 20, saving produced a phantom
  // "May 21 → May 20" audit diff).
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateInput(s: string): Date {
  // Parse YYYY-MM-DD as UTC midnight so the value round-trips with
  // toDateInput cleanly. `new Date("2026-05-21")` already parses as UTC
  // per spec, but constructing via Date.UTC makes the intent obvious.
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

export function CardEditModal() {
  const openCardId = useOpenCardId();
  const creatingForAssigneeId = useCreatingForAssigneeId();
  const closeCard = useUIStore((s) => s.closeCard);
  const closeNewCard = useUIStore((s) => s.closeNewCard);
  const utils = trpc.useUtils();

  const { data: cards } = trpc.cards.list.useQuery();
  const { data: people = [] } = trpc.people.list.useQuery();
  const { data: contracts = [] } = trpc.contracts.list.useQuery();

  const editingCard = openCardId
    ? (cards?.find((c) => c.id === openCardId) ?? null)
    : null;
  const isCreating = creatingForAssigneeId !== CREATING_NONE;
  const mode: "edit" | "create" | null = isCreating
    ? "create"
    : editingCard
      ? "edit"
      : null;

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

  // cards.create has no optimistic patch — the new row needs a real cuid
  // before it can join cards.list, and round-tripping a temp ID + swap
  // pattern would dwarf the actual mutation logic at this scale. The
  // refetch on settle reconciles the cache (typically <50ms locally).
  const createMutation = trpc.cards.create.useMutation({
    onSettled: () => {
      void utils.cards.list.invalidate();
    },
  });

  const [draft, setDraft] = useState<DraftState | null>(null);

  // Seed the draft when the modal opens. For edit, depend on openCardId.
  // For create, depend on creatingForAssigneeId + a snapshot of contracts
  // (we need at least one contract to pick a default). Re-seeding on
  // every cards.list patch would clobber in-progress user edits.
  useEffect(() => {
    if (mode === "edit" && editingCard) {
      setDraft({
        title: editingCard.title,
        contractId: editingCard.contractId,
        type: editingCard.type as TaskType,
        assigneeId: editingCard.assigneeId,
        assignmentDate: toDateInput(editingCard.assignmentDate),
        dueDate: toDateInput(editingCard.dueDate),
        priorityOverride: editingCard.priorityOverride,
        blockerNote: editingCard.blockerNote ?? "",
      });
    } else if (mode === "create" && contracts.length > 0) {
      const today = new Date();
      setDraft({
        title: "",
        contractId: contracts[0].id,
        type: "ESTIMATE",
        assigneeId:
          creatingForAssigneeId === CREATING_NONE
            ? null
            : creatingForAssigneeId,
        assignmentDate: toDateInput(today),
        dueDate: toDateInput(addDays(today, 14)),
        priorityOverride: null,
        blockerNote: "",
      });
    } else {
      setDraft(null);
    }
    // Intentionally narrow deps — seeding should only respond to mode
    // transitions and contract availability, not to every cache patch.
  }, [mode, openCardId, creatingForAssigneeId, contracts.length]);

  if (!mode || !draft) return null;

  // currentLevel is for the priority "auto" highlight. In create mode
  // with no card yet, derive from the draft's dates.
  const currentLevel =
    mode === "edit" && editingCard
      ? effectivePriority(editingCard)
      : effectivePriority({
          priorityOverride: draft.priorityOverride,
          assignmentDate: fromDateInput(draft.assignmentDate),
        });

  const open = mode !== null;

  const close = () => {
    if (mode === "edit") closeCard();
    else closeNewCard();
  };

  const set = <K extends keyof DraftState>(k: K, v: DraftState[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const handleSave = () => {
    if (mode === "edit" && editingCard) {
      updateMutation.mutate({
        id: editingCard.id,
        title: draft.title.trim(),
        contractId: draft.contractId,
        type: draft.type,
        assigneeId: draft.assigneeId,
        assignmentDate: fromDateInput(draft.assignmentDate),
        dueDate: fromDateInput(draft.dueDate),
        priorityOverride: draft.priorityOverride,
        blockerNote:
          draft.blockerNote.trim().length === 0
            ? null
            : draft.blockerNote.trim(),
      });
    } else if (mode === "create") {
      createMutation.mutate({
        title: draft.title.trim(),
        contractId: draft.contractId,
        type: draft.type,
        assigneeId: draft.assigneeId,
        assignmentDate: fromDateInput(draft.assignmentDate),
        dueDate: fromDateInput(draft.dueDate),
        priorityOverride: draft.priorityOverride,
        blockerNote:
          draft.blockerNote.trim().length === 0
            ? null
            : draft.blockerNote.trim(),
      });
    }
    close();
  };

  const handleArchive = () => {
    if (mode !== "edit" || !editingCard) return;
    archiveMutation.mutate({ id: editingCard.id });
    close();
  };

  const canSave = draft.title.trim().length > 0;
  const headerTitle = mode === "edit" ? "Edit task" : "New task";
  const saveLabel = mode === "edit" ? "Save changes" : "Create task";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal">
          <div className="modal-head">
            <Dialog.Title asChild>
              <h2>{headerTitle}</h2>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {mode === "edit"
                ? "Edit the title, contract, assignee, dates, priority, and blocker note for this task."
                : "Create a new task — fill in at least a title to enable Create."}
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Close">
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
                placeholder={
                  mode === "create" ? "e.g. Re-estimate steel package" : undefined
                }
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
            {mode === "edit" && editingCard && (
              <>
                <button
                  type="button"
                  className="btn-ghost btn-danger"
                  onClick={handleArchive}
                >
                  Archive task
                </button>
                <HistoryButton
                  entityType="Card"
                  entityId={editingCard.id}
                  entityName={editingCard.title}
                />
              </>
            )}
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn-ghost"
                style={mode === "edit" ? { marginLeft: "auto" } : undefined}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={!canSave}
            >
              {saveLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
