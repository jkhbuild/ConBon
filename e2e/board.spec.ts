import { test, expect } from "@playwright/test";

// Phase 14 board spec — exercises the critical card lifecycle.
//
// Flow:
//  1. Sign-in via the setup project's saved storage state (no re-auth here)
//  2. Create a new Backlog card with a unique title
//  3. Open the card → edit the title → save
//  4. Open the card again → Archive
//  5. Navigate to /archive → find the archived card by title
//  6. Restore it back to the board
//
// Drag-and-drop is deliberately NOT exercised: @dnd-kit + Playwright's
// `dragTo` is notoriously flaky against PointerSensor's activation
// distance, and the move mutation is covered by integration tests at
// the tRPC layer. The lifecycle bits above (create/edit/archive/restore)
// are the high-value smoke path that has caused regressions in the past.

// Use a unique suffix per run so repeated invocations don't collide on
// title-based locators. Stripped to alphanumerics for cleaner diffs in
// the audit log.
const RUN_ID = Date.now().toString(36);
const ORIGINAL_TITLE = `e2e-card-${RUN_ID}`;
const EDITED_TITLE = `${ORIGINAL_TITLE}-edited`;

test.describe.serial("board lifecycle", () => {
  test("create a card in Backlog", async ({ page }) => {
    await page.goto("/active");

    // The Backlog column header has an "Add task" "+" button. There's one
    // per column; the first matches Backlog because Backlog renders first
    // in ColumnsLayout.
    const addButtons = page.getByRole("button", { name: /add task/i });
    await expect(addButtons.first(), "Backlog Add-task button visible").toBeVisible();
    await addButtons.first().click();

    // Modal opens in create mode.
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New task" })).toBeVisible();

    await dialog.getByLabel("Title").fill(ORIGINAL_TITLE);
    await dialog.getByRole("button", { name: /create task/i }).click();

    // Modal closes; card appears on the board.
    await expect(dialog).toBeHidden();
    await expect(page.locator(".card").filter({ hasText: ORIGINAL_TITLE })).toBeVisible();
  });

  test("edit the card title", async ({ page }) => {
    await page.goto("/active");

    const card = page.locator(".card").filter({ hasText: ORIGINAL_TITLE });
    await expect(card).toBeVisible();
    await card.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit task" })).toBeVisible();

    const titleInput = dialog.getByLabel("Title");
    await titleInput.fill(EDITED_TITLE);
    // Wait for the controlled-input state to commit before clicking save —
    // React batches the onChange-driven setState, and Playwright's click
    // can fire before the re-render completes, causing handleSave to read
    // the pre-fill draft.title.
    await expect(titleInput).toHaveValue(EDITED_TITLE);

    await dialog.getByRole("button", { name: /save changes/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator(".card").filter({ hasText: EDITED_TITLE })).toBeVisible();
  });

  test("open history modal stacks on top of edit modal", async ({ page }) => {
    await page.goto("/active");

    const card = page.locator(".card").filter({ hasText: EDITED_TITLE });
    await card.click();

    const editDialog = page.getByRole("dialog");
    await expect(editDialog.getByRole("heading", { name: "Edit task" })).toBeVisible();

    await editDialog.getByRole("button", { name: /^history$/i }).click();

    // Radix sets aria-hidden on the underlying dialog when a new one stacks,
    // so getByRole("dialog") only resolves to the topmost (History). Assert
    // by heading text instead — that's what the user sees + screen readers
    // hear once the History modal takes focus.
    await expect(
      page.getByRole("heading", { name: new RegExp(`^History — ${EDITED_TITLE}$`) }),
    ).toBeVisible();

    // The audit timeline must include at least the "created" event we
    // triggered in the first spec.
    await expect(page.getByText(new RegExp(`created "${ORIGINAL_TITLE}"`))).toBeVisible();

    // Close history with Escape; edit dialog regains focus and the History
    // heading disappears.
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: /^History — / }),
    ).toBeHidden();
    await expect(editDialog.getByRole("heading", { name: "Edit task" })).toBeVisible();

    // Close edit with Escape.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("archive the card", async ({ page }) => {
    await page.goto("/active");

    const card = page.locator(".card").filter({ hasText: EDITED_TITLE });
    await card.click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /archive task/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator(".card").filter({ hasText: EDITED_TITLE })).toHaveCount(0);
  });

  test("restore the archived card", async ({ page }) => {
    await page.goto("/archive");

    const row = page.locator(".archive-row").filter({ hasText: EDITED_TITLE });
    await expect(row, "archived card visible on /archive").toBeVisible();

    // Wait for the restore HTTP response before navigating — the optimistic
    // patch removes the row instantly, but the /active RSC re-fetches from
    // the DB, which still says archivedAt != null until the server commits.
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/trpc/cards.restore") &&
          resp.request().method() === "POST" &&
          resp.status() === 200,
      ),
      row.getByRole("button", { name: /^restore$/i }).click(),
    ]);

    await expect(row).toHaveCount(0);

    // Navigate back to /active — restored card appended to its previous
    // assignee bucket (Backlog, since we created it there and never moved).
    await page.goto("/active");
    await expect(page.locator(".card").filter({ hasText: EDITED_TITLE })).toBeVisible();
  });
});
