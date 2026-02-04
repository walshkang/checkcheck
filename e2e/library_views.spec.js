import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setLibraryView, setRowFinished } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Library Want/Finished sub-views reflect status membership", async ({ page }) => {
  await addBook(page, { title: "Queue Book", author: "Author Q" });

  // Default view: Want.
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" })).toBeVisible();

  await setLibraryView(page, "finished");
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" })).toHaveCount(0);

  await setLibraryView(page, "want");
  await setRowFinished(page, "Queue Book", true);

  await setLibraryView(page, "finished");
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" })).toBeVisible();

  // Finished view should not allow one-click "move back" via quick status toggle.
  const row = page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" }).first();
  await expect(row.locator('button.chip[data-action="quick:status"]')).toHaveCount(0);
});

