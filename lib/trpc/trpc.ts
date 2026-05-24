import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

// tRPC v11 initialization.
//
// SuperJSON is the transformer so Date / Map / Set / BigInt round-trip
// over the wire intact — Prisma returns Date objects (createdAt, dueDate,
// etc.), and we want those typed as Date on the client, not string.
//
// Procedure ladder for Phase 3 is just `publicProcedure` — no auth yet.
// Phase 7 adds `protectedProcedure` / `adminProcedure` / `managerProcedure`
// as further middleware off this same `t`.

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
