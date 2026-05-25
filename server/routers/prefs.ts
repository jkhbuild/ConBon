import { z } from "zod";
import { router, protectedProcedure } from "@/lib/trpc/trpc";

// User preferences router.
//
// Phase 10 — `markRead` only. Bumps Person.lastSeenAt to now(); the bell
// badge (audit.unreadCount) collapses to 0 on the next read. Fires on
// dropdown open in the Header, so the user clears the badge by acting
// on it (no separate "Mark all read" affordance).
//
// Phase 11 — `get` and `set` for theme + layout. UserPreference rows are
// created lazily: `get` returns schema defaults when the row is missing
// rather than inserting one, and `set` upserts. This keeps the read path
// pure and avoids materializing a row for users who never change anything.
//
// `protectedProcedure` throughout — every user manages their own prefs.
// There's no admin-edits-someone-else's-prefs flow, so the procedure
// ladder doesn't need ADMIN/MANAGER tiers here; ctx.userId is the only
// id we accept.

// Valid theme + layout values. Strings (not Prisma enums) at the schema
// layer because theme is expected to grow (bold-noir, bold-forest, etc.)
// without requiring a migration each time; validation lives here.
const themeSchema = z.enum(["soft", "bold"]);
const layoutSchema = z.enum(["columns", "swimlanes"]);

const DEFAULT_THEME = "soft";
const DEFAULT_LAYOUT = "columns";

const setInputSchema = z
  .object({
    theme: themeSchema.optional(),
    layout: layoutSchema.optional(),
  })
  .refine((v) => v.theme !== undefined || v.layout !== undefined, {
    message: "At least one of `theme` or `layout` must be provided",
  });

export const prefsRouter = router({
  markRead: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.db.person.update({
      where: { id: ctx.userId },
      data: { lastSeenAt: new Date() },
      select: { id: true, lastSeenAt: true },
    });
  }),

  // Lazy read: no row → return defaults. Callers always get a fully
  // populated { theme, layout } regardless of insertion state.
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.userPreference.findUnique({
      where: { userId: ctx.userId },
      select: { theme: true, layout: true },
    });
    return {
      theme: row?.theme ?? DEFAULT_THEME,
      layout: row?.layout ?? DEFAULT_LAYOUT,
    };
  }),

  set: protectedProcedure.input(setInputSchema).mutation(async ({ ctx, input }) => {
    return ctx.db.userPreference.upsert({
      where: { userId: ctx.userId },
      // On create, only the explicitly-provided fields override the
      // schema defaults; the other side stays at its Prisma @default.
      create: {
        userId: ctx.userId,
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.layout !== undefined ? { layout: input.layout } : {}),
      },
      update: {
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.layout !== undefined ? { layout: input.layout } : {}),
      },
      select: { theme: true, layout: true },
    });
  }),
});
