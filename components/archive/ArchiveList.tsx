"use client";

import { trpc } from "@/lib/trpc/client";
import { formatShort } from "@/lib/priority";
import type { RouterOutputs } from "@/lib/trpc/types";

// ArchiveList — client component that renders archived cards and a
// Restore action per row.
//
// Initial data is RSC-fetched and passed as a prop; the useQuery
// hydration lets subsequent restores update the list reactively without
// a navigation. Restore is wired inline (not via useOptimisticListMutation)
// because it touches two list caches: listArchived (remove the row) and
// list (the restored card reappears on /active when the user navigates
// back). Both are invalidated on settle.

type ArchivedCard = RouterOutputs["cards"]["listArchived"][number];

type Props = {
  initialCards: ArchivedCard[];
};

export function ArchiveList({ initialCards }: Props) {
  const { data: cards = initialCards } = trpc.cards.listArchived.useQuery(
    undefined,
    { initialData: initialCards },
  );

  return (
    <section className="archive">
      <div className="archive-head">
        <h1>Archive</h1>
        <p className="archive-sub">
          {cards.length} archived {cards.length === 1 ? "task" : "tasks"} ·
          Restore moves a card back to the end of its assignee column.
        </p>
      </div>
      {cards.length === 0 ? (
        <div className="archive-empty">
          — No archived tasks. Archive a card from /active to see it here. —
        </div>
      ) : (
        <ul className="archive-list">
          {cards.map((card) => (
            <ArchiveRow key={card.id} card={card} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ArchiveRow({ card }: { card: ArchivedCard }) {
  const utils = trpc.useUtils();
  const restore = trpc.cards.restore.useMutation({
    onMutate: async ({ id }) => {
      await utils.cards.listArchived.cancel();
      const previous = utils.cards.listArchived.getData();
      utils.cards.listArchived.setData(undefined, (old) =>
        old ? old.filter((c) => c.id !== id) : old,
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous)
        utils.cards.listArchived.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      void utils.cards.listArchived.invalidate();
      // Also refetch /active so the restored card lands there on next visit.
      void utils.cards.list.invalidate();
    },
  });

  const assigneeInitials = card.assignee
    ? card.assignee.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
    : "?";

  return (
    <li className="archive-row">
      <div className="archive-chips">
        <span className="card-contract">{card.contract.code}</span>
        <span className="card-type">{card.type}</span>
      </div>
      <div className="archive-title">{card.title}</div>
      <div className="archive-meta">
        {card.assignee ? (
          <span
            className="avatar"
            style={{
              width: 22,
              height: 22,
              background: card.assignee.color,
              fontSize: 10,
            }}
            title={card.assignee.name}
          >
            {assigneeInitials}
          </span>
        ) : (
          <span className="archive-backlog-pip" title="Was unassigned">
            Backlog
          </span>
        )}
        <span className="archive-archived-at">
          Archived {card.archivedAt ? formatShort(card.archivedAt) : "—"}
        </span>
      </div>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => restore.mutate({ id: card.id })}
        disabled={restore.isPending}
      >
        {restore.isPending ? "Restoring…" : "Restore"}
      </button>
    </li>
  );
}
