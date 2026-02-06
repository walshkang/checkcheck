import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const payload = {
      docs: [
        // Wrong: listing-style title + wrong author.
        {
          key: "/works/OL999W",
          title: "To Kill a Mockingbird, Harper Lee",
          author_name: ["Not Harper"],
          first_publish_year: 2000,
          isbn: ["9780000000009"],
          cover_i: 99,
          subject: ["Fiction"]
        },
        // Correct.
        {
          key: "/works/OL123W",
          title: "To Kill a Mockingbird",
          author_name: ["Harper Lee"],
          first_publish_year: 1960,
          isbn: ["9780061120084"],
          cover_i: 42,
          subject: ["Fiction"]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await gotoApp(page);
  await wipeAll(page);
  await page.goto("/?search=1");
});

test("Search reranks listing-style false positives below exact matches", async ({ page }) => {
  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await expect(searchForm).toBeVisible();
  await searchForm.locator('input[name="q"]').fill("to kill a mockingbird harper lee");
  await searchForm.locator('button[type="submit"]').click();

  const results = page.locator('.search-item[data-kind="search-result"]');
  await expect(results).toHaveCount(2);

  const first = results.nth(0);
  await expect(first).toContainText("To Kill a Mockingbird");
  await expect(first).toContainText("Harper Lee");
  await expect(first).not.toContainText("Not Harper");
});

