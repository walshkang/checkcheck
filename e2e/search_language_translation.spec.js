import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const u = new URL(route.request().url());
    const lang = u.searchParams.get("lang");
    const q = u.searchParams.get("q") || "";

    // We want a German translation if possible.
    expect(lang).toBe("de");
    expect(q).toContain("language:");

    const payload = {
      docs: [
        {
          key: "/works/OL123W",
          title: "The Metamorphosis",
          author_name: ["Franz Kafka"],
          first_publish_year: 1915,
          isbn: ["9780000000000"],
          cover_i: 123,
          subject: ["Fiction"]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.route("**/openlibrary.org/works/OL123W/editions.json**", async (route) => {
    const payload = {
      entries: [
        {
          key: "/books/OL1M",
          title: "Die Verwandlung",
          languages: [{ key: "/languages/ger" }],
          covers: [42],
          isbn_13: ["9781234567890"]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await gotoApp(page);
  await wipeAll(page);
});

test("Search: choosing German surfaces translated title when available", async ({ page }) => {
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await expect(searchForm).toBeVisible();

  await searchForm.locator('select[name="lang"]').selectOption("de");
  await searchForm.locator('input[name="q"]').fill("Die Verwandlung");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText("Die Verwandlung");
});

