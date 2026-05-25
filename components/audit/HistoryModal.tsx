"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { trpc } from "@/lib/trpc/client";
import type { AuditEntityType } from "@/lib/audit";
import { diff, summarize, type AuditEventRow } from "@/lib/audit/diff";

// Chronological per-entity audit timeline.
//
// Mounted from <HistoryButton /> once the user clicks it, so the query
// only runs on demand. Stacks on top of CardEditModal — Radix Dialog
// uses portals so two open Dialog.Roots layer cleanly; the lower one
// loses focus trap to the upper, and Escape closes the upper first.
//
// Each row renders the actor color dot, timestamp, summary headline,
// and a 2-column field diff for the changes the action produced.
// summarize() / diff() in lib/audit/diff.ts own the presentation
// logic; this component is just markup.

type Props = {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TIMESTAMP_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function HistoryModal({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
}: Props) {
  const { data: events, isLoading } = trpc.audit.listForEntity.useQuery(
    { entityType, entityId },
    { enabled: open },
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop" />
        <Dialog.Content className="modal history-modal">
          <div className="modal-head">
            <Dialog.Title asChild>
              <h2>History — {entityName}</h2>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Chronological list of changes to {entityName}, newest first.
            </Dialog.Description>
            <Dialog.Close className="modal-close" aria-label="Close">
              ✕
            </Dialog.Close>
          </div>

          <div className="modal-body history-body">
            {isLoading && <p className="history-empty">Loading…</p>}
            {!isLoading && (!events || events.length === 0) && (
              <p className="history-empty">No history yet.</p>
            )}
            {events && events.length > 0 && (
              <ol className="history-list">
                {events.map((raw) => {
                  const event = raw as unknown as AuditEventRow;
                  const diffLines = diff(event);
                  return (
                    <li key={event.id} className="history-item">
                      <div className="history-item-head">
                        <span
                          className="history-actor-dot"
                          style={{
                            background: event.actor?.color ?? "var(--ink-3)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="history-summary">{summarize(event)}</span>
                        <span className="history-timestamp">
                          {TIMESTAMP_FMT.format(new Date(event.createdAt))}
                        </span>
                      </div>
                      {diffLines.length > 0 && (
                        <ul className="history-diff">
                          {diffLines.map((line) => (
                            <li key={line.field}>
                              <span className="history-diff-label">
                                {line.label}:
                              </span>{" "}
                              <span className="history-diff-before">
                                {line.before}
                              </span>{" "}
                              →{" "}
                              <span className="history-diff-after">
                                {line.after}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="modal-foot">
            <Dialog.Close asChild>
              <button type="button" className="btn-ghost">Close</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
