"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, type CardData } from "./Card";
import { CardContextMenu } from "./CardContextMenu";
import { NewCardButton } from "./NewCardButton";
import { useBoardClock } from "./BoardClock";
import { effectivePriority } from "@/lib/priority";

// SwimLane — Layout B: horizontal strip per assignee, cards laid out in
// a responsive grid inside. Same drop semantics as Column but the
// SortableContext uses rectSortingStrategy because the children flow
// 2-dimensionally.

type SwimLaneProps = {
  columnId: string;
  // null = Backlog, used as cards.create assigneeId for the lane's "+" button
  assigneeId: string | null;
  name: string;
  role: string;
  avatarColor: string;
  avatarText: string;
  cards: CardData[];
  // Backlog lane skips urgent/overdue stats and shows a hint instead.
  isBacklog?: boolean;
};

export function SwimLane({
  columnId,
  assigneeId,
  name,
  role,
  avatarColor,
  avatarText,
  cards,
  isBacklog = false,
}: SwimLaneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: columnId });
  const cardIds = cards.map((c) => c.id);

  // Shared clock from <Board>'s BoardClock context — keeps SSR and
  // hydration in agreement on these `{urgentCount}` / `{overdueCount}`
  // text nodes. Re-renders once a minute as the clock ticks.
  const now = useBoardClock();
  const overdueCount = cards.filter((c) => c.dueDate.getTime() < now.getTime()).length;
  const urgentCount = cards.filter((c) => effectivePriority(c, now) >= 4).length;

  return (
    <div className="lane">
      <div className="lane-head">
        <div
          className="lane-avatar"
          style={{ background: avatarColor }}
          aria-hidden="true"
        >
          {avatarText}
        </div>
        <div>
          <div className="lane-name">{name}</div>
          <div className="lane-role">{role}</div>
        </div>
        <div className="lane-stats">
          <div className="lane-stat">
            <strong>{cards.length}</strong> open
          </div>
          {!isBacklog && (
            <>
              <div className="lane-stat">
                <strong>{urgentCount}</strong> urgent
              </div>
              <div className="lane-stat">
                <strong>{overdueCount}</strong> overdue
              </div>
            </>
          )}
          <NewCardButton assigneeId={assigneeId} />
        </div>
      </div>
      <SortableContext items={cardIds} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={"lane-body" + (isOver ? " drop-target" : "")}
        >
          {cards.length === 0 && (
            <div className="empty-col" style={{ gridColumn: "1 / -1" }}>
              {isBacklog ? "— no unassigned tasks —" : "— no tasks —"}
            </div>
          )}
          {cards.map((card) => (
            <CardContextMenu key={card.id} card={card}>
              <Card card={card}>
                <Card.Top />
                <Card.Title />
                <Card.Blocker />
                <Card.Footer />
                <Card.Aging />
              </Card>
            </CardContextMenu>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
