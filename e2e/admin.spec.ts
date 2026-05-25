import { test, expect } from "@playwright/test";

// Phase 14 admin spec — Manager-only flows.
//
// Coverage:
//  1. /admin/people lists the bootstrap manager
//  2. Add a new Person via the Add-person modal (Employee role, default color)
//  3. /admin/access shows the manager's own email; self-row Remove is disabled
//  4. Add a new email to the allowlist
//  5. Verify the new email row renders in the list
//
// Out of scope: signing in AS the newly-allowlisted email. The dev-bypass
// provider hard-codes the email from AUTH_DEV_USER_EMAIL at module load,
// so we can't switch identities mid-test. Validating the add → list round
// trip still proves the API + UI integration end-to-end.

const RUN_ID = Date.now().toString(36);
const NEW_PERSON_NAME = `e2e-person-${RUN_ID}`;
const NEW_ALLOW_EMAIL = `e2e-allow-${RUN_ID}@example.com`;

test.describe.serial("admin: people + access", () => {
  test("/admin/people: add a person", async ({ page }) => {
    await page.goto("/admin/people");

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    // The bootstrap manager (AUTH_DEV_USER_EMAIL) must be in the table —
    // they were upserted on first sign-in by the setup project.
    await expect(page.getByText(/^manager$/i).first()).toBeVisible();

    await page.getByRole("button", { name: /add person/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add person" })).toBeVisible();

    await dialog.getByLabel("Name").fill(NEW_PERSON_NAME);
    await dialog.getByRole("button", { name: /create person/i }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("cell", { name: NEW_PERSON_NAME }),
      "new person appears in the People table",
    ).toBeVisible();
  });

  test("/admin/access: self-row Remove is disabled", async ({ page }) => {
    await page.goto("/admin/access");

    await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();

    // Exactly one Remove button is disabled — the self row. Asserting on
    // the disabled-count avoids selector ambiguity from the "Added by"
    // column, which echoes the same email back when the manager added
    // the row (Person.name defaults to the email for dev-bypass users).
    const disabledRemove = page.getByRole("button", {
      name: /^remove$/i,
      disabled: true,
    });
    await expect(disabledRemove).toHaveCount(1);
    await expect(disabledRemove).toHaveAttribute(
      "title",
      /your own allowlist/i,
    );
  });

  test("/admin/access: add a new email to the allowlist", async ({ page }) => {
    await page.goto("/admin/access");

    await page.getByLabel("Email").fill(NEW_ALLOW_EMAIL);
    await page.getByRole("button", { name: /add to allowlist/i }).click();

    // Input clears on success; the new row renders.
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(
      page.getByRole("cell", { name: NEW_ALLOW_EMAIL }),
      "new allowlist email appears in the table",
    ).toBeVisible();
  });
});
