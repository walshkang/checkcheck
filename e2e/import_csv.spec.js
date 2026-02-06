import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, setLibraryView, getRowByTitle, rowHasNotRated } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Import Goodreads CSV adds books and prompts for mic check", async ({ page }) => {
  const csv = [
    "Book Id,Title,Author,Exclusive Shelf,My Rating,My Review,ISBN13,Date Read",
    "1,Book One,Author A,read,5,,9780000000001,2024/01/01",
    "2,Book Two,Author B,read,4,,9780000000002,2024/01/02",
    "3,Book Three,Author C,read,3,,9780000000003,2024/01/03",
    "4,Book Four,Author D,read,2,,9780000000004,2024/01/04",
    "5,Book Five,Author E,read,1,,9780000000005,2024/01/05",
    "6,Want Book,Author F,to-read,0,,9780000000006,"
  ].join("\n");

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator('[data-action="import:open"]').click()
  ]);
  await chooser.setFiles([{ name: "goodreads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }]);

  await expect(page.locator('[data-kind="import-flow"]')).toBeVisible();
  await page.locator('[data-kind="import-flow"] [data-action="import:apply"]').click();

  await expect(page.getByText(/Goodreads import complete\./)).toBeVisible();
  await expect(page.locator('[data-kind="postimport-miccheck"]')).toBeVisible();

  await page.locator('[data-kind="postimport-miccheck"] [data-action="postimport:later"]').click();
  await expect(page.locator('[data-kind="postimport-miccheck"]')).toHaveCount(0);

  await expect(page.locator(".footer")).toContainText(/Finished:\s*5/);

  await setLibraryView(page, "unplaced");
  await expect(getRowByTitle(page, "Book One")).toBeVisible();
  await expect.poll(async () => rowHasNotRated(page, "Book One")).toBe(true);
});
