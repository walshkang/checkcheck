import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { gotoApp, wipeAll } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  // Mock Open Library search.
  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const u = new URL(route.request().url());
    expect(u.searchParams.get("lang")).toBe("en");
    const payload = {
      docs: [
        {
          key: "/works/OL123W",
          title: "The Brothers Karamazov",
          author_name: ["Fyodor Dostoevsky"],
          first_publish_year: 1880,
          publisher: ["Penguin Classics"],
          language: ["eng"],
          isbn: ["9780374528379"],
          cover_i: 12345,
          subject: ["Fiction"]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  // Mock editions lookup for work -> edition disambiguation.
  await page.route("**/openlibrary.org/works/OL123W/editions.json**", async (route) => {
    const payload = {
      entries: [
        {
          key: "/books/OL999M",
          title: "The Brothers Karamazov",
          by_statement: "Translated by Pevear and Volokhonsky",
          publishers: ["Farrar, Straus and Giroux"],
          publish_date: "2002",
          isbn_13: ["9780374528379"],
          covers: [999],
          languages: [{ key: "/languages/eng" }]
        },
        {
          key: "/books/OL888M",
          title: "The Brothers Karamazov",
          by_statement: "Translated by Constance Garnett",
          publishers: ["Penguin Classics"],
          publish_date: "2003",
          isbn_13: ["9780140449242"],
          covers: [888],
          languages: [{ key: "/languages/eng" }]
        }
      ]
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await gotoApp(page);
  await wipeAll(page);
  await page.goto("/?search=1");
});

test("Work match in search offers Update edition preview+apply (no duplicate item)", async ({ page }, testInfo) => {
  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await searchForm.locator('input[name="q"]').fill("Karamazov Pevear");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toBeVisible();

  // First time: add.
  await result.locator('[data-action="search:add"][data-target-status="want"]').click();
  const row = page.locator('.list-item[data-kind="library-item"]').filter({ hasText: "The Brothers Karamazov" });
  await expect(row).toHaveCount(1);

  // Now that the work exists, the result offers Update edition.
  await expect(result.locator('[data-action="search:update_edition"]')).toBeVisible();
  await result.locator('[data-action="search:update_edition"]').click();

  const preview = result.locator('[data-kind="edition-preview"]');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Apply this edition");
  await expect(preview).toContainText("Farrar, Straus and Giroux");

  await preview.locator('[data-action="search:apply_edition"]').click();
  await expect(page.getByText("Edition updated.")).toBeVisible();

  // Still one row.
  await expect(row).toHaveCount(1);

  // Export includes openlibrary edition provenance.
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator('[data-action="export"]').click()]);
  const out = testInfo.outputPath("export.json");
  await download.saveAs(out);
  const obj = JSON.parse(await fs.readFile(out, "utf-8"));
  const item = obj?.data?.items?.find((it) => it.title === "The Brothers Karamazov");
  expect(item).toBeTruthy();
  expect(item.openlibrary).toMatchObject({ work_key: "/works/OL123W", edition_key: "/books/OL999M" });
  expect(item.publisher).toBe("Farrar, Straus and Giroux");
});

