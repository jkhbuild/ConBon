import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

// Client-side tRPC hooks for use in "use client" components:
//
//   const { data } = trpc.cards.list.useQuery();
//
// The bound provider lives in lib/trpc/provider.tsx and wraps the app
// in app/layout.tsx. Importing only the AppRouter *type* keeps server
// code (Prisma, routers) out of the client bundle.

export const trpc = createTRPCReact<AppRouter>();
