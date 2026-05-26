-- Role enum reshape.
--
-- Three-tier ladder shifts:
--   old EMPLOYEE → new ANALYST   (bottom tier; default for new sign-ins)
--   old ADMIN    → new COMMERCIAL_MANAGER  (middle tier; people + contracts CRUD)
--   old MANAGER  → new ADMIN     (top tier; allowlist + role changes)
--
-- Two new bottom-tier siblings (ESTIMATOR, SCHEDULER) become available
-- via the People admin UI without any data migration — they're just new
-- enum values the existing roleSchema (z.nativeEnum(Role)) accepts.
--
-- Postgres can't drop enum values in place, so the recipe is:
-- rename the old enum, create the new one, ALTER the columns with a
-- USING clause that maps the old text values to the new enum values,
-- then drop the old type. All four statements execute inside the
-- single implicit transaction migrate wraps the file in.

-- Drop the column defaults that reference the old enum so ALTER TYPE
-- on the columns can proceed without complaining about default-cast
-- ambiguity.
ALTER TABLE "Person" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "AllowedUser" ALTER COLUMN "role" DROP DEFAULT;

-- Rename the old enum out of the way, then create the new one under
-- the same name so the post-migration schema matches schema.prisma.
ALTER TYPE "Role" RENAME TO "Role_old";

CREATE TYPE "Role" AS ENUM ('ANALYST', 'ESTIMATOR', 'SCHEDULER', 'COMMERCIAL_MANAGER', 'ADMIN');

-- Cast each column over with the value remap. The CASE coerces from
-- text (the old type's textual form survives the rename) to the new
-- enum so the column type change is one atomic statement per table.
ALTER TABLE "Person"
  ALTER COLUMN "role" TYPE "Role" USING (
    CASE "role"::text
      WHEN 'EMPLOYEE' THEN 'ANALYST'::"Role"
      WHEN 'ADMIN'    THEN 'COMMERCIAL_MANAGER'::"Role"
      WHEN 'MANAGER'  THEN 'ADMIN'::"Role"
    END
  );

ALTER TABLE "AllowedUser"
  ALTER COLUMN "role" TYPE "Role" USING (
    CASE "role"::text
      WHEN 'EMPLOYEE' THEN 'ANALYST'::"Role"
      WHEN 'ADMIN'    THEN 'COMMERCIAL_MANAGER'::"Role"
      WHEN 'MANAGER'  THEN 'ADMIN'::"Role"
    END
  );

-- Re-establish the column defaults under the new enum.
ALTER TABLE "Person"      ALTER COLUMN "role" SET DEFAULT 'ANALYST';
ALTER TABLE "AllowedUser" ALTER COLUMN "role" SET DEFAULT 'ANALYST';

-- Now no column depends on the renamed enum and it can be dropped.
DROP TYPE "Role_old";

-- Remap the role value embedded in AuditLog before/after JSON so the
-- History UI doesn't render orphan strings like "MANAGER" or "EMPLOYEE"
-- on historical Person / AllowedUser updates. Order matters: the
-- ADMIN→COMMERCIAL_MANAGER step runs BEFORE the MANAGER→ADMIN step so
-- the second update doesn't accidentally re-promote the rows the first
-- one demoted.
UPDATE "AuditLog"
  SET "before" = jsonb_set("before", '{role}', '"COMMERCIAL_MANAGER"')
  WHERE "before" ? 'role' AND "before"->>'role' = 'ADMIN';

UPDATE "AuditLog"
  SET "before" = jsonb_set("before", '{role}', '"ADMIN"')
  WHERE "before" ? 'role' AND "before"->>'role' = 'MANAGER';

UPDATE "AuditLog"
  SET "before" = jsonb_set("before", '{role}', '"ANALYST"')
  WHERE "before" ? 'role' AND "before"->>'role' = 'EMPLOYEE';

UPDATE "AuditLog"
  SET "after" = jsonb_set("after", '{role}', '"COMMERCIAL_MANAGER"')
  WHERE "after" ? 'role' AND "after"->>'role' = 'ADMIN';

UPDATE "AuditLog"
  SET "after" = jsonb_set("after", '{role}', '"ADMIN"')
  WHERE "after" ? 'role' AND "after"->>'role' = 'MANAGER';

UPDATE "AuditLog"
  SET "after" = jsonb_set("after", '{role}', '"ANALYST"')
  WHERE "after" ? 'role' AND "after"->>'role' = 'EMPLOYEE';
