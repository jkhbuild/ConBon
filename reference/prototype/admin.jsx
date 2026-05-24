// admin.jsx — Employee metrics page

const { PEOPLE: APEOPLE, DAY: ADAY, daysBetween: adaysBetween } = window.KanbanData;

function AdminPage({ allTasks }) {
  const now = Date.now();
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);

  // Global metrics
  const completed = allTasks.filter(t => t.completed);
  const open = allTasks.filter(t => !t.completed);
  const completedThisMonth = completed.filter(t => t.completedAt >= startOfMonth.getTime());
  const overdueOpen = open.filter(t => new Date(t.dueDate).getTime() < now);

  const avgCycleDays = completed.length
    ? (completed.reduce((s, t) => s + Math.max(0, adaysBetween(t.createdAt, t.completedAt)), 0) / completed.length).toFixed(1)
    : "—";

  // Per-person rows
  const rows = APEOPLE.map(p => {
    const mine = allTasks.filter(t => t.assignee === p.id);
    const myCompleted = mine.filter(t => t.completed);
    const myCompletedMonth = myCompleted.filter(t => t.completedAt >= startOfMonth.getTime());
    const myOpen = mine.filter(t => !t.completed);
    const myPastDue = myOpen.filter(t => new Date(t.dueDate).getTime() < now);
    const myAvg = myCompleted.length
      ? (myCompleted.reduce((s, t) => s + Math.max(0, adaysBetween(t.createdAt, t.completedAt)), 0) / myCompleted.length)
      : null;

    // Per-month breakdown (last 6 months including current)
    const months = [];
    const ref = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
      const next = new Date(ref.getFullYear(), ref.getMonth() - i + 1, 1);
      const count = myCompleted.filter(t => t.completedAt >= m.getTime() && t.completedAt < next.getTime()).length;
      months.push({ label: m.toLocaleDateString("en", { month: "short" }), count });
    }
    const maxMonth = Math.max(1, ...months.map(m => m.count));

    return { p, myCompleted, myCompletedMonth, myOpen, myPastDue, myAvg, months, maxMonth };
  });

  const maxCompleted = Math.max(1, ...rows.map(r => r.myCompleted.length));

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <h1>Team performance</h1>
          <p>Employee metrics across all contracts · resets at end of month</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="metric-label">Tasks completed (all-time)</div>
          <div className="metric-value">{completed.length}</div>
          <div className="metric-sub"><span className="pos">+{completedThisMonth.length}</span> this month</div>
        </div>
        <div className="metric">
          <div className="metric-label">Current workload</div>
          <div className="metric-value">{open.length}</div>
          <div className="metric-sub">open tasks across {APEOPLE.length} team members</div>
        </div>
        <div className="metric">
          <div className="metric-label">Tasks past due</div>
          <div className="metric-value">{overdueOpen.length}</div>
          <div className="metric-sub">{overdueOpen.length === 0 ? "✓ none" : <span className="neg">needs attention</span>}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Avg time-to-completion</div>
          <div className="metric-value">{avgCycleDays}<small style={{ fontSize: 16, color: "var(--ink-3)", marginLeft: 4 }}>days</small></div>
          <div className="metric-sub">across {completed.length} completed tasks</div>
        </div>
      </div>

      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>By team member</h2>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{APEOPLE.length} active employees</span>
      </div>

      <div className="employees">
        <div className="employees-head">
          <div>Employee</div>
          <div>Completed</div>
          <div>Open</div>
          <div>Past due</div>
          <div>Avg cycle</div>
          <div>Last 6 months</div>
        </div>
        {rows.map(({ p, myCompleted, myCompletedMonth, myOpen, myPastDue, myAvg, months, maxMonth }) => {
          const initials = p.name.split(" ").map(s => s[0]).slice(0, 2).join("");
          return (
            <div className="employee-row" key={p.id}>
              <div className="employee-name">
                <div className="avatar" style={{ width: 38, height: 38, background: p.color, fontSize: 14 }}>{initials}</div>
                <div className="meta">
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </div>
              </div>
              <div>
                <div className="v">{myCompleted.length} <small>+{myCompletedMonth.length} mo</small></div>
                <div className="bar" style={{ marginTop: 6 }}>
                  <div style={{ width: (myCompleted.length / maxCompleted * 100) + "%" }}></div>
                </div>
              </div>
              <div><div className="v">{myOpen.length}</div></div>
              <div>
                <div className="v" style={{ color: myPastDue.length > 0 ? "var(--p5)" : undefined }}>{myPastDue.length}</div>
              </div>
              <div>
                <div className="v">{myAvg != null ? myAvg.toFixed(1) : "—"} <small>days</small></div>
              </div>
              <div>
                <div className="month-chart">
                  {months.map((m, i) => (
                    <div key={i}
                      title={`${m.label}: ${m.count}`}
                      style={{ height: Math.max(8, (m.count / maxMonth) * 100) + "%", background: p.color }}>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--ink-3)" }}>
                  {months.map((m, i) => <span key={i}>{m.label}</span>)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.AdminPage = AdminPage;
