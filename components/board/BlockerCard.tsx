"use client";

import type { BlockerData, ViewerInfo } from "./Board";
import { BlockerContextMenu } from "./BlockerContextMenu";
import { formatShort } from "@/lib/priority";

// BlockerCard — post-v1.
//
// A non-draggable, non-sortable sibling to <Card> that renders inside the
// Commercial Manager's column on the board, below the CM's real tasks
// and after the SortableContext so @dnd-kit ignores it entirely. Renders
// the contract code + name, the source card's title, the blocker note,
// the raiser's name + initial, and the raised date. The whole element
// is right-click-only (no onClick) — the ContextMenu items vary by
// viewer role + identity.
//
// Default visual is red urgent (`--p5` / `--p5-tint`); `.is-acknowledged`
// flips both bindings to `--p1` / `--p1-tint` (green) once the CM has
// acknowledged. Both token pairs already exist in every theme so no new
// CSS variables were needed.

type Props = {
  blocker: BlockerData;
  viewer: ViewerInfo | null;
};

export function BlockerCard({ blocker, viewer }: Props) {
  const { card, raisedBy, acknowledgedAt } = blocker;
  const acknowledged = acknowledgedAt != null;
  const className = "blocker-card" + (acknowledged ? " is-acknowledged" : "");
  const raiserInitials = raisedBy.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  return (
    <BlockerContextMenu blocker={blocker} viewer={viewer}>
      <div className={className} role="group" aria-label="Blocker">
        <div className="blocker-card-top">
          <span className="blocker-card-label">Blocker</span>
          <span className="blocker-card-contract">
            {card.contract.code}
            <span className="blocker-card-contract-name">
              {" "}
              · {card.contract.name}
            </span>
          </span>
        </div>
        <div className="blocker-card-title">{card.title}</div>
        {card.blockerNote && (
          <div className="blocker-card-note">{card.blockerNote}</div>
        )}
        <div className="blocker-card-bottom">
          <span
            className="avatar"
            style={{
              width: 20,
              height: 20,
              background: raisedBy.color,
              fontSize: 9,
            }}
            title={raisedBy.name}
            aria-hidden="true"
          >
            {raiserInitials}
          </span>
          <span className="blocker-card-meta">{raisedBy.name}</span>
          <span className="blocker-card-meta" style={{ marginLeft: "auto" }}>
            {formatShort(blocker.raisedAt)}
          </span>
        </div>
      </div>
    </BlockerContextMenu>
  );
}
