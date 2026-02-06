import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, setLibraryView, getRowByTitle } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Detail: Update metadata (Open Library) fills cover and suggested type", async ({ page }) => {
  await page.route("https://openlibrary.org/search.json**", async (route) => {
    const body = {
      docs: [
        // A common false-positive: "Title, Author" listed as the title, with the wrong author.
        {
          key: "/works/OL999W",
          title: "Mock Book, Mock Author",
          author_name: ["Someone Else"],
          first_publish_year: 2011,
          isbn: ["9780000000009"],
          cover_i: 99,
          subject: ["Fiction", "Novel"]
        },
        {
          key: "/works/OL123W",
          title: "Mock Book",
          author_name: ["Mock Author"],
          first_publish_year: 2011,
          isbn: ["9780000000000"],
          cover_i: 42,
          subject: ["Fiction", "Novel"]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await addBook(page, { title: "Mock Book", author: "Mock Author" });
  await setRowFinished(page, "Mock Book", true);

  await setLibraryView(page, "unplaced");

  // Open detail
  await getRowByTitle(page, "Mock Book").locator(".title").first().click();

  await expect(page.locator('[data-kind="detail-meta"] [data-action="meta:update_openlibrary"]')).toBeVisible();
  await page.locator('[data-kind="detail-meta"] [data-action="meta:update_openlibrary"]').click();

  await expect(page.locator('[data-kind="openlibrary-preview"]')).toBeVisible();
  await expect(page.locator('[data-kind="openlibrary-preview"]')).toContainText("Mock Book");
  await expect(page.locator('[data-kind="openlibrary-preview"]')).toContainText("Mock Author");
  await page.locator('[data-kind="openlibrary-preview"] [data-action="meta:apply_openlibrary"]').click();

  await expect(page.getByText("Metadata updated.")).toBeVisible();
  await expect(page.locator('img[width="40"][height="60"]')).toBeVisible();
  await expect(page.getByText("Suggested: Fiction")).toBeVisible();
});
