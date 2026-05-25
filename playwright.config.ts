import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Phase 14 Playwright config.
//
// Single Chromium project; serial execution (workers: 1) because the
// LISTEN/NOTIFY stack is single-process and the specs touch shared
// seed data. The setup project signs in via the dev-bypass provider
// once, saves the cookie to playwright/.auth/dev-user.json, and the
// chromium project depends on it so every spec starts authenticated.
// auth.spec clears its own state at the top to test the sign-in flow
// against an empty session.
//
// webServer reuses an already-running dev server locally (so the human
// can `npm run dev` in another terminal); CI lets Playwright boot the
// dev server itself. Production-build mode is skipped on purpose:
// AUTH_DEV_USER_EMAIL only activates when NODE_ENV !== "production",
// and `next start` runs as prod.

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/dev-user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
