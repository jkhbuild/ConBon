-- Person.position — admin-controlled column / row order.
--
-- Sequential integers (no gaps); reorder is a neighbor-swap mutation so
-- there's no insertion-into-middle to make room for. At the 4-8 user
-- scale ConBon targets, the values stay 1..N and never need rebalance.
--
-- Backfill orders existing rows by name so the post-migration board
-- shows the same alphabetic order it did before (people.list previously
-- sorted by name asc). The Admin People page now re-orders freely.

ALTER TABLE "Person" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "Person" p
SET "position" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "name") AS rn
  FROM "Person"
) sub
WHERE p.id = sub.id;

CREATE INDEX "Person_position_idx" ON "Person" ("position");
