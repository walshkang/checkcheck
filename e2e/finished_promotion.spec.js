import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { gotoApp, wipeAll, getRowByTitle } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const payload = {
      docs: [
        {
          key: "/works/OL123W",
          title: "Search Result",
          author_name: ["Some Author"],
          first_publish_year: 2001,
          isbn: ["9780000000000"],
          cover_i: 12345,
          subject: ["Science fiction", "Novel"]
        }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload)
    });
  });

  await gotoApp(page);
  await wipeAll(page);
});

async function exportJson(page, testInfo, name) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator('[data-action="export"]').click()]);
  const out = testInfo.outputPath(name);
  await download.saveAs(out);
  return JSON.parse(await fs.readFile(out, "utf-8"));
}

test("Finished promotion: suggested -> confirmed (unless cleared)", async ({ page }, testInfo) => {
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await searchForm.locator('input[name="q"]').fill("anything");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toContainText("Suggested: Fiction");
  await result.locator('[data-action="search:add"]').click();

  const row = getRowByTitle(page, "Search Result");
  await expect(row).toBeVisible();
  await row.click();

  // Add tags and verify case-insensitive dedupe.
  const tagForm = page.locator('form[data-action="tag:add"]');
  await expect(tagForm).toBeVisible();
  await tagForm.locator('input[name="tag"]').fill("Korea");
  await tagForm.locator('button[type="submit"]').click();
  await expect(page.locator('[data-kind="detail-tags"]')).toContainText("Korea");
  await tagForm.locator('input[name="tag"]').fill("korea");
  await tagForm.locator('button[type="submit"]').click();

  // Mark finished without confirming type; should promote suggestion.
  await page.locator('[data-action="status:set"][data-status="finished"]').click();

  const obj = await exportJson(page, testInfo, "export.json");
  const item = obj?.data?.items?.find((it) => it.title === "Search Result");
  expect(item).toBeTruthy();
  const entry = obj?.data?.library_entries?.find((e) => e.item_id === item.id);
  expect(entry).toBeTruthy();
  expect(entry).toHaveProperty("type_suggested", "Fiction");
  expect(entry).toHaveProperty("type_confirmed", "Fiction");
  expect(entry).toHaveProperty("type_decision", "confirmed");
  expect(entry).toHaveProperty("tags");
  expect(entry.tags).toEqual(["Korea"]);
});

test("Finished promotion: clearing prevents promotion", async ({ page }, testInfo) => {
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await searchForm.locator('input[name="q"]').fill("anything");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toContainText("Suggested: Fiction");
  await result.locator('[data-action="search:add"]').click();

  const row = getRowByTitle(page, "Search Result");
  await expect(row).toBeVisible();
  await row.click();

  await page.locator('[data-action="type:clear"]').click();
  await page.locator('[data-action="status:set"][data-status="finished"]').click();

  const obj = await exportJson(page, testInfo, "export-cleared.json");
  const item = obj?.data?.items?.find((it) => it.title === "Search Result");
  expect(item).toBeTruthy();
  const entry = obj?.data?.library_entries?.find((e) => e.item_id === item.id);
  expect(entry).toBeTruthy();
  expect(entry).toHaveProperty("type_suggested", "Fiction");
  expect(entry).toHaveProperty("type_confirmed", null);
  expect(entry).toHaveProperty("type_decision", "cleared");
});

