import { z } from "zod";
import { TaskType } from "@prisma/client";
import { router, publicProcedure } from "@/lib/trpc/trpc";

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
// Phase 6 — mutations use `publicProcedure` with a TODO. Phase 7 swaps
// these to `protectedProcedure` and adds per-row ownership checks
// (Employee → own cards only; Admin / Manager → any).

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

export const cardsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: null },
      include: {
        assignee: true,
        contract: true,
      },
      orderBy: [{ assigneeId: { sort: "asc", nulls: "first" } }, { position: "asc" }],
    });
  }),

  listArchived: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.card.findMany({
      where: { archivedAt: { not: null } },
      include: {
        assignee: true,
        contract: true,
      },
      orderBy: { archivedAt: "desc" },
    });
  }),

  // TODO(phase-7): protectedProcedure + ownership check
  move: publicProcedure.input(cardMoveInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const card = await tx.card.findUnique({ where: { id: input.id } });
      if (!card) throw new Error("Card not found");
      if (card.archivedAt) throw new Error("Cannot move an archived card");
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

  // TODO(phase-7): protectedProcedure + ownership check
  update: publicProcedure.input(cardUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    return ctx.db.card.update({
      where: { id },
      data: patch,
      include: { assignee: true, contract: true },
    });
  }),

  // TODO(phase-7): protectedProcedure (any signed-in user can create)
  create: publicProcedure.input(cardCreateInput).mutation(async ({ ctx, input }) => {
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

  // TODO(phase-7): protectedProcedure + ownership check
  archive: publicProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    return ctx.db.card.update({
      where: { id: input.id },
      data: { archivedAt: new Date() },
      include: { assignee: true, contract: true },
    });
  }),

  // TODO(phase-7): protectedProcedure + ownership check
  restore: publicProcedure.input(cardIdInput).mutation(async ({ ctx, input }) => {
    // Restored cards go to the end of their assignee bucket — position may
    // have collided with an active card while this one was archived.
    const card = await ctx.db.card.findUniqueOrThrow({ where: { id: input.id } });
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
