"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, type CardData } from "./Card";
import { CardContextMenu } from "./CardContextMenu";
import { NewCardButton } from "./NewCardButton";

// Column — the Layout A presentation: a vertical lane per assignee
// plus a Backlog lane on the left. The whole column is a drop zone
// (so an empty column still accepts a card) and the body is also a
// SortableContext for within-column reordering. @dnd-kit treats both
// signals together in the Board's onDragOver handler.

type ColumnProps = {
  // Stable drop-zone id. The Backlog uses "__backlog"; assignee columns
  // use the Person id. The Board's onDragEnd handler translates this
  // back to `assigneeId | null`.
  columnId: string;
  // null = Backlog, used as cards.create assigneeId for the column's "+" button
  assigneeId: string | null;
  title: string;
  subtitle: string;
  avatarColor: string;
  avatarText: string;
  cards: CardData[];
};

export function Column({
  columnId,
  assigneeId,
  title,
  subtitle,
  avatarColor,
  avatarText,
  cards,
}: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: columnId });
  const cardIds = cards.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      className={"col" + (isOver ? " drop-target" : "")}
    >
      <div className="col-head">
        <div
          className="col-avatar"
          style={{ background: avatarColor }}
          aria-hidden="true"
        >
          {avatarText}
        </div>
        <div>
          <div className="col-title">{title}</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{subtitle}</div>
        </div>
        <div className="col-sub">{cards.length}</div>
        <NewCardButton assigneeId={assigneeId} />
      </div>
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="col-body">
          {cards.length === 0 && <div className="empty-col">— empty —</div>}
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
