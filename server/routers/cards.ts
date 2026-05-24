import { router, publicProcedure } from "@/lib/trpc/trpc";

// Cards router (read-only in Phase 3).
//
// `cards.list` returns active cards (archivedAt IS NULL) sorted by the
// (assigneeId, position) shape the partial index supports — that's the
// dominant board query. Nulls (Backlog) come first via NULLS FIRST.
// Assignee + contract relations are included so the board UI can render
// chips without an N+1.
//
// Grouping by column is left to the UI: a flat sorted array keeps the
// API shape simple and the same payload powers both the column and
// swimlane layouts in Phase 5.

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
});
