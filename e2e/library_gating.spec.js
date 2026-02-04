import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Start mic check is disabled until 5 finished items exist", async ({ page }) => {
  await page.locator('[data-action="nav:compare"]').click();
  const startBtn = page.locator('[data-action="start:miccheck"]');
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await addBook(page, { title: "Book One", author: "Author A" });
  await addBook(page, { title: "Book Two", author: "Author B" });
  await addBook(page, { title: "Book Three", author: "Author C" });
  await addBook(page, { title: "Book Four", author: "Author D" });
  await addBook(page, { title: "Book Five", author: "Author E" });

  // Items exist but not finished.
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await setRowFinished(page, "Book One", true);
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await setRowFinished(page, "Book Two", true);
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await setRowFinished(page, "Book Three", true);
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await setRowFinished(page, "Book Four", true);
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeDisabled();

  await page.locator('[data-action="nav:library"]').click();
  await setRowFinished(page, "Book Five", true);
  await page.locator('[data-action="nav:compare"]').click();
  await expect(startBtn).toBeEnabled();
});
