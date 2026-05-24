// board.jsx — Layout A (columns) and Layout B (swimlanes)

const { PEOPLE: BPEOPLE, CONTRACTS: BCONTRACTS, effectivePriority: bEff } = window.KanbanData;

function DropZone({ assignee, children, onDrop, className = "" }) {
  const [over, setOver] = React.useState(false);
  return (
    <div
      className={className + (over ? " drop-target" : "")}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(id, assignee);
      }}
    >
      {children}
    </div>
  );
}

// ---------- Layout A: column lanes ----------
function BoardColumns({ tasks, onContextMenu, onChipClick, onEdit, onUpdate, onMove, onAdd }) {
  const groups = { __backlog: [] };
  BPEOPLE.forEach(p => { groups[p.id] = []; });
  tasks.forEach(t => {
    if (!t.assignee) groups.__backlog.push(t);
    else if (groups[t.assignee]) groups[t.assignee].push(t);
  });
  // Sort each column by effective priority desc, then by due date asc
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => {
      const pa = bEff(a), pb = bEff(b);
      if (pb !== pa) return pb - pa;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  });

  const cols = [
    { id: "__backlog", title: "Backlog", subtitle: "Unassigned", avatarColor: "var(--ink-2)", avatarText: "BL" },
    ...BPEOPLE.map(p => ({
      id: p.id,
      title: p.name.split(" ")[0],
      subtitle: p.role + " · In Progress",
      avatarColor: p.color,
      avatarText: p.name.split(" ").map(s => s[0]).slice(0, 2).join(""),
    })),
  ];

  return (
    <div className="board-cols" style={{ "--cols": BPEOPLE.length }}>
      {cols.map(col => (
        <DropZone
          key={col.id}
          assignee={col.id === "__backlog" ? null : col.id}
          onDrop={onMove}
          className="col"
        >
          <div className="col-head">
            <div className="col-avatar" style={{ background: col.avatarColor }}>{col.avatarText}</div>
            <div>
              <div className="col-title">{col.title}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{col.subtitle}</div>
            </div>
            <div className="col-sub">{groups[col.id].length}</div>
          </div>
          <div className="col-body">
            {groups[col.id].length === 0 && <div className="empty-col">— empty —</div>}
            {groups[col.id].map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onContextMenu={onContextMenu}
                onChipClick={onChipClick}
                onEdit={onEdit}
                onUpdate={onUpdate}
              />
            ))}
            {col.id === "__backlog" && (
              <AddCardStub onClick={() => onAdd(null)} />
            )}
          </div>
        </DropZone>
      ))}
    </div>
  );
}

// ---------- Layout B: per-person swimlanes ----------
function BoardLanes({ tasks, onContextMenu, onChipClick, onEdit, onUpdate, onMove, onAdd }) {
  const groups = { __backlog: [] };
  BPEOPLE.forEach(p => { groups[p.id] = []; });
  tasks.forEach(t => {
    if (!t.assignee) groups.__backlog.push(t);
    else if (groups[t.assignee]) groups[t.assignee].push(t);
  });
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => {
      const pa = bEff(a), pb = bEff(b);
      if (pb !== pa) return pb - pa;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  });

  return (
    <div className="board-lanes">
      {/* Backlog strip */}
      <DropZone assignee={null} onDrop={onMove} className="lane">
        <div className="lane-head">
          <div className="lane-avatar" style={{ background: "var(--ink-2)", color: "var(--bg)" }}>BL</div>
          <div>
            <div className="lane-name">Backlog</div>
            <div className="lane-role">Unassigned · drag onto an assignee to start</div>
          </div>
          <div className="lane-stats">
            <div className="lane-stat"><strong>{groups.__backlog.length}</strong> open</div>
            <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); onAdd(null); }}>+ Add task</button>
          </div>
        </div>
        <DropZone assignee={null} onDrop={onMove} className="lane-body">
          {groups.__backlog.length === 0 && <div className="empty-col" style={{ gridColumn: "1 / -1" }}>— no unassigned tasks —</div>}
          {groups.__backlog.map(task => (
            <TaskCard key={task.id} task={task}
              onContextMenu={onContextMenu} onChipClick={onChipClick}
              onEdit={onEdit} onUpdate={onUpdate} />
          ))}
        </DropZone>
      </DropZone>

      {/* Per-person */}
      {BPEOPLE.map(p => {
        const ts = groups[p.id];
        const overdue = ts.filter(t => new Date(t.dueDate) < new Date()).length;
        const urgent = ts.filter(t => bEff(t) >= 4).length;
        const initials = p.name.split(" ").map(s => s[0]).slice(0, 2).join("");
        return (
          <DropZone key={p.id} assignee={p.id} onDrop={onMove} className="lane">
            <div className="lane-head">
              <div className="lane-avatar" style={{ background: p.color }}>{initials}</div>
              <div>
                <div className="lane-name">{p.name}</div>
                <div className="lane-role">{p.role} · In Progress</div>
              </div>
              <div className="lane-stats">
                <div className="lane-stat"><strong>{ts.length}</strong> open</div>
                <div className="lane-stat"><strong>{urgent}</strong> urgent</div>
                <div className="lane-stat"><strong>{overdue}</strong> overdue</div>
              </div>
            </div>
            <DropZone assignee={p.id} onDrop={onMove} className="lane-body">
              {ts.length === 0 && <div className="empty-col" style={{ gridColumn: "1 / -1" }}>— no tasks —</div>}
              {ts.map(task => (
                <TaskCard key={task.id} task={task}
                  onContextMenu={onContextMenu} onChipClick={onChipClick}
                  onEdit={onEdit} onUpdate={onUpdate} />
              ))}
            </DropZone>
          </DropZone>
        );
      })}
    </div>
  );
}

Object.assign(window, { BoardColumns, BoardLanes });
