import type { AuditAction, AuditEntityType } from "@/lib/audit";

// Audit event presentation layer.
//
// Two surfaces consume audit rows:
//
//   HistoryModal — per-entity timeline. Wants per-event summary lines
//   ("Alice moved to In Progress") and per-event field diffs ("Title:
//   Estimate steel package → Estimate steel + concrete"). diff() returns
//   the diff rows; summarize() returns the one-line headline.
//
//   Bell + Toast — viewer-relative feed. Wants short, second-person
//   phrasing ("Alice assigned a card to you"). viewerSummary(event,
//   viewerId) handles that.
//
// before/after are stored as JSON in the AuditLog row (Date → ISO
// string). Renderers parse strings back where they need to (e.g.
// formatShort for dueDate). Untyped Record access is intentional —
// the JSON column is the source of truth, and rigid typing here would
// have to track every schema change anyway.

export type AuditActorSummary = {
  id: string;
  name: string;
  color: string;
};

export type AuditEventRow = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before: unknown;
  after: unknown;
  actor: AuditActorSummary | null;
  createdAt: Date;
};

export type DiffLine = {
  field: string;
  label: string;
  before: string;
  after: string;
};

// ----- field formatters --------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function fmtDate(value: unknown): string {
  if (value == null) return "—";
  if (typeof value !== "string" && !(value instanceof Date)) return String(value);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return DATE_FORMATTER.format(d);
}

function fmtBool(value: unknown, trueLabel: string, falseLabel: string): string {
  if (value === true) return trueLabel;
  if (value === false) return falseLabel;
  return "—";
}

function fmtRole(value: unknown): string {
  if (value === "ANALYST") return "Analyst";
  if (value === "ESTIMATOR") return "Estimator";
  if (value === "SCHEDULER") return "Scheduler";
  if (value === "COMMERCIAL_MANAGER") return "Commercial Manager";
  if (value === "ADMIN") return "Admin";
  return value == null ? "—" : String(value);
}

function fmtPriority(value: unknown): string {
  if (value == null) return "Auto (from age)";
  if (typeof value === "number") return String(value);
  return String(value);
}

