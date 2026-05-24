// Next.js instrumentation hook — runs once per Node process at server boot.
// We use it as the home for the first-boot allowlist bootstrap so it fires
// regardless of which route is hit first.
//
// Gated on NEXT_RUNTIME === "nodejs" so we don't try to open a Prisma
// connection from the edge runtime (middleware) where Prisma can't run.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrap } = await import("@/lib/auth/bootstrap");
  await bootstrap();
}
