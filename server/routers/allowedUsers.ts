import { z } from "zod";
import { Role } from "@prisma/client";
import { router, adminProcedure } from "@/lib/trpc/trpc";
import { writeAudit } from "@/lib/audit";

// AllowedUser router — gates who can sign in via the NextAuth signIn
// callback (auth.ts checks AllowedUser.email).
//
// All procedures are `adminProcedure`. Per the role table: Commercial
// Manager can edit People + Contracts but NOT the allowlist; only Admin
// decides who is allowed to sign in (the access-control surface itself).
//
// `remove` only deletes the AllowedUser row — it does NOT deactivate the
// matching Person or invalidate live sessions. A removed user's existing
// JWT keeps working until expiry (the JWT carries the resolved Person.id
// + Role; we don't re-check the allowlist per request). On next sign-in
// the gate trips and they're rejected. To revoke immediately, also
// deactivate the matching Person via the People admin page.
//
// Email is case-folded + trimmed on insert (same shape as the signIn
// callback's lookup) so the unique constraint catches duplicates by the
// caller's intent rather than by punctuation.
//
// Phase 10 — add / remove write AuditLog rows. Phase 8's NOTIFY triggers
// still don't fire on AllowedUser (deliberate — change cadence is low and
// removed users have to re-attempt sign-in anyway), but the audit trail
// captures who granted/revoked access for compliance.

const cuidSchema = z.string().min(1);
const emailSchema = z
  .string()
  .email()
  .transform((v) => v.toLowerCase().trim());

const addInput = z.object({
  email: emailSchema,
  role: z.nativeEnum(Role),
});

const removeInput = z.object({ id: cuidSchema });

export const allowedUsersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.allowedUser.findMany({
      include: {
        addedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  add: adminProcedure.input(addInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const created = await tx.allowedUser.create({
        data: {
          email: input.email,
          role: input.role,
          addedById: ctx.userId,
        },
      });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "AllowedUser",
        entityId: created.id,
        action: "create",
        before: null,
        after: created,
      });
      return created;
    });
  }),

  remove: adminProcedure.input(removeInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async (tx) => {
      const before = await tx.allowedUser.findUniqueOrThrow({ where: { id: input.id } });
      const deleted = await tx.allowedUser.delete({ where: { id: input.id } });
      await writeAudit(tx, {
        actorId: ctx.userId,
        entityType: "AllowedUser",
        entityId: input.id,
        action: "delete",
        before,
        after: null,
      });
      return deleted;
    });
  }),
});
