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
import { trpc } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { Card, type CardData } from "./Card";
import { CardEditModal } from "./CardEditModal";
import { Column } from "./Column";
import { SwimLane } from "./SwimLane";
import { computePosition } from "@/lib/position";
import { useOptimisticListMutation } from "@/lib/hooks/useOptimisticListMutation";
import { useUIStore } from "@/stores/uiStore";
import { useBoardLayout } from "@/components/shell/PreferencesProvider";

// Board — Phase 6: live mutations via tRPC + optimistic cache updates.
// The local-useState mirror from Phase 5 is gone; the React Query cache
// for cards.list is now the single source of truth. Drag-end calls the
// cards.move mutation, the optimistic patch repositions the card in the
// cache, and a hard refresh re-fetches from the server (so the persisted
// position survives).
//
// Within-column ordering is now position-driven (was [priorityOverride
// desc, dueDate asc] in Phase 5). Dragging a card up or down within its
// column produces a meaningful position change.
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

type MoveInput = {
  id: string;
  toAssigneeId: string | null;
  toPosition: number;
};

export function Board({ initialCards, people }: BoardProps) {
  const utils = trpc.useUtils();
  const { data: cards = initialCards } = trpc.cards.list.useQuery(undefined, {
    initialData: initialCards,
  });

  const layout = useBoardLayout();
  const setDraggingCardId = useUIStore((s) => s.setDraggingCardId);
  const draggingCardId = useUIStore((s) => s.draggingCardId);
  const [, startTransition] = useTransition();

  // Live-region message for SR users. Updated on drag start / end. The
  // node is wrapped in a stable container with aria-live=polite so
  // assistive tech reads each change in order.
  const [announcement, setAnnouncement] = useState("");

  const sensors = useSensors(
    // 5px activation distance keeps card clicks (Block C will open the
    // edit modal) distinguishable from drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Optimistic patch for the move mutation. Updates assigneeId, position,
  // and the assignee relation (so the card's footer chip swaps color
  // immediately on a cross-column drag — without this, the chip lingers
  // on the old person until the refetch lands).
  const movePatch = useCallback(
    (old: CardData[], input: MoveInput): CardData[] => {
      const nextAssignee =
        input.toAssigneeId === null
          ? null
          : (people.find((p) => p.id === input.toAssigneeId) ?? null);
      return old.map((c) =>
        c.id === input.id
          ? {
              ...c,
              assigneeId: input.toAssigneeId,
              position: input.toPosition,
              assignee: nextAssignee,
            }
          : c,
      );
    },
    [people],
  );

  const moveMutation = trpc.cards.move.useMutation(
    useOptimisticListMutation<MoveInput, CardData>(utils.cards.list, movePatch),
  );

  // Group cards by assignee, sort within group by position. Phase 5
  // grouped by priority; Phase 6 makes position authoritative so drag
  // within a column has visible effect.
  const groups = useMemo(() => {
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
      bucket.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [cards, people]);

  // Look up the dragged card for the DragOverlay. Ref the latest cards
  // so drag-end callbacks see post-mutation cache state.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
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
      if (activeId === overId) {
        setAnnouncement("Card position unchanged");
        return;
      }

      const current = cardsRef.current;
      const moved = current.find((c) => c.id === activeId);
      if (!moved) return;

      // Resolve the destination assignee. Dropped on a column-level
      // droppable: overId is "__backlog" or a person id. Dropped on
      // another card: borrow that card's assignee.
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

      // Compute the new position from the destination bucket's neighbors,
      // with the active card excluded so within-column drags land in the
      // gap they were dragged to (not back on top of themselves).
      const destKey = destAssigneeId ?? BACKLOG_KEY;
      const destBucket = (groupsRef.current.get(destKey) ?? []).filter(
        (c) => c.id !== activeId,
      );
      let insertIndex: number;
      if (overId === BACKLOG_KEY || people.some((p) => p.id === overId)) {
        // Dropped on the column itself → append.
        insertIndex = destBucket.length;
      } else {
        const targetIdx = destBucket.findIndex((c) => c.id === overId);
        insertIndex = targetIdx >= 0 ? targetIdx : destBucket.length;
      }
      const prevPos = insertIndex > 0 ? destBucket[insertIndex - 1].position : null;
      const nextPos = insertIndex < destBucket.length ? destBucket[insertIndex].position : null;
      const toPosition = computePosition(prevPos, nextPos);

      // No-op guard: same column, same neighbors → don't send a wasted
      // mutation. (Compares positions because the bucket is sorted.)
      if (
        moved.assigneeId === destAssigneeId &&
        moved.position === toPosition
      ) {
        setAnnouncement("Card position unchanged");
        return;
      }

      startTransition(() => {
        moveMutation.mutate({
          id: activeId,
          toAssigneeId: destAssigneeId,
          toPosition,
        });
      });

      const destName =
        destAssigneeId === null
          ? "Backlog"
          : (people.find((p) => p.id === destAssigneeId)?.name ?? "—");
      setAnnouncement(`Moved card ${moved.title} to ${destName}`);
    },
    [moveMutation, people, setDraggingCardId],
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

      <CardEditModal />
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
        assigneeId={null}
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
          assigneeId={p.id}
          title={p.name.split(" ")[0] ?? p.name}
          subtitle={`${humanizeRole(p.role)} · In Progress`}
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
        assigneeId={null}
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
          assigneeId={p.id}
          name={p.name}
          role={`${humanizeRole(p.role)} · In Progress`}
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

// Humanize an enum role value (e.g. "COMMERCIAL_MANAGER" → "Commercial Manager")
// for the column / swim-lane subtitle. Underscore segments title-case
// independently so multi-word roles read cleanly.
function humanizeRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
