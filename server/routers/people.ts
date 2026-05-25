import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { router, protectedProcedure, adminProcedure } from "@/lib/trpc/trpc";
import { isPaletteHex, PALETTE_DEFAULT_HEX } from "@/lib/palette";
import { writeAudit } from "@/lib/audit";

// People router.
//
// `list` (Phase 3) returns active people only — the board column headers
// render in name order. `listAll` (Phase 9) includes inactives, active
// first then name, so the Admin UI can show + reactivate them.
//
// Mutations (Phase 9) are all `adminProcedure` — both Admin and Manager
// can edit People. Color is constrained to the shared palette; the default
// gray (#888888) stamped by the auth signIn callback is also accepted so
// freshly-onboarded users with no admin-assigned swatch can be updated
// without a phantom palette-check failure.
//
// Deactivate is transactional: the person's active cards are reassigned
// to Backlog (assigneeId = null) so they don't end up orphaned (cards.list
// still returns them but their column is gone, since people.list filters
// to active). Archived cards keep their assignee for the History view.
//
// Phase 10 — every mutation writes an AuditLog row via writeAudit inside
// the same $transaction. Deactivate also emits a synthetic Card `move`
// audit for each card reassigned to Backlog so the History view on a
// reassigned card shows the cause ("System reassigned to Backlog when
// Alice was deactivated" rendered from action=move + actor + diff).

const cuidSchema = z.string().min(1);
const roleSchema = z.nativeEnum(Role);
const nameSchema = z.string().min(1).max(120);

const paletteHexSchema = z
  .string()
  .refine((v) => isPaletteHex(v) || v === PALETTE_DEFAULT_HEX, {
    message: "Color must be one of the palette swatches",
  });

const emailSchema = z
  .string()
  .email()
  .transform((v) => v.toLowerCase().trim());

const peopleCreateInput = z.object({
  name: nameSchema,
  email: emailSchema.optional(),
  role: roleSchema,
  color: paletteHexSchema,
});

const peopleUpdateInput = z.object({
  id: cuidSchema,
  name: nameSchema.optional(),
  email: emailSchema.nullable().optional(),
  role: roleSchema.optional(),
  color: paletteHexSchema.optional(),
});

const idInput = z.object({ id: cuidSchema });

const CARD_INCLUDE = { assignee: true, contract: true } as const;

export const peopleRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.person.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.person.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }),

  create: adminProcedure.input(peopleCreateInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const created = await tx.person.create({
        data: {
          name: input.name,
          email: input.email ?? null,
          role: input.role,
          color: input.color,
        },
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Person",
        entityId: created.id,
        action: "create",
        before: null,
        after: created,
      });
      return created;
    });
  }),

  update: adminProcedure.input(peopleUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    // Role promote/demote is Manager-only — Admin can edit name / email /
    // color but not change someone's tier. The Phase 9 People admin UI
    // hides the role select from Admin viewers, but enforce here too so
    // a hand-crafted request can't sneak through.
    if (patch.role !== undefined && ctx.role !== "MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Manager can change roles",
      });
    }
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.person.findUniqueOrThrow({ where: { id } });
      const after = await tx.person.update({ where: { id }, data: patch });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Person",
        entityId: id,
        action: "update",
        before,
        after,
      });
      return after;
    });
  }),

  deactivate: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.person.findUniqueOrThrow({ where: { id: input.id } });
      // Snapshot the cards that are about to be reassigned so we can emit
      // a per-card audit entry. The History view on those cards explains
      // the surprise reassignment ("now in Backlog") via the same action
      // shape as a real drag-move, just with the deactivator as actor.
      const affectedCards = await tx.card.findMany({
        where: { assigneeId: input.id, archivedAt: null },
        include: CARD_INCLUDE,
      });
      if (affectedCards.length > 0) {
        await tx.card.updateMany({
          where: { assigneeId: input.id, archivedAt: null },
          data: { assigneeId: null },
        });
        for (const card of affectedCards) {
          await writeAudit(tx, {
            actorId: ctx.userId,
            entityType: "Card",
            entityId: card.id,
            action: "move",
            before: card,
            after: { ...card, assigneeId: null, assignee: null },
          });
        }
      }
      const after = await tx.person.update({
        where: { id: input.id },
        data: { active: false },
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Person",
        entityId: input.id,
        action: "deactivate",
        before,
        after,
      });
      return { person: after, reassignedCount: affectedCards.length };
    });
  }),

  reactivate: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.person.findUniqueOrThrow({ where: { id: input.id } });
      const after = await tx.person.update({
        where: { id: input.id },
        data: { active: true },
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "Person",
        entityId: input.id,
        action: "reactivate",
        before,
        after,
      });
      return after;
    });
  }),
});
