import { db } from "@/lib/db";

// tRPC request context.
//
// Phase 3 carries only the Prisma client. Phase 7 will add the NextAuth
// session here so `protectedProcedure` middleware can read `ctx.session`.
//
// `createContext` is called once per request by the fetch adapter route
// handler (app/api/trpc/[trpc]/route.ts). The same shape is reused by
// the server-side caller (lib/trpc/server.ts) for RSC.

export type Context = {
  db: typeof db;
};

export function createContext(): Context {
  return { db };
}
