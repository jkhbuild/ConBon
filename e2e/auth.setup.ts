import { test as setup, expect } from "@playwright/test";
import path from "node:path";

// Phase 14: shared sign-in setup. Runs once per `npx playwright test`
// invocation and persists the resulting session cookie so other specs
// start already authenticated.

const authFile = path.join(__dirname, "..", "playwright", ".auth", "dev-user.json");

setup("authenticate as dev-bypass user", async ({ page }) => {
  await page.goto("/signin");

  // Wait for the dev-bypass button explicitly; if it's missing the user
  // forgot to set AUTH_DEV_USER_EMAIL or the env reached production mode.
  const button = page.getByRole("button", { name: /dev bypass/i });
  await expect(button, "dev-bypass button visible (AUTH_DEV_USER_EMAIL set, NODE_ENV !== production)").toBeVisible();

  await button.click();
  await page.waitForURL("**/active", { timeout: 30_000 });
  // Account-menu trigger (replaces the Phase 14 inline sign-out button —
  // signed-in users now reach Sign out via the dropdown).
  await expect(page.getByRole("button", { name: /account menu/i })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
