import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PALETTE } from "../lib/palette";

// Dev-only seed. Mirrors reference/prototype/data.jsx PEOPLE + CONTRACTS
// + the 15 active seed tasks. Refuses to run when NODE_ENV=production.
//
// Idempotent within a dev environment: deletes every row first, then
// inserts a fresh set. Safe to re-run.

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and adjust.");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const DAY_MS = 24 * 60 * 60 * 1000;

function dayUTC(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10) + "T00:00:00.000Z");
}

function addDays(base: Date, n: number): Date {
  return new Date(base.getTime() + n * DAY_MS);
}

// People + accent colors verbatim from reference/prototype/data.jsx.
// Colors reference the shared PALETTE so the Admin color picker and the
// seed share one source of truth — the first four palette entries are
// the prototype's seeded colors in order.
//
// Roles spread across the three tiers so the dev board exercises each
// permission path: one Admin (top), one Commercial Manager (mid), and
// one of each bottom-tier job label.
const PEOPLE = [
  { slug: "justin", name: "Justin Park", color: PALETTE[0].hex, role: "ADMIN" as const },
  { slug: "swati", name: "Swati Iyer", color: PALETTE[1].hex, role: "COMMERCIAL_MANAGER" as const },
  { slug: "michael", name: "Michael Brennan", color: PALETTE[2].hex, role: "ESTIMATOR" as const },
  { slug: "francisco", name: "Francisco Aguilar", color: PALETTE[3].hex, role: "SCHEDULER" as const },
] as const;

type PersonSlug = (typeof PEOPLE)[number]["slug"];

// Contracts verbatim from data.jsx
const CONTRACTS = [
  { slug: "northgate", name: "Northgate Tower", code: "N36054" },
  { slug: "bayfront", name: "Bayfront Refit", code: "B41207" },
  { slug: "hartwell", name: "Hartwell Logistics", code: "H29183" },
  { slug: "verdant", name: "Verdant Phase II", code: "V52461" },
] as const;

type ContractSlug = (typeof CONTRACTS)[number]["slug"];

type TaskTypeStr = "ESTIMATE" | "SCHEDULE" | "OTHER";

// The 15 active seed tasks from data.jsx's seedTasks(). The historical
// completed tasks from seedCompleted() are intentionally omitted —
// they were Math.random()-driven and add nothing for Phase 2.
const TASK_SEED: Array<{
  daysAgo: number;
  title: string;
  contract: ContractSlug;
  assignee: PersonSlug | null;
  type: TaskTypeStr;
  blockerNote?: string;
}> = [
  { daysAgo: 0, title: "Re-estimate steel package for Tower 3", contract: "northgate", assignee: null, type: "ESTIMATE" },
  { daysAgo: 1, title: "Mobilization schedule revision Q2", contract: "bayfront", assignee: "michael", type: "SCHEDULE" },
  { daysAgo: 3, title: "Pricing analysis on MEP scope changes", contract: "northgate", assignee: "swati", type: "ESTIMATE" },
  {
    daysAgo: 4,
    title: "Concrete pour sequence — east wing",
    contract: "hartwell",
    assignee: "francisco",
    type: "SCHEDULE",
    blockerNote:
      "Waiting on geotech sign-off before resequencing the pour. Estimated 2 day delay.",
  },
  { daysAgo: 6, title: "Verdant facade subcontractor bids", contract: "verdant", assignee: "swati", type: "ESTIMATE" },
  { daysAgo: 2, title: "Hartwell loading dock LOI review", contract: "hartwell", assignee: "justin", type: "OTHER" },
  { daysAgo: 8, title: "Crane lift plan — North block", contract: "northgate", assignee: "michael", type: "SCHEDULE" },
  {
    daysAgo: 10,
    title: "Subcontractor schedule consolidation",
    contract: "bayfront",
    assignee: "francisco",
    type: "SCHEDULE",
    blockerNote:
      "Need updated availability from 3 trades. Following up with PMs this week.",
  },
  { daysAgo: 5, title: "Verdant cost reconciliation Q1", contract: "verdant", assignee: "justin", type: "ESTIMATE" },
  { daysAgo: 12, title: "Bayfront ETC re-baseline", contract: "bayfront", assignee: "swati", type: "ESTIMATE" },
  { daysAgo: 0, title: "Owner change directive #14 pricing", contract: "northgate", assignee: null, type: "ESTIMATE" },
  { daysAgo: 7, title: "Procurement long-lead update", contract: "hartwell", assignee: "michael", type: "OTHER" },
  { daysAgo: 2, title: "Float analysis on critical path", contract: "verdant", assignee: "francisco", type: "SCHEDULE" },
  { daysAgo: 9, title: "Demolition phasing scope clarification", contract: "hartwell", assignee: "justin", type: "SCHEDULE" },
  { daysAgo: 1, title: "RFI log review — week of May 18", contract: "bayfront", assignee: "justin", type: "OTHER" },
];

async function main() {
  console.log("→ Clearing existing rows…");
  // FK dependency order: children first
  await db.auditLog.deleteMany();
  await db.userPreference.deleteMany();
  await db.allowedUser.deleteMany();
  await db.card.deleteMany();
  await db.contract.deleteMany();
  await db.person.deleteMany();

  console.log("→ Seeding people…");
  // Position pre-set per PEOPLE array order so the dev board column order
  // matches reference/prototype/data.jsx.
  const personIdBySlug = new Map<PersonSlug, string>();
  for (let idx = 0; idx < PEOPLE.length; idx++) {
    const p = PEOPLE[idx]!;
    const created = await db.person.create({
      data: { name: p.name, color: p.color, role: p.role, position: idx + 1 },
    });
    personIdBySlug.set(p.slug, created.id);
  }

  console.log("→ Seeding contracts…");
  const contractIdBySlug = new Map<ContractSlug, string>();
  for (const c of CONTRACTS) {
    const created = await db.contract.create({
      data: { code: c.code, name: c.name },
    });
    contractIdBySlug.set(c.slug, created.id);
  }

  console.log("→ Seeding cards…");
  const today = new Date();
  // Per-bucket position counter — keys are assigneeId (or "__backlog")
  const positionByBucket = new Map<string, number>();
  function nextPosition(bucket: string): number {
    const next = (positionByBucket.get(bucket) ?? 0) + 1000;
    positionByBucket.set(bucket, next);
    return next;
  }

  const cardRows = TASK_SEED.map((t) => {
    const assigneeId = t.assignee ? personIdBySlug.get(t.assignee)! : null;
    const contractId = contractIdBySlug.get(t.contract)!;
    const bucket = assigneeId ?? "__backlog";
    return {
      title: t.title,
      type: t.type,
      assignmentDate: dayUTC(addDays(today, -t.daysAgo)),
      dueDate: dayUTC(addDays(today, 14 - t.daysAgo)),
      blockerNote: t.blockerNote ?? null,
      position: nextPosition(bucket),
      assigneeId,
      contractId,
    };
  });

  await db.card.createMany({ data: cardRows });

  const [peopleCount, contractCount, cardCount] = await Promise.all([
    db.person.count(),
    db.contract.count(),
    db.card.count(),
  ]);
  console.log(
    `✓ Seed complete — ${peopleCount} people, ${contractCount} contracts, ${cardCount} cards (all active).`,
  );
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
