import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { gotoApp, wipeAll, addBook, setLibraryView, setRowFinished, startMicCheck, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Archive hides item from library + removes from scoring pool; restore brings it back; export preserves archived_at", async ({ page }, testInfo) => {
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

  // Create at least one comparison so we have some scoring signal.
  await startMicCheck(page);
  await winA(page);
  await page.locator('.topbar [data-action="nav:library"]').click();
  await setLibraryView(page, "finished");

  const betaRow = page
    .locator('.list-item[data-kind="library-item"]')
    .filter({ hasText: "Beta" })
    .first();
  await expect(betaRow).toBeVisible();
  const betaId = await betaRow.getAttribute("data-item-id");
  expect(betaId).toBeTruthy();

  // Archive from detail.
  await betaRow.click();
  await expect(page.getByText(/detail/i)).toBeVisible();
  await page.locator('[data-action="item:archive"]').click();
  await page.locator('.topbar [data-action="nav:library"]').click();
  await setLibraryView(page, "finished");

  // Hidden by default.
  await expect(
    page.locator('.list-item[data-kind="library-item"]').filter({ hasText: "Beta" })
  ).toHaveCount(0);

  // Export and confirm archived_at persists on library_entries.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="export"]').click()
  ]);
  const out = testInfo.outputPath("archived_export.json");
  await download.saveAs(out);
  const obj = JSON.parse(await fs.readFile(out, "utf-8"));
  const entry = obj?.data?.library_entries?.find((e) => e.item_id === betaId);
  expect(entry).toBeTruthy();
  expect(entry).toHaveProperty("archived_at");
  expect(entry.archived_at).toBeTruthy();

  // Show archived and restore.
  await page.locator('[data-action="toggle:archived"]').click();
  const betaArchivedRow = page
    .locator('.list-item[data-kind="library-item"]')
    .filter({ hasText: "Beta" })
    .first();
  await expect(betaArchivedRow).toBeVisible();
  await expect(betaArchivedRow).toContainText("Archived");

  await betaArchivedRow.click();
  await page.locator('[data-action="item:restore"]').click();
  await page.locator('.topbar [data-action="nav:library"]').click();

  // Back in active list.
  await expect(
    page.locator('.list-item[data-kind="library-item"]').filter({ hasText: "Beta" })
  ).toHaveCount(1);
});
