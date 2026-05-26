import { test, expect } from "@playwright/test";

// Phase 14 auth spec.
// Tests the dev-bypass sign-in flow end-to-end against an empty session
// (the global setup project's storage state is cleared here).
//
// Coverage:
//  - /active redirects to /signin when not authenticated
//  - dev-bypass button is visible (proves AUTH_DEV_USER_EMAIL + non-prod)
//  - clicking the button signs in and lands on /active
//  - the header shows the viewer's Admin role + a Sign out button
//
// Production / Google flow is intentionally out of scope — that path
// requires real OAuth credentials and a configured redirect URI.

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("auth", () => {
  test("unauthenticated /active redirects to /signin", async ({ page }) => {
    await page.goto("/active");
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole("heading", { name: "ConBon" })).toBeVisible();
  });

  test("dev-bypass sign-in lands on /active as Admin", async ({ page }) => {
    await page.goto("/signin?callbackUrl=%2Factive");

    const devBypassBtn = page.getByRole("button", { name: /dev bypass/i });
    await expect(
      devBypassBtn,
      "Dev-bypass button visible — AUTH_DEV_USER_EMAIL must be set and NODE_ENV !== production",
    ).toBeVisible();

    await devBypassBtn.click();
    await page.waitForURL("**/active", { timeout: 30_000 });

    // Header shell renders the role pill + sign-out button when authenticated.
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    // The bootstrap user is seeded as ADMIN via BOOTSTRAP_MANAGER_EMAIL.
    await expect(page.getByText(/^admin$/i).first()).toBeVisible();
  });
});
