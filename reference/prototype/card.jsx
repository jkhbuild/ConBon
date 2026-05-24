// card.jsx — Task card + add-card stub

const { useState, useRef, useEffect } = React;
const {
  PEOPLE, CONTRACTS, CYCLE_DAYS,
  effectivePriority, priorityColor, priorityTint, priorityLabel,
  daysBetween, formatShort,
} = window.KanbanData;

function Avatar({ person, size = 24, ringColor }) {
  if (!person) {
    return (
      <div
        className="avatar"
        style={{
          width: size, height: size,
          background: "transparent",
          border: "1.5px dashed var(--line-strong)",
          color: "var(--ink-3)",
          fontSize: size * 0.42,
          fontWeight: 500,
        }}
        title="Unassigned"
      >?</div>
    );
  }
  const initials = person.name.split(" ").map(s => s[0]).slice(0, 2).join("");
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size,
        background: person.color,
        fontSize: size * 0.42,
        boxShadow: ringColor ? `0 0 0 2px ${ringColor}` : undefined,
      }}
      title={person.name}
    >{initials}</div>
  );
}

function PriorityChip({ level, onChipClick }) {
  return (
    <span
      className="priority-chip"
      style={{
        background: priorityColor(level),
      }}
      onClick={(e) => { e.stopPropagation(); onChipClick && onChipClick(e); }}
      title={`Priority ${level} — ${priorityLabel(level)}. Click to override.`}
    >
      <span className="priority-chip-dot">{level}</span>
      {priorityLabel(level)}
    </span>
  );
}

function TaskCard({ task, onContextMenu, onChipClick, onEdit, onUpdate, draggable = true }) {
  const level = effectivePriority(task);
  const person = PEOPLE.find(p => p.id === task.assignee);
  const contract = CONTRACTS.find(c => c.id === task.contract);

  const days = daysBetween(new Date(task.assignmentDate).getTime(), Date.now());
  const daysLeft = CYCLE_DAYS - days;

  const [editingBlocker, setEditingBlocker] = useState(false);
  const [blockerDraft, setBlockerDraft] = useState(task.blocker || "");
  const blockerRef = useRef(null);

  useEffect(() => { setBlockerDraft(task.blocker || ""); }, [task.blocker]);

  const handleDragStart = (e) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
  };
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("dragging");
  };

  const commitBlocker = () => {
    setEditingBlocker(false);
    if (blockerDraft.trim() !== (task.blocker || "").trim()) {
      onUpdate({ ...task, blocker: blockerDraft.trim() });
    }
  };

  const hasBlocker = (task.blocker && task.blocker.trim().length > 0) || editingBlocker;
  const overdue = daysLeft < 0;

  return (
    <div
      className="card"
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, task); }}
      onClick={() => onEdit && onEdit(task)}
      style={{
        "--p-color": priorityColor(level),
        "--p-tint": priorityTint(level),
      }}
    >
      <div className="card-top">
        <span className="card-contract">{contract ? contract.code : "—"}</span>
        <span className="card-type">{task.type}</span>
      </div>

      <div className="card-title">{task.title}</div>

      {hasBlocker && (
        <div className="card-blocker" onClick={(e) => e.stopPropagation()}>
          <span className="card-blocker-label">Blocker</span>
          {editingBlocker ? (
            <textarea
              ref={blockerRef}
              autoFocus
              value={blockerDraft}
              onChange={(e) => setBlockerDraft(e.target.value)}
              onBlur={commitBlocker}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setBlockerDraft(task.blocker || ""); setEditingBlocker(false); }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitBlocker();
              }}
              placeholder="What's blocking this task?"
            />
          ) : (
            <span
              style={{ cursor: "text", display: "block" }}
              onClick={() => setEditingBlocker(true)}
            >
              {task.blocker || <em style={{ opacity: 0.6 }}>Click to add blocker note…</em>}
            </span>
          )}
        </div>
      )}

      <div className="card-bottom">
        <PriorityChip level={level} onChipClick={(e) => onChipClick(e, task)} />
        <span className="card-meta">
          {formatShort(task.assignmentDate)} <span className="card-meta-sep">→</span> {formatShort(task.dueDate)}
        </span>
        {!hasBlocker && (
          <button
            className="card-meta"
            onClick={(e) => { e.stopPropagation(); setEditingBlocker(true); }}
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--ink-3)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              textDecorationStyle: "dotted",
            }}
            title="Add blocker note"
          >+ blocker</button>
        )}
        <span style={{ marginLeft: hasBlocker ? "auto" : 0 }}>
          <Avatar person={person} size={24} />
        </span>
      </div>

      {(overdue || level >= 4) && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
          <span className="card-aging">
            {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
          {task.priorityOverride != null && (
            <span className="card-aging" style={{ background: "var(--chip-bg)" }}>
              manual
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AddCardStub({ onClick, label = "Add task" }) {
  return (
    <button className="card-add" onClick={onClick}>
      + {label}
    </button>
  );
}

Object.assign(window, { TaskCard, Avatar, PriorityChip, AddCardStub });
