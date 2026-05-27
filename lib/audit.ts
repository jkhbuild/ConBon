import { Prisma } from "@prisma/client";

// Audit log helper.
//
// Centralizes the AuditLog write shape so every mutation router can call
// `await writeAudit(tx, { ... })` inside its $transaction. Keeps the
// AuditAction / AuditEntityType unions in one place and normalizes
// before/after JSON (Prisma's InputJsonValue doesn't accept Date — we
// round-trip through JSON.stringify so Date becomes ISO string).
//
// Why an explicit helper instead of a transparent Prisma client extension:
// Prisma client extensions can't reliably reuse the caller's transactional
// client for auxiliary queries (the auditLog.create insert lands on a
// fresh connection, outside the surrounding $transaction, so it doesn't
// roll back with the underlying mutation). Calling writeAudit inside the
// router's own $transaction with the tx client keeps the mutation + audit
// row atomic, which the Phase 10 spec calls out as a hard requirement.
// The cost is one extra import + a writeAudit() line per mutation; the
// benefit is correctness under partial failure, which matters because the
// audit log is the only after-the-fact record of who changed what.

export const AUDITED_ENTITY_TYPES = ["Card", "Person", "Contract", "AllowedUser", "Blocker"] as const;
export type AuditEntityType = (typeof AUDITED_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "move",
  "archive",
  "restore",
  "deactivate",
  "reactivate",
  "delete",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Structural duck-type so both PrismaClient and Prisma.TransactionClient
// satisfy it — they each expose `auditLog.create()` with the same args.
// Avoids importing Prisma's internal TransactionClient type, which moves
// between Prisma majors.
type AuditCreator = {
  auditLog: {
    create: (args: Prisma.AuditLogCreateArgs) => Prisma.PrismaPromise<unknown>;
  };
};

export type AuditWriteInput = {
  actorId: string | null;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(tx: AuditCreator, input: AuditWriteInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: toJson(input.before),
      after: toJson(input.after),
    },
  });
}

// Prisma's InputJsonValue type rejects Date / BigInt / Buffer; mutation
// returns from include-laden Prisma queries contain Date everywhere
// (createdAt, dueDate, etc.). Round-trip through JSON.stringify so the
// shape becomes a plain InputJsonValue — Date → ISO string, undefined →
// dropped. Diff renderers on the read side parse the strings back.
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
