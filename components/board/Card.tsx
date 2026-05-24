"use client";

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
  CYCLE_DAYS,
  daysBetween,
  effectivePriority,
  formatShort,
  priorityColor,
  priorityLabel,
  priorityTint,
} from "@/lib/priority";
import { useUIStore } from "@/stores/uiStore";

// Card — compound component for one task. Composition over boolean props
// per /vercel-composition-patterns: the root reads the card off context
// and Card.Top / Card.Title / Card.Blocker / Card.PriorityPip / Card.Footer
// / Card.Aging pull what they need. Variants (with/without blocker, with
// aging row, overlay-during-drag) are expressed as different child trees,
// not boolean props.
//
// The root owns the @dnd-kit useSortable wiring so the entire card is the
// drag handle. Phase 5 is read-only — refresh reverts.

export type CardData = RouterOutputs["cards"]["list"][number];

type CardContextValue = {
  card: CardData;
  level: 1 | 2 | 3 | 4 | 5;
  daysLeft: number;
};

const CardContext = createContext<CardContextValue | null>(null);

function useCardCtx(): CardContextValue {
  const ctx = useContext(CardContext);
  if (!ctx) {
    throw new Error("Card.* sub-component used outside <Card>");
  }
  return ctx;
}

type CardRootProps = {
  card: CardData;
  children: ReactNode;
  // When true, this card is the DragOverlay floater — skip useSortable
  // and render without transform/listener wiring (the overlay handles
  // positioning itself).
  isOverlay?: boolean;
};

export function Card({ card, children, isOverlay = false }: CardRootProps) {
  const level = effectivePriority(card);
  const days = daysBetween(card.assignmentDate, new Date());
  const daysLeft = CYCLE_DAYS - days;

  const sortable = useSortable({ id: card.id, disabled: isOverlay });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const openCard = useUIStore((s) => s.openCard);
  // Distinguish a click (open modal) from a drag (move card) using the
  // pointer-position delta between pointerdown and click. The 5px
  // threshold mirrors the PointerSensor's activationConstraint distance
  // so the two paths are exclusive: above 5px @dnd-kit takes over and
  // we suppress the click; below it we open the modal.
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    listeners?.onPointerDown?.(e);
  };
  const handleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (isOverlay) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx * dx + dy * dy >= 25) return;
    openCard(card.id);
  };

  const style: CSSProperties = {
    // Bind the CSS-variable hooks the prototype CSS reads off `.card`.
    // priorityColor / priorityTint return `var(--pN)` references so
    // themes (soft / bold / noir / forest) can rebind them centrally.
    ["--p-color" as string]: priorityColor(level),
    ["--p-tint" as string]: priorityTint(level),
    transform: isOverlay ? undefined : CSS.Transform.toString(transform),
    transition: isOverlay ? undefined : transition,
    // The overlay is "owned" by the DragOverlay — the original card
    // dims via .dragging while the floater is full opacity.
    opacity: isDragging && !isOverlay ? 0.35 : undefined,
  };

  // Per /web-design-guidelines: `inert` on the source card during drag
  // so its content (links, the priority chip button) can't receive
  // focus or pointer events while a floating clone is moving.
  return (
    <CardContext.Provider value={{ card, level, daysLeft }}>
      <div
        ref={setNodeRef}
        className={"card" + (isDragging && !isOverlay ? " dragging" : "")}
        style={style}
        // @dnd-kit attaches role/tabIndex/aria-* via `attributes`.
        {...(isOverlay ? {} : attributes)}
        // Spread @dnd-kit's listeners, then override onPointerDown so we
        // can snapshot the pointer position for the click/drag check.
        {...(isOverlay
          ? {}
          : { ...listeners, onPointerDown: handlePointerDown })}
        onClick={handleClick}
        // `inert` removes the source card from sequential focus + pointer
        // events while the DragOverlay floater handles interaction.
        inert={isDragging && !isOverlay}
      >
        {children}
      </div>
    </CardContext.Provider>
  );
}

function CardTop() {
  const { card } = useCardCtx();
  const typeLabel = card.type[0] + card.type.slice(1).toLowerCase();
  return (
    <div className="card-top">
      <span className="card-contract">{card.contract.code}</span>
      <span className="card-type">{typeLabel}</span>
    </div>
  );
}

function CardTitle() {
  const { card } = useCardCtx();
  return <div className="card-title">{card.title}</div>;
}

function CardBlocker() {
  const { card } = useCardCtx();
  if (!card.blockerNote || card.blockerNote.trim().length === 0) return null;
  // Read-only in Phase 5; Phase 6 wires the inline-edit textarea.
  return (
    <div className="card-blocker">
      <span className="card-blocker-label">Blocker</span>
      <span>{card.blockerNote}</span>
    </div>
  );
}

function CardPriorityPip() {
  const { level } = useCardCtx();
  return (
    <span
      className="priority-chip"
      style={{ background: priorityColor(level) }}
      title={`Priority ${level} — ${priorityLabel(level)}`}
    >
      <span className="priority-chip-dot">{level}</span>
      {priorityLabel(level)}
    </span>
  );
}

function CardFooter() {
  const { card } = useCardCtx();
  const person = card.assignee;
  const initials = person
    ? person.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
    : "?";

  return (
    <div className="card-bottom">
      <CardPriorityPip />
      <span className="card-meta">
        {formatShort(card.assignmentDate)}
        <span className="card-meta-sep">→</span>
        {formatShort(card.dueDate)}
      </span>
      <span style={{ marginLeft: "auto" }}>
        {person ? (
          <span
            className="avatar"
            style={{
              width: 24,
              height: 24,
              background: person.color,
              fontSize: 10,
            }}
            title={person.name}
          >
            {initials}
          </span>
        ) : (
          <span
            className="avatar"
            style={{
              width: 24,
              height: 24,
              background: "transparent",
              border: "1.5px dashed var(--line-strong)",
              color: "var(--ink-3)",
              fontSize: 10,
              fontWeight: 500,
            }}
            title="Unassigned"
          >
            ?
          </span>
        )}
      </span>
    </div>
  );
}

function CardAging() {
  const { card, level, daysLeft } = useCardCtx();
  const overdue = daysLeft < 0;
  // Show only when overdue or high priority — matches prototype.
  if (!overdue && level < 4) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
      <span className="card-aging">
        {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
      </span>
      {card.priorityOverride != null && (
        <span className="card-aging" style={{ background: "var(--chip-bg)" }}>
          manual
        </span>
      )}
    </div>
  );
}

Card.Top = CardTop;
Card.Title = CardTitle;
Card.Blocker = CardBlocker;
Card.PriorityPip = CardPriorityPip;
Card.Footer = CardFooter;
Card.Aging = CardAging;
