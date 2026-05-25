import { router } from "@/lib/trpc/trpc";
import { cardsRouter } from "./cards";
import { peopleRouter } from "./people";
import { contractsRouter } from "./contracts";
import { allowedUsersRouter } from "./allowedUsers";

// Root tRPC router. Each phase adds new sub-routers off this one:
//   Phase 3: cards.list, people.list, contracts.list                (read-only)
//   Phase 6: cards.{create,update,move,archive,restore}
//   Phase 7: auth.* + admin guards on cards mutations
//   Phase 9: people.{listAll,create,update,deactivate,reactivate}
//            contracts.{listAll,create,update,deactivate,reactivate}
//            allowedUsers.{list,add,remove}

export const appRouter = router({
  cards: cardsRouter,
  people: peopleRouter,
  contracts: contractsRouter,
  allowedUsers: allowedUsersRouter,
});

export type AppRouter = typeof appRouter;
