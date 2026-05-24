# Stack gotchas

Per-phase non-obvious findings that bit during implementation. Pointer from project [CLAUDE.md](../CLAUDE.md). Each bullet is generalizable — if the same stack ships in a future project, expect to hit the same trap.

## Phase 2 (Prisma 7, Postgres, Next 16)

- **Prisma 7 dropped `datasource.url`.** Validation error "datasource property `url` is no longer supported" means the URL goes in `prisma.config.ts` via `env("DATABASE_URL")` plus `import "dotenv/config"` at the top of that file. `env()` does NOT auto-load `.env`.
- **`prisma migrate diff` flag renamed.** `--from/to-schema-datamodel` is gone; use `--from-schema` / `--to-schema`.
- **Partial indexes need raw SQL.** Generate the base migration with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`, append the `CREATE INDEX ... WHERE ...` to the migration file, then apply.
- **`prisma db seed` reads `prisma.config.ts` `migrations.seed`**, not the old `package.json` `prisma.seed` field.

## Phase 4 (Next 16, next/font, eslint-config-next)

- **`next/font/google` requires network at build time.** It downloads + subsets the fonts during `next build`; offline machines fail. Cache survives across rebuilds. If a CI runner is air-gapped, swap to `next/font/local` and commit the woff2.
- **Pre-paint script needs `<html suppressHydrationWarning>`.** React would otherwise diff the server-rendered `<html>` (no `data-theme`) against the client DOM that the inline script has already mutated, and log a hydration warning. The suppression is scoped to the single attribute via React; it does not silence content mismatches inside children.
- **`eslint-config-next` doesn't ship `react/no-danger` or `react-hooks/exhaustive-deps` rule defs out of the box.** `eslint-disable-next-line react/no-danger` or `react-hooks/exhaustive-deps` directives fail lint with "Definition for rule ... was not found." Either drop the directive (preferred when the underlying rule isn't actually firing) or install the corresponding plugin. Project currently has neither installed.

## Phase 5 (@dnd-kit, React 19, Next 16)

- **`DndContext` auto-IDs hydration-mismatch on every card.** Symptom: `aria-describedby="DndDescribedBy-0"` (server) vs `DndDescribedBy-1` (client). Root cause: @dnd-kit uses a module-level counter for the announcer id, and the counter increments at different points during SSR vs CSR. Fix: pass `id="conbon-board"` (or any stable string) to `DndContext`. The id replaces the auto-generated counter entirely.
- **React 19 types `inert` as `boolean`, not the HTML5 boolean attribute.** `inert={true}` works; the old workaround `<div {...{ inert: "" }}>` errors with "Type 'string' is not assignable to type 'boolean | undefined'." Bare `inert={isDragging}` is the correct spelling under `@types/react@19`.
- **CSS custom-property style keys need a cast in `CSSProperties`.** TS's `CSSProperties` type doesn't accept `"--p-color"` as a key; cast via `["--p-color" as string]: ...` inside the style object literal. Alternative is `as React.CSSProperties` on the whole object, but the per-key cast keeps the rest of the object type-checked.
- **`document.body.style.userSelect = "none"` during drag, restored on cleanup.** Centralizing this in `Board`'s `useEffect` keyed off `draggingCardId` is cleaner than adding a per-card CSS rule that has to be conditioned on a drag-state class. Matches /web-design-guidelines guidance.
- **`closestCorners` is the right collision detector for kanban-style boards.** Tall columns + variable-height cards confuse `closestCenter` (a card dropped near a column edge can register against the wrong column's centroid). Corners-based detection picks the visually closest target.
