"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Card, type CardData } from "./Card";
import { Column } from "./Column";
import { SwimLane } from "./SwimLane";
import { effectivePriority } from "@/lib/priority";
import { useBoardLayout, useUIStore } from "@/stores/uiStore";

// Board — Phase 5: read-only DnD. Drags update local state for visual
// feedback; refresh reverts (re-fetch from RSC restores server order).
// Phase 6 swaps the local setCards for the cards.move mutation and
// keeps the same DndContext / sensor wiring.
//
// Architecture notes wired in here:
//   - @dnd-kit/PointerSensor + KeyboardSensor → /web-design-guidelines
//     (keyboard a11y for drag)
//   - aria-live polite region announces moves to screen readers
//   - startTransition on drag-state updates so user input stays
//     responsive while React reconciles the new column layouts
//   - useBoardLayout reads layout from Zustand; Phase 11 swaps the
//     source for UserPreference.layout in Postgres
//
// The Backlog column uses the literal id "__backlog" both as the
// useDroppable id and as the Map key. A card's `assigneeId === null`
// maps to that key.

const BACKLOG_KEY = "__backlog";

type PersonData = RouterOutputs["people"]["list"][number];

type BoardProps = {
  initialCards: CardData[];
  people: PersonData[];
};

export function Board({ initialCards, people }: BoardProps) {
  // Local state mirrors initial server data. Drags mutate this; a hard
  // refresh remounts the RSC and reseeds, which is the Phase 5 "refresh
  // reverts" contract.
  const [cards, setCards] = useState<CardData[]>(initialCards);
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const layout = useBoardLayout();
  const setDraggingCardId = useUIStore((s) => s.setDraggingCardId);
  const draggingCardId = useUIStore((s) => s.draggingCardId);
  const [, startTransition] = useTransition();

  // Live-region message for SR users. Updated on drag start / end. The
  // node is wrapped in a stable container with aria-live=polite so
  // assistive tech reads each change in order.
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(
    // 5px activation distance keeps card clicks (Phase 6 will open the
    // edit modal) distinguishable from drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group cards by assignee, sort within group by effective priority desc
  // then due date asc. Matches reference/prototype/board.jsx behavior.
  const groups = useMemo(() => {
    const now = new Date();
    const map = new Map<string, CardData[]>();
    map.set(BACKLOG_KEY, []);
    for (const p of people) map.set(p.id, []);
    for (const c of cards) {
      const key = c.assigneeId ?? BACKLOG_KEY;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push(c);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const pa = effectivePriority(a, now);
        const pb = effectivePriority(b, now);
        if (pb !== pa) return pb - pa;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    }
    return map;
  }, [cards, people]);

  // Look up the dragged card for the DragOverlay. Need a ref to read
  // the latest in callbacks without re-creating them on each render.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const draggingCard = useMemo(
    () => cards.find((c) => c.id === draggingCardId) ?? null,
    [cards, draggingCardId],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setDraggingCardId(id);
      const card = cardsRef.current.find((c) => c.id === id);
      if (card) {
        setAnnouncement(`Picked up card ${card.title}`);
      }
    },
    [setDraggingCardId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggingCardId(null);

      if (!over) {
        setAnnouncement("Drag cancelled");
        return;
      }

      const activeId = String(active.id);
      const overId = String(over.id);
      const current = cardsRef.current;
      const moved = current.find((c) => c.id === activeId);
      if (!moved) return;

      // Determine the destination column.
      // Two cases: dropped on a column itself (overId === person.id or
      // "__backlog") or on another card (overId === some card id).
      let destAssigneeId: string | null;
      if (overId === BACKLOG_KEY) {
        destAssigneeId = null;
      } else if (people.some((p) => p.id === overId)) {
        destAssigneeId = overId;
      } else {
        const target = current.find((c) => c.id === overId);
        if (!target) return;
        destAssigneeId = target.assigneeId;
      }

      if (moved.assigneeId === destAssigneeId) {
        // Within-column drag — in Phase 5 ordering is derived from
        // priority + due date so this is a visual no-op. Phase 6
        // updates `position` and the order becomes meaningful.
        setAnnouncement("Card position unchanged");
        return;
      }

      startTransition(() => {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? { ...c, assigneeId: destAssigneeId, assignee: people.find((p) => p.id === destAssigneeId) ?? null }
              : c,
          ),
        );
      });

      const destName =
        destAssigneeId === null
          ? "Backlog"
          : people.find((p) => p.id === destAssigneeId)?.name ?? "—";
      setAnnouncement(`Moved card ${moved.title} to ${destName}`);
    },
    [people, setDraggingCardId],
  );

  const handleDragCancel = useCallback(() => {
    setDraggingCardId(null);
    setAnnouncement("Drag cancelled");
  }, [setDraggingCardId]);

  // Disable text selection on the body while a drag is active. Matches
  // /web-design-guidelines guidance; cleaner than per-element CSS.
  useEffect(() => {
    if (!draggingCardId) return;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [draggingCardId]);

  return (
    <div className="board-wrap">
      <DndContext
        // Stable id so the auto-generated `aria-describedby` for SR
        // announcements matches between SSR and client hydration.
        // @dnd-kit otherwise increments a global counter that differs
        // depending on render order.
        id="conbon-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {layout === "swimlanes" ? (
          <SwimLanesLayout groups={groups} people={people} />
        ) : (
          <ColumnsLayout groups={groups} people={people} />
        )}
        <DragOverlay>
          {draggingCard ? (
            <Card card={draggingCard} isOverlay>
              <Card.Top />
              <Card.Title />
              <Card.Blocker />
              <Card.Footer />
              <Card.Aging />
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </div>
    </div>
  );
}

type LayoutProps = {
  groups: Map<string, CardData[]>;
  people: PersonData[];
};

function ColumnsLayout({ groups, people }: LayoutProps) {
  const backlogCards = groups.get(BACKLOG_KEY) ?? [];
  return (
    <div
      className="board-cols"
      style={{ ["--cols" as string]: people.length }}
    >
      <Column
        columnId={BACKLOG_KEY}
        title="Backlog"
        subtitle="Unassigned"
        avatarColor="var(--ink-2)"
        avatarText="BL"
        cards={backlogCards}
      />
      {people.map((p) => (
        <Column
          key={p.id}
          columnId={p.id}
          title={p.name.split(" ")[0] ?? p.name}
          subtitle={`${p.role.charAt(0)}${p.role.slice(1).toLowerCase()} · In Progress`}
          avatarColor={p.color}
          avatarText={initialsOf(p.name)}
          cards={groups.get(p.id) ?? []}
        />
      ))}
    </div>
  );
}

function SwimLanesLayout({ groups, people }: LayoutProps) {
  const backlogCards = groups.get(BACKLOG_KEY) ?? [];
  return (
    <div className="board-lanes">
      <SwimLane
        columnId={BACKLOG_KEY}
        name="Backlog"
        role="Unassigned · drag onto an assignee to start"
        avatarColor="var(--ink-2)"
        avatarText="BL"
        cards={backlogCards}
        isBacklog
      />
      {people.map((p) => (
        <SwimLane
          key={p.id}
          columnId={p.id}
          name={p.name}
          role={`${p.role.charAt(0)}${p.role.slice(1).toLowerCase()} · In Progress`}
          avatarColor={p.color}
          avatarText={initialsOf(p.name)}
          cards={groups.get(p.id) ?? []}
        />
      ))}
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}
