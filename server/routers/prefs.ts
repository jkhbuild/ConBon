import { router, protectedProcedure } from "@/lib/trpc/trpc";

// User preferences router.
//
// Phase 10 — `markRead` only. Bumps Person.lastSeenAt to now(); the bell
// badge (audit.unreadCount) collapses to 0 on the next read. Fires on
// dropdown open in the Header, so the user clears the badge by acting
// on it (no separate "Mark all read" affordance).
//
// Phase 11 will extend this router with `get` / `set` for theme and
// layout once UserPreference moves off localStorage into the DB.
//
// `protectedProcedure` — every user manages their own prefs; there's no
// admin-edits-someone-else's-prefs flow, so the procedure ladder doesn't
// need ADMIN/MANAGER tiers here. ctx.userId is the only id we accept.

export const prefsRouter = router({
  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.person.update({
      where: { id: ctx.userId },
      data: { lastSeenAt: new Date() },
      select: { id: true, lastSeenAt: true },
    });
  }),
});
