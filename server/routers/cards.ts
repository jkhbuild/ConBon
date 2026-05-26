import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TaskType, type Role } from "@prisma/client";
import { router, protectedProcedure } from "@/lib/trpc/trpc";
import { writeAudit } from "@/lib/audit";

// Cards router.
//
// `cards.list` returns active cards (archivedAt IS NULL) sorted by the
// (assigneeId, position) shape the partial index supports — that's the
// dominant board query. Nulls (Backlog) come first via NULLS FIRST.
// Assignee + contract relations are included so the board UI can render
// chips without an N+1.
//
// Grouping by column is left to the UI: a flat sorted array keeps the
// API shape simple and the same payload powers both the column and
// swimlane layouts.
//
// Phase 7 — every procedure is `protectedProcedure` (signed-in users
// only). Mutations that touch a specific card additionally enforce
// strict ownership: bottom-tier roles (Analyst / Estimator / Scheduler)
// can only move / update / archive / restore cards assigned to them.
// Admin + Commercial Manager can touch any. Backlog cards (assigneeId
// IS NULL) are not "owned" by anyone, so bottom-tier users can't claim
// them directly — Admin / Commercial Manager assigns them out.
//
// Phase 10 — every mutation is wrapped in $transaction and writes an
// AuditLog row via writeAudit. The before/after rows are captured with
// the same `include: { assignee, contract }` shape returned to the
// client, so the History UI can resolve assignee/contract names from
// the audit row without an extra fetch.

const cuidSchema = z.string().min(1);
const taskTypeSchema = z.nativeEnum(TaskType);
const dateSchema = z.coerce.date();
const priorityOverrideSchema = z.number().int().min(1).max(5);

const cardCreateInput = z.object({
  title: z.string().min(1),
  contractId: cuidSchema,
  type: taskTypeSchema,
  assigneeId: cuidSchema.nullable().default(null),
  assignmentDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  priorityOverride: priorityOverrideSchema.nullable().optional(),
  blockerNote: z.string().nullable().optional(),
});

const cardUpdateInput = z.object({
  id: cuidSchema,
  title: z.string().min(1).optional(),
  contractId: cuidSchema.optional(),
  type: taskTypeSchema.optional(),
  assigneeId: cuidSchema.nullable().optional(),
  assignmentDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  priorityOverride: priorityOverrideSchema.nullable().optional(),
  blockerNote: z.string().nullable().optional(),
});

const cardMoveInput = z.object({
  id: cuidSchema,
  toAssigneeId: cuidSchema.nullable(),
  toPosition: z.number().int(),
});

const cardIdInput = z.object({ id: cuidSchema });

const CARD_INCLUDE = { assignee: true, contract: true } as const;

// True when the role lacks the privilege to mutate a card not owned by
// the current user. Admin + Commercial Manager bypass the ownership check.
function isBottomTier(role: Role): boolean {
  return role === "ANALYST" || role === "ESTIMATOR" || role === "SCHEDULER";
}

export const cardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: null },
      include: CARD_INCLUDE,
      orderBy: [{ assigneeId: { sort: "asc", nulls: "first" } }, { position: "asc" }],
    });
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: { not: null } },
      include: CARD_INCLUDE,
      orderBy: { archivedAt: "desc" },
    });
  }),

  move: protectedProcedure.input(cardMoveInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.card.findUnique({
        where: { id: input.id },
        include: CARD_INCLUDE,
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (before.archivedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot move an archived card" });
      }
      if (isBottomTier(ctx.role) && before.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
      const after = await tx.card.update({
        where: { id: input.id },
        data: {
          assigneeId: input.toAssigneeId,
          position: input.toPosition,
        },
        include: CARD_INCLUDE,
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Card",
        entityId: input.id,
        action: "move",
        before,
        after,
      });
      return after;
    });
  }),

  update: protectedProcedure.input(cardUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.card.findUnique({
        where: { id },
        include: CARD_INCLUDE,
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (isBottomTier(ctx.role) && before.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
      const after = await tx.card.update({
        where: { id },
        data: patch,
        include: CARD_INCLUDE,
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Card",
        entityId: id,
        action: "update",
        before,
        after,
      });
      return after;
    });
  }),

  create: protectedProcedure.input(cardCreateInput).mutation(async ({ ctx, input }) => {
    const today = new Date();
    const fourteenDaysOut = new Date(today);
    fourteenDaysOut.setDate(fourteenDaysOut.getDate() + 14);

    return ctx.db.$transaction(async (tx) => {
      // Append to the end of the destination bucket (Backlog if assigneeId is null).
      // Tail read lives in the same tx so a concurrent create can't pick
      // the same position.
      const tail = await tx.card.findFirst({
        where: { assigneeId: input.assigneeId, archivedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (tail?.position ?? 0) + 1024;

      const created = await tx.card.create({
        data: {
          title: input.title,
          contractId: input.contractId,
          type: input.type,
          assigneeId: input.assigneeId,
          assignmentDate: input.assignmentDate ?? today,
          dueDate: input.dueDate ?? fourteenDaysOut,
          priorityOverride: input.priorityOverride ?? null,
          blockerNote: input.blockerNote ?? null,
          position,
        },
        include: CARD_INCLUDE,
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Card",
        entityId: created.id,
        action: "create",
        before: null,
        after: created,
      });
      return created;
    });
  }),

  archive: protectedProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.card.findUnique({
        where: { id: input.id },
        include: CARD_INCLUDE,
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (isBottomTier(ctx.role) && before.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
      const after = await tx.card.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
        include: CARD_INCLUDE,
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Card",
        entityId: input.id,
        action: "archive",
        before,
        after,
      });
      return after;
    });
  }),

  restore: protectedProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    // Restored cards go to the end of their assignee bucket — position may
    // have collided with an active card while this one was archived.
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.card.findUniqueOrThrow({
        where: { id: input.id },
        include: CARD_INCLUDE,
      });
      if (isBottomTier(ctx.role) && before.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
      const tail = await tx.card.findFirst({
        where: { assigneeId: before.assigneeId, archivedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (tail?.position ?? 0) + 1024;

      const after = await tx.card.update({
        where: { id: input.id },
        data: { archivedAt: null, position },
        include: CARD_INCLUDE,
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Card",
        entityId: input.id,
        action: "restore",
        before,
        after,
      });
      return after;
    });
  }),
});
