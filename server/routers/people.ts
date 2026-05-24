import { router, protectedProcedure } from "@/lib/trpc/trpc";

// People router (read-only in Phase 3 — gated to signed-in users in
// Phase 7).
//
// `people.list` returns active people sorted by name — the order the
// board column headers will render in. Inactive people are hidden by
// default; an admin "include inactive" toggle lands in Phase 9.

export const peopleRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.person.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }),
});
