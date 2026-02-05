import { test, expect } from "@playwright/test";
import {
  gotoApp,
  wipeAll,
  addBook,
  setLibraryView,
  setRowFinished,
  startMicCheck,
  winA,
  resetDisplay,
  rowHasStars,
  rowHasNotRated
} from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Reset display clears ratings; next decided comparison bootstraps only involved items", async ({ page }) => {
  await addBook(page, { title: "Alpha", author: "A" });
  await addBook(page, { title: "Beta", author: "B" });
  await addBook(page, { title: "Gamma", author: "C" });
  await addBook(page, { title: "Delta", author: "D" });
  await addBook(page, { title: "Epsilon", author: "E" });

  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
  await setRowFinished(page, "Gamma", true);
  await setRowFinished(page, "Delta", true);
  await setRowFinished(page, "Epsilon", true);

  // Create at least one decided comparison so some items become rated.
  await startMicCheck(page);
  await winA(page);
  await page.locator('[data-action="nav:library"]').click();
  await setLibraryView(page, "finished");

  // At least one item should now have stars, but at least one can still be not rated.
  const starsCountBefore = (await page.locator('.list-item[data-kind="library-item"] .stars').count());
  expect(starsCountBefore).toBeGreaterThan(0);

  // Reset display removes ratings entirely.
  await resetDisplay(page);
  await expect(page.locator('.list-item[data-kind="library-item"]')).toHaveCount(0);
  await setLibraryView(page, "unplaced");
  await expect(page.locator('.list-item[data-kind="library-item"] .chip').filter({ hasText: "Not rated" })).toHaveCount(5);

  // Next decided comparison should bootstrap stars for the involved pair only.
  const first = page.locator('.list-item[data-kind="library-item"]').first();
  await expect(first).toBeVisible();
  await first.locator('button[data-kind="unplaced-cta"][data-action="start:focus"]').click();
  // Capture the titles shown for A/B.
  const titles = await page.locator(".compareCard .title").allTextContents();
  const shown = titles.map((t) => t.trim()).filter(Boolean);
  expect(shown.length).toBe(2);

  await winA(page); // one decided comparison is enough to bootstrap the pair
  await page.locator('[data-action="nav:library"]').click();
  await setLibraryView(page, "finished");

  // The shown items should be rated; the rest should remain Not rated.
  const known = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];
  const shownTitles = known.filter((k) => shown.some((t) => t.includes(k)));
  expect(shownTitles.length).toBe(2);

  for (const t of shownTitles) {
    expect(await rowHasStars(page, t)).toBe(true);
  }
  const remaining = known.filter((k) => !shownTitles.includes(k));
  expect(remaining.length).toBe(3);
  await setLibraryView(page, "unplaced");
  for (const t of remaining) expect(await rowHasNotRated(page, t)).toBe(true);
});
