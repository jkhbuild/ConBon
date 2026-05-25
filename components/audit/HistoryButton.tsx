"use client";

import { useState } from "react";
import type { AuditEntityType } from "@/lib/audit";
import { HistoryModal } from "./HistoryModal";

// Trigger button + state holder for the History dialog. Embedded in the
// CardEditModal footer (and reusable by future admin pages). Splits the
// state from HistoryModal so the audit.listForEntity query doesn't fire
// until the user opens the dialog — Radix Dialog's open state controls
// when the child renders; we wait until `open === true` to mount the
// modal so the tRPC query is gated too.

type Props = {
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
};

export function HistoryButton({ entityType, entityId, entityName }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setOpen(true)}
      >
        History
      </button>
      {open && (
        <HistoryModal
          entityType={entityType}
          entityId={entityId}
          entityName={entityName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
