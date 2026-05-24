import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// tRPC request context.
//
// `userId` and `role` come from the JWT session (set in auth.ts callbacks).
// Both are nullable here so `publicProcedure` keeps working for un-auth'd
// routes (none yet — every Phase 7 procedure requires auth — but the type
// stays open so we don't have to fight the type system if we ever add
// genuinely public routes like a health check).
//
// `protectedProcedure` (in lib/trpc/trpc.ts) narrows `userId` + `role`
// to non-null via a middleware guard.

export type Context = {
  db: typeof db;
  userId: string | null;
  role: Role | null;
};

export async function createContext(): Promise<Context> {
  const session = await auth();
  return {
    db,
    userId: session?.user?.id ?? null,
    role: session?.user?.role ?? null,
  };
}
