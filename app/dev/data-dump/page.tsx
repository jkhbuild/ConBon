import { notFound } from "next/navigation";
import { getServerCaller } from "@/lib/trpc/server";

// Dev-only diagnostic page. Sanity-check that the tRPC backbone is wired
// end-to-end: server caller → routers → Prisma → Postgres → back as JSON.
// Phase 3 success criterion was 4 people + 4 contracts + 15 cards; Phase
// 5's /active board supersedes this as the integration smoke test. Kept
// around as a debugging affordance but 404'd in production builds.

export const dynamic = "force-dynamic";

export default async function DataDumpPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const trpc = await getServerCaller();
  const [people, contracts, cards] = await Promise.all([
    trpc.people.list(),
    trpc.contracts.list(),
    trpc.cards.list(),
  ]);

  const payload = {
    counts: {
      people: people.length,
      contracts: contracts.length,
      cards: cards.length,
    },
    people,
    contracts,
    cards,
  };

  return (
    <main style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: "1.5rem" }}>
      <h1 style={{ fontFamily: "system-ui, sans-serif" }}>/dev/data-dump</h1>
      <p style={{ fontFamily: "system-ui, sans-serif", color: "#555" }}>
        tRPC backbone smoke test. People: {payload.counts.people} · Contracts:{" "}
        {payload.counts.contracts} · Cards: {payload.counts.cards}
      </p>
      <pre
        style={{
          background: "#0f1115",
          color: "#e6e8eb",
          padding: "1rem",
          borderRadius: 6,
          overflow: "auto",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </main>
  );
}
