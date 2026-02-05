import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, setLibraryView, getRowByTitle } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const payload = {
      docs: [
        {
          key: "/works/OL999W",
          title: "Upgrade Me",
          author_name: ["Some Author"],
          first_publish_year: 2001,
          isbn: ["9780000000000"],
          cover_i: 12345,
          subject: ["Novel"]
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

test("Search add intent: existing want + add as finished promotes status", async ({ page }) => {
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await searchForm.locator('input[name="q"]').fill("upgrade");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toBeVisible();

  // Add as want.
  await result.locator('[data-action="search:add"][data-target-status="want"]').click();
  await expect(getRowByTitle(page, "Upgrade Me")).toBeVisible();

  // Promote to finished via intent.
  await result.locator('[data-action="search:add"][data-target-status="finished"]').click();
  await setLibraryView(page, "unplaced");
  await expect(getRowByTitle(page, "Upgrade Me")).toBeVisible();
});

test("Search add intent: archived + add as finished restores and promotes", async ({ page }) => {
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await searchForm.locator('input[name="q"]').fill("upgrade");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toBeVisible();

  // Add as want, then archive.
  await result.locator('[data-action="search:add"][data-target-status="want"]').click();
  const row = getRowByTitle(page, "Upgrade Me");
  await row.click();
  await page.locator('[data-action="item:archive"]').click();

  // Add as finished should restore + finish.
  await page.locator('.topbar [data-action="nav:library"]').click();
  await result.locator('[data-action="search:add"][data-target-status="finished"]').click();

  await setLibraryView(page, "unplaced");
  const active = getRowByTitle(page, "Upgrade Me");
  await expect(active).toBeVisible();
  await expect(active).not.toContainText("Archived");
});
