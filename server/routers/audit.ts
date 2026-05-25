import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc/trpc";
import { AUDITED_ENTITY_TYPES } from "@/lib/audit";

// Audit log read API.
//
// `listForEntity` — the History modal off a single card / person /
// contract row. Chronological newest-first, no actor filter (the user IS
// allowed to see their own actions in the history of an entity they're
// looking at). Capped at 200 entries — at 4-8 users per phase the
// per-card audit volume is in the low tens.
//
// `listForUser` — the bell dropdown feed. Returns the most recent N
// audit events that "affect" the current user. Affects = a Card where
// the user is the assignee on either side of the change (assigned to me,
// reassigned away from me) OR a Person row where the user is the subject
// (someone changed my role / color / etc). Self-actions are filtered out
// — you don't notify yourself.
//
// `unreadCount` — the bell badge. Same WHERE clause as listForUser but
// gated to events newer than the viewer's `Person.lastSeenAt`. Reads as
// COUNT(*) so opening the bell doesn't trigger a payload-heavy refetch
// just to render a number. `prefs.markRead` bumps lastSeenAt to now(),
// at which point unreadCount returns 0 until the next NOTIFY arrives.
//
// Why two queries instead of one with conditional filtering: the bell
// badge fires on every SSE event (cheap COUNT query, ~1ms) while the
// dropdown only fetches when the user opens it (heavier payload with
// includes). Splitting keeps the hot path tiny.

const entityTypeSchema = z.enum(AUDITED_ENTITY_TYPES);
const cuidSchema = z.string().min(1);

const listForEntityInput = z.object({
  entityType: entityTypeSchema,
  entityId: cuidSchema,
});

const ACTOR_SELECT = { id: true, name: true, color: true } as const;

// "Affecting current user" WHERE clause. Reused by listForUser and
// unreadCount so the badge can never drift from the dropdown contents.
function affectsUserWhere(userId: string, since?: Date) {
  return {
    actorId: { not: userId }, // don't notify yourself
    ...(since ? { createdAt: { gt: since } } : {}),
    OR: [
      // Cards the user was assigned to before the change
      {
        entityType: "Card" as const,
        before: { path: ["assigneeId"], equals: userId },
      },
      // Cards the user is assigned to after the change
      {
        entityType: "Card" as const,
        after: { path: ["assigneeId"], equals: userId },
      },
      // Direct changes to the user's own Person row
      {
        entityType: "Person" as const,
        entityId: userId,
      },
    ],
  };
}

export const auditRouter = router({
  listForEntity: protectedProcedure
    .input(listForEntityInput)
    .query(async ({ ctx, input }) => {
      return ctx.db.auditLog.findMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
        include: { actor: { select: ACTOR_SELECT } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }),

  listForUser: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.auditLog.findMany({
      where: affectsUserWhere(ctx.userId),
      include: { actor: { select: ACTOR_SELECT } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.person.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { lastSeenAt: true },
    });
    // Fresh accounts have no lastSeenAt — fall back to a 7-day window so
    // the badge doesn't blow up with the entire history on first sign-in.
    const since =
      me.lastSeenAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return ctx.db.auditLog.count({
      where: affectsUserWhere(ctx.userId, since),
    });
  }),
});
