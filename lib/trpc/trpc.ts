import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

// tRPC v11 initialization.
//
// SuperJSON is the transformer so Date / Map / Set / BigInt round-trip
// over the wire intact — Prisma returns Date objects (createdAt, dueDate,
// etc.), and we want those typed as Date on the client, not string.
//
// Procedure ladder:
//   publicProcedure    — no auth (kept for future health checks etc.)
//   protectedProcedure — any signed-in user; userId + role guaranteed non-null
//   adminProcedure     — role in { ADMIN, MANAGER }
//   managerProcedure   — role === MANAGER
//
// Each guard narrows ctx.userId / ctx.role to non-null via the middleware
// `next({ ctx })` pattern, so downstream resolvers don't need null checks.

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.role) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, role: ctx.role } });
});

const requireAdmin = requireSession.unstable_pipe(({ ctx, next }) => {
  if (ctx.role !== "ADMIN" && ctx.role !== "MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

const requireManager = requireSession.unstable_pipe(({ ctx, next }) => {
  if (ctx.role !== "MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

export const protectedProcedure = t.procedure.use(requireSession);
export const adminProcedure = t.procedure.use(requireAdmin);
export const managerProcedure = t.procedure.use(requireManager);
