import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  protectedProcedure,
  commercialManagerProcedure,
} from "@/lib/trpc/trpc";
import { writeAudit } from "@/lib/audit";

// Blockers router — post-v1.
//
// A Blocker is a sidecar to Card.blockerNote (1:1). The cards.update
// $transaction creates / deletes the sidecar when blockerNote toggles
// between null and non-null, so the canonical "is there a blocker?"
// state lives on Card. This router owns the *triage* state that has no
// meaning on Card itself:
//   - `acknowledge` / `unacknowledge` (commercialManagerProcedure):
//        flip Blocker.acknowledgedAt — null = red in the CM column,
//        set = green ("I've seen this").
//   - `clear` (protectedProcedure, with in-resolver raiser/Admin gate):
//        hard-delete the Blocker AND null out Card.blockerNote. Single
//        write goes through Card.update so the audit + sidecar-sync
//        path is the same whether the user clicked the right-click
//        "Clear blocker" or just blanked the textarea in the modal.
//
// `list` is `protectedProcedure` (any signed-in user) because the
// blocker cards render inside the CM's column on the board, which all
// roles already see. Mutations are gated.

const idInput = z.object({ id: z.string().min(1) });

const BLOCKER_INCLUDE = {
  card: { include: { contract: true, assignee: true } },
  raisedBy: true,
  acknowledgedBy: true,
} as const;

export const blockersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.blocker.findMany({
      include: BLOCKER_INCLUDE,
      orderBy: { raisedAt: "asc" },
    });
  }),

  acknowledge: commercialManagerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const before = await tx.blocker.findUniqueOrThrow({
          where: { id: input.id },
        });
        const after = await tx.blocker.update({
          where: { id: input.id },
          data: {
            acknowledgedAt: new Date(),
            acknowledgedById: ctx.userId,
          },
          include: BLOCKER_INCLUDE,
        });
        await writeAudit(tx, {
          actorId: ctx.userId,
          entityType: "Blocker",
          entityId: input.id,
          action: "update",
          before,
          after,
        });
        return after;
      });
    }),

  unacknowledge: commercialManagerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const before = await tx.blocker.findUniqueOrThrow({
          where: { id: input.id },
        });
        const after = await tx.blocker.update({
          where: { id: input.id },
          data: { acknowledgedAt: null, acknowledgedById: null },
          include: BLOCKER_INCLUDE,
        });
        await writeAudit(tx, {
          actorId: ctx.userId,
          entityType: "Blocker",
          entityId: input.id,
          action: "update",
          before,
          after,
        });
        return after;
      });
    }),

  clear: protectedProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const blocker = await tx.blocker.findUniqueOrThrow({
          where: { id: input.id },
        });
        // Raiser OR Admin only. Commercial Manager has acknowledge / unack
        // but can't hard-delete unless they raised it themselves.
        if (ctx.role !== "ADMIN" && blocker.raisedById !== ctx.userId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const cardBefore = await tx.card.findUniqueOrThrow({
          where: { id: blocker.cardId },
          include: { assignee: true, contract: true },
        });
        // Single source of truth: null the Card.blockerNote and the
        // Blocker row dies with it (cards.update's sidecar-sync branch
        // would delete it, but cascade FK + explicit deleteMany here
        // makes the order-of-operations trivial). Also writes the Card
        // audit row so History tells the same story regardless of
        // whether the user cleared via the textarea or the right-click.
        const cardAfter = await tx.card.update({
          where: { id: blocker.cardId },
          data: { blockerNote: null },
          include: { assignee: true, contract: true },
        });
        await tx.blocker.deleteMany({ where: { id: input.id } });
        await writeAudit(tx, {
          actorId: ctx.userId,
          entityType: "Card",
          entityId: blocker.cardId,
          action: "update",
          before: cardBefore,
          after: cardAfter,
        });
        return { id: input.id };
      });
    }),
});
