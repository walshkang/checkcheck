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
  // Quick mark-finished affordance exists in Want view (icon-only).
  const rowWant = page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" }).first();
  await expect(rowWant.locator('button.chip.icon[data-action="quick:finish"]')).toBeVisible();
  await rowWant.locator('button.chip.icon[data-action="quick:finish"]').click();

  await setLibraryView(page, "unplaced");
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" })).toBeVisible();

  // Finished view should not contain unplaced items.
  await setLibraryView(page, "finished");
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Queue Book" })).toHaveCount(0);
});
