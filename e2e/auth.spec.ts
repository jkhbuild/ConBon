import { test, expect } from "@playwright/test";

// Phase 14 auth spec.
// Tests the dev-bypass sign-in flow end-to-end against an empty session
// (the global setup project's storage state is cleared here).
//
// Coverage:
//  - /active redirects to /signin when not authenticated
//  - dev-bypass button is visible (proves AUTH_DEV_USER_EMAIL + non-prod)
//  - clicking the button signs in and lands on /active
//  - the header shows the viewer's Admin role on the account-menu trigger,
//    and opening the menu surfaces a Sign out option
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

    // Header renders the role pill as the account-menu trigger when
    // authenticated. The bootstrap user is seeded as ADMIN via
    // BOOTSTRAP_MANAGER_EMAIL, so the trigger's tag text is "ADMIN".
    const accountMenu = page.getByRole("button", { name: /account menu/i });
    await expect(accountMenu).toBeVisible();
    await expect(page.getByText(/^admin$/i).first()).toBeVisible();

    // Opening the menu surfaces the Sign out affordance (Radix
    // DropdownMenu unmounts the content while closed, so this query
    // has to come AFTER the click).
    await accountMenu.click();
    await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  });
});
