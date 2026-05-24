// app.jsx — main shell, routing, modals, context menu, filters, theme

const { useState, useEffect, useMemo, useRef } = React;
const KD = window.KanbanData;
const {
  PEOPLE, CONTRACTS, TASK_TYPES,
  loadStore, saveStore, defaultStore,
  effectivePriority, priorityColor, priorityLabel, priorityTint,
  isoDate, addDays,
} = KD;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "soft",
  "layout": "columns",
  "darkVariant": "charcoal"
}/*EDITMODE-END*/;

// ============================================================
// Add / Edit task modal
// ============================================================
function TaskModal({ task, onClose, onSave, onDelete }) {
  const isNew = !task.id;
  const [draft, setDraft] = useState({
    id: task.id || ("t-" + Math.random().toString(36).slice(2, 9)),
    title: task.title || "",
    contract: task.contract || CONTRACTS[0].id,
    assignee: task.assignee || null,
    type: task.type || "Estimate",
    assignmentDate: task.assignmentDate || isoDate(new Date()),
    dueDate: task.dueDate || isoDate(addDays(new Date(), 14)),
    priorityOverride: task.priorityOverride ?? null,
    blocker: task.blocker || "",
    completed: task.completed || false,
    createdAt: task.createdAt || Date.now(),
    completedAt: task.completedAt || null,
  });

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const currentLevel = effectivePriority(draft);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{isNew ? "New task" : "Edit task"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="field-label">Title</label>
            <input
              type="text"
              autoFocus
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Re-estimate steel package"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Contract</label>
              <select value={draft.contract} onChange={(e) => set("contract", e.target.value)}>
                {CONTRACTS.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Type</label>
              <select value={draft.type} onChange={(e) => set("type", e.target.value)}>
                {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Assignee</label>
            <div className="assignee-picker">
              <button
                className={draft.assignee == null ? "active" : ""}
                onClick={() => set("assignee", null)}
              >
                <span className="avatar" style={{ width: 22, height: 22, background: "transparent", border: "1.5px dashed var(--line-strong)", color: "var(--ink-3)", fontSize: 11 }}>?</span>
                Backlog
              </button>
              {PEOPLE.map(p => {
                const initials = p.name.split(" ").map(s => s[0]).slice(0, 2).join("");
                return (
                  <button
                    key={p.id}
                    className={draft.assignee === p.id ? "active" : ""}
                    onClick={() => set("assignee", p.id)}
                  >
                    <span className="avatar" style={{ width: 22, height: 22, background: p.color, fontSize: 10 }}>{initials}</span>
                    {p.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Assignment date</label>
              <input type="date" value={draft.assignmentDate} onChange={(e) => set("assignmentDate", e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Due date</label>
              <input type="date" value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Priority {draft.priorityOverride != null ? "(manual override)" : "(auto from age)"}
            </label>
            <div className="priority-picker">
              {[1, 2, 3, 4, 5].map(lvl => (
                <button
                  key={lvl}
                  className={(draft.priorityOverride === lvl || (draft.priorityOverride == null && lvl === currentLevel)) ? "active" : ""}
                  style={{ background: priorityColor(lvl) }}
                  onClick={() => set("priorityOverride", lvl)}
                  title={priorityLabel(lvl)}
                >
                  {lvl} · {priorityLabel(lvl)}
                </button>
              ))}
            </div>
            {draft.priorityOverride != null && (
              <button
                style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--ink-3)", textDecoration: "underline", marginTop: 4 }}
                onClick={() => set("priorityOverride", null)}
              >
                Clear override → use auto-aging
              </button>
            )}
          </div>

          <div className="field">
            <label className="field-label">Blocker note (optional)</label>
            <textarea
              value={draft.blocker}
              onChange={(e) => set("blocker", e.target.value)}
              placeholder="Anything stopping work on this task?"
            />
          </div>
        </div>
        <div className="modal-foot">
          {!isNew && onDelete && (
            <button
              className="btn-ghost"
              style={{ color: "var(--p5)", marginRight: "auto" }}
              onClick={() => { onDelete(draft.id); onClose(); }}
            >
              Delete task
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { onSave(draft); onClose(); }}
            disabled={!draft.title.trim()}
          >
            {isNew ? "Create task" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Context menu
// ============================================================
function ContextMenu({ x, y, task, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") onClose(); });
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  const level = effectivePriority(task);
  // Position correction so menu doesn't go off-screen
  const adjX = Math.min(x, window.innerWidth - 220);
  const adjY = Math.min(y, window.innerHeight - 280);

  return (
    <div ref={ref} className="ctx-menu" style={{ left: adjX, top: adjY }}>
      <div className="ctx-section">Set priority</div>
      <div className="ctx-priority-row">
        {[1, 2, 3, 4, 5].map(lvl => (
          <button
            key={lvl}
            className={"ctx-priority-dot " + ((task.priorityOverride === lvl || (task.priorityOverride == null && lvl === level)) ? "active" : "")}
            style={{ background: priorityColor(lvl) }}
            onClick={() => { onAction("priority", lvl); }}
            title={priorityLabel(lvl)}
          >{lvl}</button>
        ))}
      </div>
      {task.priorityOverride != null && (
        <div className="ctx-item" onClick={() => onAction("priority", null)}>
          <span style={{ fontSize: 14 }}>↺</span> Clear manual override
        </div>
      )}
      <div className="ctx-sep"></div>
      <div className="ctx-item" onClick={() => onAction("edit")}>
        <span style={{ fontSize: 14 }}>✎</span> Edit task…
      </div>
      <div className="ctx-item" onClick={() => onAction("blocker")}>
        <span style={{ fontSize: 14 }}>⚑</span> {task.blocker ? "Edit blocker note" : "Add blocker note"}
      </div>
      <div className="ctx-sep"></div>
      <div className="ctx-item" onClick={() => onAction("complete")}>
        <span style={{ fontSize: 14 }}>✓</span> Mark as complete
      </div>
      <div className="ctx-item danger" onClick={() => onAction("delete")}>
        <span style={{ fontSize: 14 }}>🗑</span> Remove from board
      </div>
    </div>
  );
}

// ============================================================
// Filter bar
// ============================================================
function FilterBar({ filters, setFilters, onAdd, role, setRole, theme, setTheme }) {
  const toggle = (key, val) => {
    const current = filters[key];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    setFilters({ ...filters, [key]: next });
  };
  const clearAll = () => setFilters({ contracts: [], assignees: [], priorities: [] });
  const active = filters.contracts.length + filters.assignees.length + filters.priorities.length > 0;

  return (
    <div className="filterbar">
      <span className="filter-label">Contract</span>
      {CONTRACTS.map(c => (
        <button
          key={c.id}
          className={"chip" + (filters.contracts.includes(c.id) ? " active" : "")}
          onClick={() => toggle("contracts", c.id)}
        >{c.code}</button>
      ))}
      <span style={{ width: 1, height: 18, background: "var(--line)" }}></span>
      <span className="filter-label">Assignee</span>
      {PEOPLE.map(p => (
        <button
          key={p.id}
          className={"chip" + (filters.assignees.includes(p.id) ? " active" : "")}
          onClick={() => toggle("assignees", p.id)}
        >
          <span className="chip-dot" style={{ background: p.color }}></span>
          {p.name.split(" ")[0]}
        </button>
      ))}
      <span style={{ width: 1, height: 18, background: "var(--line)" }}></span>
      <span className="filter-label">Priority</span>
      {[1, 2, 3, 4, 5].map(lvl => (
        <button
          key={lvl}
          className={"chip" + (filters.priorities.includes(lvl) ? " active" : "")}
          onClick={() => toggle("priorities", lvl)}
          title={priorityLabel(lvl)}
        >
          <span className="chip-dot" style={{ background: priorityColor(lvl) }}></span>
          {lvl}
        </button>
      ))}
      {active && (
        <button className="btn-ghost" onClick={clearAll}>Clear</button>
      )}

      <div style={{ flex: 1 }}></div>
      <button className="btn-primary" onClick={() => onAdd(null)}>+ New task</button>
    </div>
  );
}

// ============================================================
// Top bar
// ============================================================
function TopBar({ role, setRole, theme, setTheme, openCount }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark"></div>
        <span>ConBon</span>
        <span className="brand-sep">·</span>
        <span className="brand-sub">Project Controls Kanban Board</span>
      </div>
      <div className="topbar-spacer"></div>

      <div style={{ fontSize: 12, color: "var(--ink-3)", marginRight: 6 }}>
        {openCount} open tasks
      </div>

      <div className="role-switch">
        <button
          className={role === "manager" ? "active" : ""}
          onClick={() => setRole("manager")}
        >Commercial Manager</button>
        <button
          className={role === "admin" ? "active" : ""}
          onClick={() => setRole("admin")}
        >Admin</button>
      </div>

      <button
        className="theme-toggle"
        onClick={() => setTheme(theme === "soft" ? "bold" : "soft")}
        title={theme === "soft" ? "Switch to bold theme" : "Switch to soft theme"}
      >
        {theme === "soft" ? (
          // moon
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          // sun
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        )}
      </button>
    </div>
  );
}

// ============================================================
// Main app
// ============================================================
function App() {
  // Tweaks-backed theme + layout
  const tweaks = useTweaks(TWEAK_DEFAULTS);
  const t = tweaks[0];
  const setTweak = tweaks[1];

  const theme = t.theme;
  const layout = t.layout;
  const darkVariant = t.darkVariant || "charcoal";
  const setTheme = (val) => setTweak("theme", val);
  const setLayout = (val) => setTweak("layout", val);
  const setDarkVariant = (val) => setTweak("darkVariant", val);

  const [role, setRole] = useState("manager");
  const [store, setStore] = useState(() => loadStore() || defaultStore());
  const [filters, setFilters] = useState({ contracts: [], assignees: [], priorities: [] });
  const [editing, setEditing] = useState(null); // task to edit, or {} for new
  const [ctx, setCtx] = useState(null);

  // Persist
  useEffect(() => { saveStore(store); }, [store]);

  // Apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (theme === "bold") document.documentElement.dataset.dark = darkVariant;
    else delete document.documentElement.dataset.dark;
  }, [theme, darkVariant]);

  // Update — periodically re-render to refresh aging
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force(x => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Filtered tasks for board
  const visibleTasks = useMemo(() => {
    return store.tasks.filter(task => {
      if (task.completed) return false;
      if (filters.contracts.length && !filters.contracts.includes(task.contract)) return false;
      if (filters.assignees.length && !filters.assignees.includes(task.assignee)) return false;
      if (filters.priorities.length) {
        const lvl = effectivePriority(task);
        if (!filters.priorities.includes(lvl)) return false;
      }
      return true;
    });
  }, [store.tasks, filters]);

  const openCount = store.tasks.filter(t => !t.completed).length;

  // Task mutations
  const updateTask = (updated) => {
    setStore(s => ({ ...s, tasks: s.tasks.map(t => t.id === updated.id ? updated : t) }));
  };
  const addTask = (newTask) => {
    setStore(s => ({ ...s, tasks: [newTask, ...s.tasks] }));
  };
  const saveTask = (draft) => {
    if (store.tasks.find(t => t.id === draft.id)) updateTask(draft);
    else addTask(draft);
  };
  const deleteTask = (id) => {
    setStore(s => ({ ...s, tasks: s.tasks.filter(t => t.id !== id) }));
  };
  const completeTask = (id) => {
    setStore(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, completed: true, completedAt: Date.now() } : t),
    }));
  };
  const moveTask = (id, newAssignee) => {
    setStore(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, assignee: newAssignee } : t) }));
  };

  const onContextMenu = (e, task) => {
    setCtx({ x: e.clientX, y: e.clientY, task });
  };
  const onCtxAction = (action, val) => {
    const task = ctx.task;
    setCtx(null);
    if (action === "priority") updateTask({ ...task, priorityOverride: val });
    else if (action === "edit") setEditing(task);
    else if (action === "blocker") {
      const note = prompt("Blocker note:", task.blocker || "");
      if (note != null) updateTask({ ...task, blocker: note });
    }
    else if (action === "complete") completeTask(task.id);
    else if (action === "delete") {
      if (confirm("Remove this task from the board?")) deleteTask(task.id);
    }
  };
  const onChipClick = (e, task) => {
    setCtx({ x: e.clientX, y: e.clientY, task });
  };

  const Board = layout === "lanes" ? BoardLanes : BoardColumns;

  return (
    <div className="app">
      <TopBar
        role={role} setRole={setRole}
        theme={theme} setTheme={setTheme}
        openCount={openCount}
      />
      {role === "manager" ? (
        <React.Fragment>
          <FilterBar
            filters={filters} setFilters={setFilters}
            onAdd={(assignee) => setEditing({ assignee })}
            role={role} setRole={setRole}
            theme={theme} setTheme={setTheme}
          />
          <div className="board-wrap">
            <Board
              tasks={visibleTasks}
              onContextMenu={onContextMenu}
              onChipClick={onChipClick}
              onEdit={setEditing}
              onUpdate={updateTask}
              onMove={moveTask}
              onAdd={(assignee) => setEditing({ assignee })}
            />
          </div>
        </React.Fragment>
      ) : (
        <AdminPage allTasks={store.tasks} />
      )}

      {editing && (
        <TaskModal
          task={editing}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}

      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y} task={ctx.task}
          onClose={() => setCtx(null)}
          onAction={onCtxAction}
        />
      )}

      <KanbanTweaks
        theme={theme} setTheme={setTheme}
        layout={layout} setLayout={setLayout}
        darkVariant={darkVariant} setDarkVariant={setDarkVariant}
        onReset={() => {
          if (confirm("Reset board to seed data? Your changes will be lost.")) {
            const s = defaultStore();
            setStore(s);
            saveStore(s);
          }
        }}
      />
    </div>
  );
}

// ============================================================
// Tweaks panel
// ============================================================
function KanbanTweaks({ theme, setTheme, layout, setLayout, darkVariant, setDarkVariant, onReset }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Appearance" />
      <TweakRadio
        label="Color theme"
        value={theme}
        onChange={setTheme}
        options={[
          { value: "soft", label: "Soft" },
          { value: "bold", label: "Bold" },
        ]}
      />
      {theme === "bold" && (
        <TweakRadio
          label="Dark variant"
          value={darkVariant}
          onChange={setDarkVariant}
          options={[
            { value: "charcoal", label: "Charcoal" },
            { value: "noir",     label: "Noir" },
            { value: "forest",   label: "Forest" },
          ]}
        />
      )}
      <TweakRadio
        label="Board layout"
        value={layout}
        onChange={setLayout}
        options={[
          { value: "columns", label: "Columns" },
          { value: "lanes", label: "Swimlanes" },
        ]}
      />
      <TweakSection label="Data" />
      <TweakButton label="Reset to seed data" onClick={onReset} />
    </TweaksPanel>
  );
}

// Mount
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
