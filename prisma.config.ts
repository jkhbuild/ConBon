import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 moved the datasource URL out of schema.prisma. The CLI
// (prisma migrate, prisma db seed, prisma studio) reads it from here.
// The runtime PrismaClient gets the URL separately via the PrismaPg
// adapter — see lib/db.ts.
//
// `env()` doesn't auto-load .env files, so we pull dotenv in at the
// top to populate process.env from .env before defineConfig runs.

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
