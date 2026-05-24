import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma client singleton.
//
// Next.js dev mode hot-reloads modules on file changes, which would
// otherwise spawn a new PrismaClient per reload and exhaust the
// Postgres connection pool. Caching on globalThis survives the
// hot-reload boundary so we hold one client per process.
//
// Prisma 7 requires a driver adapter at runtime — PrismaPg wraps the
// `pg` driver. The same driver will be reused in Phase 8 for
// LISTEN/NOTIFY (see plan).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (or .env.local) and adjust.",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
