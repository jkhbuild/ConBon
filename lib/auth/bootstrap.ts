import "server-only";
import { db } from "@/lib/db";

// First-boot bootstrap. When AllowedUser is empty AND BOOTSTRAP_MANAGER_EMAIL
// is set, insert that email with role ADMIN. The bootstrap admin then signs
// in via Google (or dev bypass) and populates the rest of the allowlist
// through the admin UI.
//
// The env var keeps the historical BOOTSTRAP_MANAGER_EMAIL name to avoid
// touching live secrets — only the role the row gets assigned changed
// when the role enum was reshaped to the Admin / Commercial Manager /
// {Analyst,Estimator,Scheduler} ladder.
//
// Idempotent: once any AllowedUser row exists, this is a no-op. Safe to
// call on every process start.
//
// Failure modes are deliberately swallowed (logged, not thrown) — instrumentation
// runs on every dev/prod boot, and a DB that's not yet reachable shouldn't
// crash the server. The bootstrap is best-effort; the allowlist check in
// auth.ts will still gate sign-ins on its own.

let bootstrapped = false;

export async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  const email = process.env.BOOTSTRAP_MANAGER_EMAIL?.toLowerCase().trim();
  if (!email) return;

  try {
    const existing = await db.allowedUser.findFirst({ select: { id: true } });
    if (existing) return;

    await db.allowedUser.create({
      data: { email, role: "ADMIN" },
    });
    console.log(`[bootstrap] Seeded ADMIN allowlist row for ${email}`);
  } catch (err) {
    console.warn("[bootstrap] Skipping — DB not reachable yet:", err);
    bootstrapped = false;
  }
}
