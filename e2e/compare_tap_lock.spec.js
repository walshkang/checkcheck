import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, startMicCheck, expectProgress } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);

  await addBook(page, { title: "Alpha", author: "Author A" });
  await addBook(page, { title: "Beta", author: "Author B" });
  await addBook(page, { title: "Gamma", author: "Author C" });
  await addBook(page, { title: "Delta", author: "Author D" });
  await addBook(page, { title: "Epsilon", author: "Author E" });
  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
  await setRowFinished(page, "Gamma", true);
  await setRowFinished(page, "Delta", true);
  await setRowFinished(page, "Epsilon", true);
});

test("Compare cards are tappable; rapid double-tap does not double-count", async ({ page }) => {
  await startMicCheck(page);
  await expectProgress(page, 1, 10);

  const cardA = page.locator('.compareCard[data-action="compare:win"][data-winner="a"]').first();
  await expect(cardA).toBeVisible();
  const box = await cardA.boundingBox();
  expect(box).toBeTruthy();

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);

  await expectProgress(page, 2, 10);
});

