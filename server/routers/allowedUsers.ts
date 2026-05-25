import { z } from "zod";
import { Role } from "@prisma/client";
import { router, managerProcedure } from "@/lib/trpc/trpc";

// AllowedUser router — gates who can sign in via the NextAuth signIn
// callback (auth.ts checks AllowedUser.email).
//
// All procedures are `managerProcedure`. Per the role table: Admin tier
// can edit People + Contracts but NOT the allowlist; only Manager decides
// who is allowed to sign in (the access-control surface itself).
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
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.allowedUser.findMany({
      include: {
        addedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  add: managerProcedure.input(addInput).mutation(async ({ ctx, input }) => {
    return ctx.db.allowedUser.create({
      data: {
        email: input.email,
        role: input.role,
        addedById: ctx.userId,
      },
    });
  }),

  remove: managerProcedure.input(removeInput).mutation(async ({ ctx, input }) => {
    return ctx.db.allowedUser.delete({ where: { id: input.id } });
  }),
});
