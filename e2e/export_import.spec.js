import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  gotoApp,
  wipeAll,
  addBook,
  setRowFinished,
  startMicCheck,
  winA
} from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Export -> wipe -> import restores library and comparisons", async ({ page }, testInfo) => {
  await addBook(page, { title: "Exported", author: "Author X" });
  await addBook(page, { title: "Imported", author: "Author Y" });
  await setRowFinished(page, "Exported", true);
  await setRowFinished(page, "Imported", true);

  await startMicCheck(page);
  await winA(page);

  // Export
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="export"]').click()
  ]);

  const outPath = testInfo.outputPath("checkcheck_export.json");
  await download.saveAs(outPath);
  const raw = await fs.readFile(outPath, "utf-8");
  const obj = JSON.parse(raw);

  expect(obj).toHaveProperty("schema_version");
  expect(obj).toHaveProperty("exported_at");
  expect(obj).toHaveProperty("curve_version");
  expect(obj).toHaveProperty("data");
  expect(obj.data).toHaveProperty("items");
  expect(obj.data).toHaveProperty("library_entries");
  expect(obj.data).toHaveProperty("comparisons");

  // Wipe
  await page.locator('[data-action="dev:wipeAll"]').click();

  // Import (file chooser is created dynamically)
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator('[data-action="import:open"]').click()
  ]);
  await chooser.setFiles(outPath);

  // After import, both items should be visible again.
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Exported" })).toBeVisible();
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: "Imported" })).toBeVisible();

  // And footer should reflect at least 1 comparison.
  await expect(page.getByText(/Comparisons:\s*[1-9]/)).toBeVisible();
});
