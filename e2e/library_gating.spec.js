import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Start mic check is disabled until 2 finished items exist", async ({ page }) => {
  const startBtn = page.locator('[data-action="start:miccheck"]');
  await expect(startBtn).toBeDisabled();

  await addBook(page, { title: "Book One", author: "Author A" });
  await addBook(page, { title: "Book Two", author: "Author B" });

  // Items exist but not finished.
  await expect(startBtn).toBeDisabled();

  await setRowFinished(page, "Book One", true);
  await expect(startBtn).toBeDisabled();

  await setRowFinished(page, "Book Two", true);
  await expect(startBtn).toBeEnabled();
});

