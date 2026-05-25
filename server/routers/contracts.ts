import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "@/lib/trpc/trpc";
import { isPaletteHex } from "@/lib/palette";

// Contracts router.
//
// `list` (Phase 3) returns active contracts only — used by the new-card
// modal's contract picker and the board's contract filter chips.
// `listAll` (Phase 9) includes inactives for the Admin UI.
//
// Mutations (Phase 9) are `adminProcedure`. Code matches the prototype's
// shape: 1 uppercase letter + 5 digits (e.g. N36054). Color is optional;
// when set it must come from the shared palette.
//
// Deactivate just flips `active`. Existing cards keep their `contractId`
// (the relation has onDelete: Restrict so the row can't be removed), and
// `cards.list` joins the Contract row unconditionally, so the contract
// chip on existing cards keeps rendering — the contract just disappears
// from the new-card picker and the filter chip row.

const cuidSchema = z.string().min(1);
const nameSchema = z.string().min(1).max(120);
const codeSchema = z
  .string()
  .regex(/^[A-Z]\d{5}$/, {
    message: "Code must be one uppercase letter + five digits, e.g. N36054",
  });

const paletteHexSchema = z
  .string()
  .refine(isPaletteHex, { message: "Color must be one of the palette swatches" });

const contractCreateInput = z.object({
  code: codeSchema,
  name: nameSchema,
  color: paletteHexSchema.nullable().optional(),
});

const contractUpdateInput = z.object({
  id: cuidSchema,
  code: codeSchema.optional(),
  name: nameSchema.optional(),
  color: paletteHexSchema.nullable().optional(),
});

const idInput = z.object({ id: cuidSchema });

export const contractsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.contract.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
  }),

  listAll: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.contract.findMany({
      orderBy: [{ active: "desc" }, { code: "asc" }],
    });
  }),

  create: adminProcedure.input(contractCreateInput).mutation(async ({ ctx, input }) => {
    return ctx.db.contract.create({
      data: {
        code: input.code,
        name: input.name,
        color: input.color ?? null,
      },
    });
  }),

  update: adminProcedure.input(contractUpdateInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;
    return ctx.db.contract.update({
      where: { id },
      data: patch,
    });
  }),

  deactivate: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    return ctx.db.contract.update({
      where: { id: input.id },
      data: { active: false },
    });
  }),

  reactivate: adminProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    return ctx.db.contract.update({
      where: { id: input.id },
      data: { active: true },
    });
  }),
});
