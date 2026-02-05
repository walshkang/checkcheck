import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, setLibraryView, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

async function expectUnplacedCount(page, n) {
  const queue = page.locator('[data-kind="unplaced-queue"]');
  await expect(queue).toBeVisible();
  await expect(queue).toContainText(`Unplaced (${n})`);
}

async function clickQueueCtaForTitle(page, title) {
  const row = page.locator('[data-kind="unplaced-item"]').filter({ hasText: title }).first();
  await expect(row).toBeVisible();
  await row.locator("button").first().click();
}

test("Unplaced queue is durable, locked/unlocked correctly, and shrinks after placement (persists across refresh)", async ({
  page
}) => {
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

  await setLibraryView(page, "finished");
  await expectUnplacedCount(page, 5);

  // Not initiated yet: queue CTAs should unlock via mic check (since >=5 finished).
  const queue = page.locator('[data-kind="unplaced-queue"]');
  await expect(queue.locator('button[data-action="start:miccheck"]')).toHaveCount(3); // default collapsed view

  // Unlock (start mic check) and make one decided comparison.
  await queue.locator('button[data-action="start:miccheck"]').first().click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await winA(page);

  await setLibraryView(page, "finished");
  await expectUnplacedCount(page, 5);
  await expect(queue.locator('button[data-action="start:focus"]')).toHaveCount(3);

  // Place a specific book (3 decided picks).
  await clickQueueCtaForTitle(page, "Alpha");
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await winA(page);
  await winA(page);
  await winA(page);

  const placed = page.locator('[data-kind="placed"]');
  await expect(placed).toBeVisible();
  await placed.locator('button[data-action="after_finish:back_to_finished"]').click();

  await setLibraryView(page, "finished");
  await expectUnplacedCount(page, 4);
  await expect(page.locator('[data-kind="unplaced-item"]', { hasText: "Alpha" })).toHaveCount(0);

  await page.reload();
  await setLibraryView(page, "finished");
  await expectUnplacedCount(page, 4);
});

test("Unplaced queue is locked under 5 finished", async ({ page }) => {
  await addBook(page, { title: "One", author: "A" });
  await addBook(page, { title: "Two", author: "B" });
  await addBook(page, { title: "Three", author: "C" });
  await addBook(page, { title: "Four", author: "D" });

  await setRowFinished(page, "One", true);
  await setRowFinished(page, "Two", true);
  await setRowFinished(page, "Three", true);
  await setRowFinished(page, "Four", true);

  await setLibraryView(page, "finished");
  await expectUnplacedCount(page, 4);

  const btn = page.locator('[data-kind="unplaced-item"] button').first();
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("Finish 5 books to unlock placement");
});
