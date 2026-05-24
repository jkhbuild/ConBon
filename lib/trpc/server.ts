import "server-only";
import { createCallerFactory } from "./trpc";
import { createContext } from "./context";
import { appRouter } from "@/server/routers/_app";

// Server-side tRPC caller for React Server Components.
//
// Lets RSCs invoke procedures directly with no HTTP hop:
//   const trpc = await getServerCaller();
//   const cards = await trpc.cards.list();
//
// `server-only` makes the bundler error if this is ever imported from a
// client component — the appRouter pulls Prisma in, which must not leak
// into the browser bundle.

const createCaller = createCallerFactory(appRouter);

export async function getServerCaller() {
  return createCaller(createContext());
}
