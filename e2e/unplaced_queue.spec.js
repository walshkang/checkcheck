import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, setLibraryView, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

async function expectUnplacedCount(page, n) {
  const header = page.locator('[data-kind="unplaced-header"]');
  if (n > 0) {
    await expect(header).toBeVisible();
    await expect(header).toContainText(`Unplaced (${n})`);
  } else {
    await expect(header).toHaveCount(0);
  }
  await expect(page.locator('.list-item[data-kind="library-item"] .chip').filter({ hasText: "Not rated" })).toHaveCount(
    n
  );
}

async function clickFirstUnplacedCta(page) {
  const row = page
    .locator('.list-item[data-kind="library-item"]')
    .filter({ has: page.locator(".chip", { hasText: "Not rated" }) })
    .first();
  await expect(row).toBeVisible();
  const title = ((await row.locator(".title").first().textContent()) ?? "").trim();
  await row.locator('button[data-kind="unplaced-cta"][data-action="start:focus"]').click();
  return title;
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

  await setLibraryView(page, "unplaced");
  await expectUnplacedCount(page, 5);

  // Not initiated yet: queue CTAs should unlock via mic check (since >=5 finished).
  await expect(page.locator('.list-item[data-kind="library-item"] button[data-action="start:miccheck"]')).toHaveCount(5);

  // Unlock (start mic check) and make one decided comparison.
  await page.locator('button[data-action="start:miccheck"]').first().click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await winA(page);

  await setLibraryView(page, "unplaced");
  const before = await page.locator('.list-item[data-kind="library-item"] .chip').filter({ hasText: "Not rated" }).count();
  expect(before).toBeGreaterThanOrEqual(1);
  await expectUnplacedCount(page, before);

  // Place a specific book (3 decided picks).
  const pickedTitle = await clickFirstUnplacedCta(page);
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await winA(page);
  await winA(page);
  await winA(page);

  const placed = page.locator('[data-kind="placed"]');
  await expect(placed).toBeVisible();
  await placed.locator('button[data-action="after_finish:back_to_finished"]').click();

  await setLibraryView(page, "unplaced");
  const after = await page.locator('.list-item[data-kind="library-item"] .chip').filter({ hasText: "Not rated" }).count();
  expect(after).toBeLessThan(before);
  await expectUnplacedCount(page, after);
  await expect(page.locator('.list-item[data-kind="library-item"]').filter({ hasText: pickedTitle })).toHaveCount(0);

  await page.reload();
  await setLibraryView(page, "unplaced");
  await expectUnplacedCount(page, after);
  await expect(page.locator('.list-item[data-kind="library-item"]').filter({ hasText: pickedTitle })).toHaveCount(0);
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

  await setLibraryView(page, "unplaced");
  await expectUnplacedCount(page, 4);

  const btn = page.locator('.list-item[data-kind="library-item"] button.btn:disabled').first();
  await expect(btn).toBeDisabled();
  await expect(btn).toContainText("Finish 5 books to unlock placement");
});
