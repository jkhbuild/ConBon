import { router, publicProcedure } from "@/lib/trpc/trpc";

// Contracts router (read-only in Phase 3).
//
// `contracts.list` returns active contracts sorted by code (e.g.
// "B41207" < "H29183" < "N36054" < "V52461"), which is the same order
// the prototype's contract filter chip row renders in.

export const contractsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.contract.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
  }),
});
