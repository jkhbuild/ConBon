import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TaskType } from "@prisma/client";
import { router, protectedProcedure } from "@/lib/trpc/trpc";

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
// strict ownership: Employees can only move / update / archive / restore
// cards assigned to them. Admin + Manager can touch any. Backlog cards
// (assigneeId IS NULL) are not "owned" by anyone, so Employees can't
// claim them directly — Admin/Manager assigns them out.

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

// True when the role lacks the privilege to mutate a card not owned by
// the current user. Admin + Manager bypass the ownership check.
function isEmployee(role: "EMPLOYEE" | "ADMIN" | "MANAGER"): boolean {
  return role === "EMPLOYEE";
}

export const cardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: null },
      include: {
        assignee: true,
        contract: true,
      },
      orderBy: [{ assigneeId: { sort: "asc", nulls: "first" } }, { position: "asc" }],
    });
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: { not: null } },
      include: {
        assignee: true,
        contract: true,
      },
      orderBy: { archivedAt: "desc" },
    });
  }),

  move: protectedProcedure.input(cardMoveInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const card = await tx.card.findUnique({ where: { id: input.id } });
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (card.archivedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot move an archived card" });
      }
      if (isEmployee(ctx.role) && card.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
      return tx.card.update({
        where: { id: input.id },
        data: {
          assigneeId: input.toAssigneeId,
          position: input.toPosition,
        },
        include: { assignee: true, contract: true },
      });
    });
  }),

  update: protectedProcedure.input(cardUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    if (isEmployee(ctx.role)) {
      const card = await ctx.db.card.findUnique({
        where: { id },
        select: { assigneeId: true },
      });
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (card.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
    }
    return ctx.db.card.update({
      where: { id },
      data: patch,
      include: { assignee: true, contract: true },
    });
  }),

  create: protectedProcedure.input(cardCreateInput).mutation(async ({ ctx, input }) => {
    const today = new Date();
    const fourteenDaysOut = new Date(today);
    fourteenDaysOut.setDate(fourteenDaysOut.getDate() + 14);

    // Append to the end of the destination bucket (Backlog if assigneeId is null).
    const tail = await ctx.db.card.findFirst({
      where: { assigneeId: input.assigneeId, archivedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (tail?.position ?? 0) + 1024;

    return ctx.db.card.create({
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
      include: { assignee: true, contract: true },
    });
  }),

  archive: protectedProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    if (isEmployee(ctx.role)) {
      const card = await ctx.db.card.findUnique({
        where: { id: input.id },
        select: { assigneeId: true },
      });
      if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
      if (card.assigneeId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
      }
    }
    return ctx.db.card.update({
      where: { id: input.id },
      data: { archivedAt: new Date() },
      include: { assignee: true, contract: true },
    });
  }),

  restore: protectedProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    // Restored cards go to the end of their assignee bucket — position may
    // have collided with an active card while this one was archived.
    const card = await ctx.db.card.findUniqueOrThrow({ where: { id: input.id } });
    if (isEmployee(ctx.role) && card.assigneeId !== ctx.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your card" });
    }
    const tail = await ctx.db.card.findFirst({
      where: { assigneeId: card.assigneeId, archivedAt: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (tail?.position ?? 0) + 1024;

    return ctx.db.card.update({
      where: { id: input.id },
      data: { archivedAt: null, position },
      include: { assignee: true, contract: true },
    });
  }),
});
