import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/lib/trpc/context";

// tRPC HTTP entry point for client components and external callers.
// App Router catch-all: GET for queries (httpBatchLink batches them as
// `?batch=1&input=...`), POST for mutations.

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[tRPC] ${path ?? "<no-path>"}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };
