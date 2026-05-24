// data.jsx — mock data, localStorage persistence, aging logic

const PEOPLE = [
  { id: "justin",    name: "Justin Park",      role: "Estimator", color: "#d68aa6" }, // pink
  { id: "swati",     name: "Swati Iyer",       role: "Estimator", color: "#8b6f4d" }, // brown
  { id: "michael",   name: "Michael Brennan",  role: "Scheduler", color: "#7e9bb8" },
  { id: "francisco", name: "Francisco Aguilar",role: "Scheduler", color: "#7ea687" },
];

const CONTRACTS = [
  { id: "northgate",   name: "Northgate Tower",     code: "N36054" },
  { id: "bayfront",    name: "Bayfront Refit",      code: "B41207" },
  { id: "hartwell",    name: "Hartwell Logistics",  code: "H29183" },
  { id: "verdant",     name: "Verdant Phase II",    code: "V52461" },
];

const TASK_TYPES = ["Estimate", "Schedule", "Other"];

// ---- date helpers --------------------------------------------------
const DAY = 24 * 60 * 60 * 1000;
const CYCLE_DAYS = 14;

function daysBetween(a, b) {
  return Math.floor((b - a) / DAY);
}
function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}
function addDays(d, n) {
  return new Date(new Date(d).getTime() + n * DAY);
}
function formatShort(d) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- priority logic ------------------------------------------------
// Auto-priority: 0-2 = 1, 2-5 = 2, 5-8 = 3, 8-11 = 4, 11+ = 5
function autoPriority(assignmentDate, now = Date.now()) {
  const days = Math.max(0, daysBetween(new Date(assignmentDate).getTime(), now));
  const ratio = Math.min(1, days / CYCLE_DAYS);
  const lvl = Math.min(5, Math.max(1, Math.ceil(ratio * 5) || 1));
  return lvl;
}

function effectivePriority(task, now = Date.now()) {
  if (task.priorityOverride != null) return task.priorityOverride;
  return autoPriority(task.assignmentDate, now);
}

function priorityColor(level) {
  return `var(--p${level})`;
}
function priorityTint(level) {
  return `var(--p${level}-tint)`;
}
function priorityLabel(level) {
  return ["Low", "Light", "Medium", "High", "Urgent"][level - 1] || "—";
}

// ---- localStorage --------------------------------------------------
const STORE_KEY = "kanban-cm-v1";

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
}

// ---- mock seed -----------------------------------------------------
function seedTasks() {
  const today = new Date();
  const t = (daysAgo, overrides = {}) => ({
    id: "t-" + Math.random().toString(36).slice(2, 9),
    assignmentDate: isoDate(addDays(today, -daysAgo)),
    dueDate: isoDate(addDays(today, 14 - daysAgo)),
    priorityOverride: null,
    blocker: "",
    completed: false,
    createdAt: Date.now() - daysAgo * DAY,
    completedAt: null,
    ...overrides,
  });

  return [
    t(0, { title: "Re-estimate steel package for Tower 3", contract: "northgate", assignee: null,           type: "Estimate" }),
    t(1, { title: "Mobilization schedule revision Q2",     contract: "bayfront",  assignee: "michael",     type: "Schedule" }),
    t(3, { title: "Pricing analysis on MEP scope changes", contract: "northgate", assignee: "swati",       type: "Estimate" }),
    t(4, { title: "Concrete pour sequence — east wing",    contract: "hartwell",  assignee: "francisco",   type: "Schedule",
           blocker: "Waiting on geotech sign-off before resequencing the pour. Estimated 2 day delay." }),
    t(6, { title: "Verdant facade subcontractor bids",     contract: "verdant",   assignee: "swati",       type: "Estimate" }),
    t(2, { title: "Hartwell loading dock LOI review",      contract: "hartwell",  assignee: "justin",      type: "Other" }),
    t(8, { title: "Crane lift plan — North block",         contract: "northgate", assignee: "michael",     type: "Schedule" }),
    t(10,{ title: "Subcontractor schedule consolidation",  contract: "bayfront",  assignee: "francisco",   type: "Schedule",
           blocker: "Need updated availability from 3 trades. Following up with PMs this week." }),
    t(5, { title: "Verdant cost reconciliation Q1",        contract: "verdant",   assignee: "justin",      type: "Estimate" }),
    t(12,{ title: "Bayfront ETC re-baseline",              contract: "bayfront",  assignee: "swati",       type: "Estimate" }),
    t(0, { title: "Owner change directive #14 pricing",    contract: "northgate", assignee: null,           type: "Estimate" }),
    t(7, { title: "Procurement long-lead update",          contract: "hartwell",  assignee: "michael",     type: "Other" }),
    t(2, { title: "Float analysis on critical path",       contract: "verdant",   assignee: "francisco",   type: "Schedule" }),
    t(9, { title: "Demolition phasing scope clarification",contract: "hartwell",  assignee: "justin",      type: "Schedule" }),
    t(1, { title: "RFI log review — week of May 18",       contract: "bayfront",  assignee: "justin",      type: "Other" }),
  ];
}

// Pre-seed completed tasks so admin metrics have data
function seedCompleted() {
  const items = [];
  const titles = [
    "Cost roll-up Q1", "Schedule update v3", "Bid comparison MEP", "Lookahead Apr W2",
    "Change order #11", "Recovery plan — east", "MEP coordination logs", "Owner pricing pkg",
    "Subcontractor walkdown", "RFI batch close-out", "Permits tracker update",
    "Schedule narrative draft", "Risk register refresh", "Cash-flow update",
    "Pricing reconciliation", "Mobilization plan rev2",
  ];
  const contracts = CONTRACTS.map(c => c.id);
  let i = 0;
  PEOPLE.forEach((p, idx) => {
    const N = [9, 12, 8, 11][idx]; // varied counts
    for (let k = 0; k < N; k++) {
      const completedDaysAgo = Math.floor(Math.random() * 60) + 1;
      const cycleDays = Math.floor(Math.random() * 12) + 2;
      const due = addDays(new Date(), -completedDaysAgo + Math.floor(Math.random() * 6) - 2);
      const completedAt = Date.now() - completedDaysAgo * DAY;
      items.push({
        id: "tc-" + i++,
        title: titles[i % titles.length],
        contract: contracts[i % contracts.length],
        assignee: p.id,
        type: TASK_TYPES[i % TASK_TYPES.length],
        assignmentDate: isoDate(addDays(due, -cycleDays)),
        dueDate: isoDate(due),
        priorityOverride: null,
        blocker: "",
        completed: true,
        createdAt: completedAt - cycleDays * DAY,
        completedAt,
      });
    }
  });
  return items;
}

function defaultStore() {
  return {
    tasks: [...seedTasks(), ...seedCompleted()],
    // employee personal accent colors (override priority color when set)
    accents: {},
  };
}

window.KanbanData = {
  PEOPLE, CONTRACTS, TASK_TYPES,
  CYCLE_DAYS, DAY,
  autoPriority, effectivePriority, priorityColor, priorityTint, priorityLabel,
  loadStore, saveStore, defaultStore,
  daysBetween, isoDate, addDays, formatShort,
};
