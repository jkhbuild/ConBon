import { router, publicProcedure } from "@/lib/trpc/trpc";

// People router (read-only in Phase 3).
//
// `people.list` returns active people sorted by name — the order the
// board column headers will render in. Inactive people are hidden by
// default; an admin "include inactive" toggle lands in Phase 7.

export const peopleRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.person.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }),
});
