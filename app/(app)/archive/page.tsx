import { getServerCaller } from "@/lib/trpc/server";
import { ArchiveList } from "@/components/archive/ArchiveList";

// /archive — Phase 6. RSC fetches the archived cards via the tRPC server
// caller and hands them to the ArchiveList client component, which
// renders the list + Restore action per row.
//
// `force-dynamic` because archive state changes on every cards.archive /
// cards.restore mutation and we don't want stale HTML between visits.

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const trpc = await getServerCaller();
  const cards = await trpc.cards.listArchived();
  return <ArchiveList initialCards={cards} />;
}
