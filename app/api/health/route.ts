// Container healthcheck endpoint.
//
// Returns 200 OK + JSON so Docker / Caddy / external uptime checks can
// confirm the Node process is alive and serving requests. Deliberately
// does NOT touch the DB — postgres has its own healthcheck (pg_isready)
// and we don't want a transient DB blip to cycle the app container.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
