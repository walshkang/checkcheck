import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, setLibraryView, getRowByTitle } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Detail: Update metadata shows close matches when ambiguous", async ({ page }) => {
  await page.route("https://openlibrary.org/search.json**", async (route) => {
    const body = {
      docs: [
        {
          key: "/works/OL111W",
          title: "Mock Book",
          author_name: ["Mock Author"],
          first_publish_year: 1999,
          isbn: ["9780000000001"],
          cover_i: 11,
          subject: ["Fiction", "Novel"]
        },
        {
          key: "/works/OL222W",
          title: "Mock Book",
          author_name: ["Mock Author"],
          first_publish_year: 2001,
          isbn: ["9780000000002"],
          cover_i: 22,
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

  await page.locator('[data-kind="detail-meta"] [data-action="meta:update_openlibrary"]').click();

  const pick = page.locator('[data-kind="openlibrary-pick"]');
  await expect(pick).toBeVisible();
  await expect(pick).toContainText("Mock Book");
  await expect(pick).toContainText("Mock Author");

  await pick.locator('[data-action="meta:pick_openlibrary"]').first().click();

  await expect(page.locator('[data-kind="openlibrary-preview"]')).toBeVisible();
  await page.locator('[data-kind="openlibrary-preview"] [data-action="meta:apply_openlibrary"]').click();

  await expect(page.getByText("Metadata updated.")).toBeVisible();
});

