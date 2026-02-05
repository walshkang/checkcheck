import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { gotoApp, wipeAll } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  // Mock Open Library search.
  await page.route("**/openlibrary.org/search.json**", async (route) => {
    const u = new URL(route.request().url());
    const q = u.searchParams.get("q") || "";
    // Default search behavior is "Prefer English".
    expect(u.searchParams.get("lang")).toBe("en");
    expect(u.searchParams.get("fields") || "").toContain("subject");
    const payload = {
      docs: [
        {
          key: "/works/OL123W",
          title: `Result for ${q}`,
          author_name: ["Some Author"],
          first_publish_year: 2001,
          isbn: ["9780000000000"],
          cover_i: 12345,
          subject: ["Science fiction", "Novel", "20th century"]
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

test("Search (flagged) -> add -> export contains optional fields -> wipe -> import preserves fields", async ({ page }, testInfo) => {
  // Enable the search panel via flag.
  await page.goto("/?search=1");

  const searchForm = page.locator('form[data-action="search:openlibrary"]');
  await expect(searchForm).toBeVisible();

  await searchForm.locator('input[name="q"]').fill("tale");
  await searchForm.locator('button[type="submit"]').click();

  const result = page.locator('.search-item[data-kind="search-result"]').first();
  await expect(result).toBeVisible();
  await expect(result).toContainText("Suggested: Fiction");

	  await result.locator('[data-action="search:add"][data-target-status="want"]').click();

  // Added to library.
  const row = page.locator('.list-item[data-kind="library-item"]').filter({ hasText: "Result for tale" }).first();
  await expect(row).toBeVisible();

  // Export and assert optional fields present.
  const [download1] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="export"]').click()
  ]);
  const out1 = testInfo.outputPath("export1.json");
  await download1.saveAs(out1);

  const obj1 = JSON.parse(await fs.readFile(out1, "utf-8"));
  const item1 = obj1?.data?.items?.find((it) => it.title === "Result for tale");
  expect(item1).toBeTruthy();
  expect(item1).toHaveProperty("source");
  expect(item1.source).toMatchObject({ provider: "openlibrary", key: "/works/OL123W" });
  expect(item1).toHaveProperty("isbn", "9780000000000");
  expect(item1).toHaveProperty("cover_url");
  expect(String(item1.cover_url)).toContain("covers.openlibrary.org");
  expect(item1).toHaveProperty("first_publish_year", 2001);
  expect(item1).toHaveProperty("raw_subjects");
  expect(Array.isArray(item1.raw_subjects)).toBeTruthy();
  expect(item1.raw_subjects).toEqual(expect.arrayContaining(["Science fiction", "Novel", "20th century"]));

  const entry1 = obj1?.data?.library_entries?.find((e) => e.item_id === item1.id);
  expect(entry1).toBeTruthy();
  expect(entry1).toHaveProperty("type_suggested", "Fiction");
  expect(entry1).toHaveProperty("type_confirmed", null);
  expect(entry1).toHaveProperty("type_decision", null);
  expect(entry1).toHaveProperty("tags");
  expect(entry1.tags).toEqual([]);

  // Wipe and import.
  await page.locator('[data-action="dev:wipeAll"]').click();

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator('[data-action="import:open"]').click()
  ]);
  await chooser.setFiles(out1);

  // Export again and confirm optional fields survived round-trip.
  const [download2] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('[data-action="export"]').click()
  ]);
  const out2 = testInfo.outputPath("export2.json");
  await download2.saveAs(out2);

  const obj2 = JSON.parse(await fs.readFile(out2, "utf-8"));
  const item2 = obj2?.data?.items?.find((it) => it.title === "Result for tale");
  expect(item2).toBeTruthy();
  expect(item2.source).toMatchObject({ provider: "openlibrary", key: "/works/OL123W" });
  expect(item2).toHaveProperty("isbn", "9780000000000");
  expect(item2).toHaveProperty("cover_url");
  expect(item2).toHaveProperty("first_publish_year", 2001);
  expect(item2).toHaveProperty("raw_subjects");
  expect(Array.isArray(item2.raw_subjects)).toBeTruthy();

  const entry2 = obj2?.data?.library_entries?.find((e) => e.item_id === item2.id);
  expect(entry2).toBeTruthy();
  expect(entry2).toHaveProperty("type_suggested", "Fiction");
  expect(entry2).toHaveProperty("type_confirmed", null);
  expect(entry2).toHaveProperty("type_decision", null);
  expect(entry2).toHaveProperty("tags");
  expect(entry2.tags).toEqual([]);
});