function fmtText(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

// Embedded relation accessors — match the cards.list include shape.
function assigneeLabel(rec: Record<string, unknown> | null): string {
  if (!rec) return "—";
  const assignee = asRecord(rec.assignee);
  if (assignee?.name) return String(assignee.name);
  if (rec.assigneeId == null) return "Backlog";
  return "—";
}

function contractLabel(rec: Record<string, unknown> | null): string {
  if (!rec) return "—";
  const contract = asRecord(rec.contract);
  if (contract?.code) return String(contract.code);
  return "—";
}

// ----- per-entity field config -------------------------------------------

type FieldConfig = {
  key: string;
  label: string;
  // Pull the comparable value out of a row record. Defaults to rec[key]
  // when omitted; assignee / contract use richer lookups.
  pick?: (rec: Record<string, unknown> | null) => unknown;
  format: (value: unknown, rec: Record<string, unknown> | null) => string;
};

const CARD_FIELDS: FieldConfig[] = [
  { key: "title", label: "Title", format: fmtText },
  {
    key: "assigneeId",
    label: "Assignee",
    format: (_v, rec) => assigneeLabel(rec),
  },
  {
    key: "contractId",
    label: "Contract",
    format: (_v, rec) => contractLabel(rec),
  },
  { key: "type", label: "Type", format: fmtText },
  { key: "assignmentDate", label: "Assignment date", format: fmtDate },
  { key: "dueDate", label: "Due date", format: fmtDate },
  {
    key: "priorityOverride",
    label: "Priority",
    format: fmtPriority,
  },
  { key: "blockerNote", label: "Blocker note", format: fmtText },
  { key: "archivedAt", label: "Archived at", format: fmtDate },
  { key: "position", label: "Position", format: (v) => (v == null ? "—" : String(v)) },
];

const PERSON_FIELDS: FieldConfig[] = [
  { key: "name", label: "Name", format: fmtText },
  { key: "email", label: "Email", format: fmtText },
  { key: "role", label: "Role", format: fmtRole },
  { key: "color", label: "Color", format: fmtText },
  {
    key: "active",
    label: "Status",
    format: (v) => fmtBool(v, "Active", "Inactive"),
  },
];

const CONTRACT_FIELDS: FieldConfig[] = [
  { key: "code", label: "Code", format: fmtText },
  { key: "name", label: "Name", format: fmtText },
  { key: "color", label: "Color", format: fmtText },
  {
    key: "active",
    label: "Status",
    format: (v) => fmtBool(v, "Active", "Inactive"),
  },
];

const ALLOWED_USER_FIELDS: FieldConfig[] = [
  { key: "email", label: "Email", format: fmtText },
  { key: "role", label: "Role", format: fmtRole },
];

const FIELDS_BY_ENTITY: Record<AuditEntityType, FieldConfig[]> = {
  Card: CARD_FIELDS,
  Person: PERSON_FIELDS,
  Contract: CONTRACT_FIELDS,
  AllowedUser: ALLOWED_USER_FIELDS,
};

// ----- public API --------------------------------------------------------

export function diff(event: AuditEventRow): DiffLine[] {
  const before = asRecord(event.before);
  const after = asRecord(event.after);
  const fields = FIELDS_BY_ENTITY[event.entityType] ?? [];

  const lines: DiffLine[] = [];
  for (const field of fields) {
    const pick = field.pick ?? ((rec: Record<string, unknown> | null) => rec?.[field.key]);
    const beforeRaw = pick(before);
    const afterRaw = pick(after);
    const beforeFmt = field.format(beforeRaw, before);
    const afterFmt = field.format(afterRaw, after);
    if (beforeFmt === afterFmt) continue;
    lines.push({
      field: field.key,
      label: field.label,
      before: beforeFmt,
      after: afterFmt,
    });
  }
  return lines;
}

const ACTION_VERB: Record<AuditAction, string> = {
  create: "created",
  update: "edited",
  move: "moved",
  archive: "archived",
  restore: "restored",
  deactivate: "deactivated",
  reactivate: "reactivated",
  delete: "removed",
};

function entityLabel(event: AuditEventRow): string {
  const rec = asRecord(event.after) ?? asRecord(event.before);
  if (!rec) return event.entityType.toLowerCase();
  switch (event.entityType) {
    case "Card":
      return rec.title ? `"${rec.title}"` : "card";
    case "Person":
      return (rec.name as string) ?? "person";
    case "Contract":
      return (rec.code as string) ?? "contract";
    case "AllowedUser":
      return (rec.email as string) ?? "allowlist entry";
  }
}

// Per-entity timeline summary — "Alice moved \"Re-estimate steel\"".
export function summarize(event: AuditEventRow): string {
  const who = event.actor?.name ?? "System";
  const verb = ACTION_VERB[event.action];
  const what = entityLabel(event);
  return `${who} ${verb} ${what}`;
}

// Viewer-relative phrasing — "Alice assigned a card to you". Returns
// null when the event isn't worth surfacing in the viewer's bell (e.g.
// a self-action that slipped past the server filter, or a Card change
// that didn't touch this viewer's slot).
export function viewerSummary(
  event: AuditEventRow,
  viewerId: string,
): string | null {
  if (event.actor?.id === viewerId) return null;
  const who = event.actor?.name ?? "Someone";

  if (event.entityType === "Card") {
    const before = asRecord(event.before);
    const after = asRecord(event.after);
    const beforeAssignee = before?.assigneeId ?? null;
    const afterAssignee = after?.assigneeId ?? null;
    const wasMine = beforeAssignee === viewerId;
    const isMine = afterAssignee === viewerId;
    const title = (after?.title ?? before?.title ?? "a card") as string;
    const quoted = `"${title}"`;

    if (event.action === "move") {
      if (!wasMine && isMine) return `${who} assigned ${quoted} to you`;
      if (wasMine && !isMine) return `${who} reassigned ${quoted} away from you`;
      if (wasMine && isMine) return `${who} reordered ${quoted}`;
      return null;
    }
    if (event.action === "create") {
      if (isMine) return `${who} created ${quoted} for you`;
      return null;
    }
    if (event.action === "archive") {
      if (wasMine) return `${who} archived your card ${quoted}`;
      return null;
    }
    if (event.action === "restore") {
      if (isMine) return `${who} restored ${quoted} to you`;
      return null;
    }
    if (event.action === "update") {
      if (isMine || wasMine) return `${who} edited ${quoted}`;
      return null;
    }
  }

  if (event.entityType === "Person" && event.entityId === viewerId) {
    if (event.action === "deactivate") return `${who} deactivated your account`;
    if (event.action === "reactivate") return `${who} reactivated your account`;
    if (event.action === "update") {
      const before = asRecord(event.before);
      const after = asRecord(event.after);
      if (before?.role !== after?.role && after?.role) {
        return `${who} changed your role to ${fmtRole(after.role)}`;
      }
      return `${who} updated your profile`;
    }
  }

  return null;
}
