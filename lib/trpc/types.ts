import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

// Public type surface for the rest of the app.
//
// Anywhere a component or hook needs the shape of a tRPC payload,
// import from here rather than reaching into server/routers/* directly:
//
//   import type { RouterOutputs } from "@/lib/trpc/types";
//   type Card = RouterOutputs["cards"]["list"][number];
//
// Importing the AppRouter type alone (not its value) keeps server-only
// modules out of client bundles.

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
