import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setLibraryView, setRowFinished, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Calibration banner appears only before first decided comparison and starts mic check", async ({ page }) => {
  await addBook(page, { title: "Book One", author: "Author A" });
  await addBook(page, { title: "Book Two", author: "Author B" });
  await addBook(page, { title: "Book Three", author: "Author C" });
  await addBook(page, { title: "Book Four", author: "Author D" });
  await addBook(page, { title: "Book Five", author: "Author E" });

  // Not eligible yet: only one finished.
  await setRowFinished(page, "Book One", true);
  await setLibraryView(page, "finished");
  await expect(page.locator('[data-kind="initiation-miccheck"]')).toHaveCount(0);

  // Still not eligible at two/three/four finished (threshold is five).
  await setLibraryView(page, "want");
  await setRowFinished(page, "Book Two", true);
  await setLibraryView(page, "finished");
  await expect(page.locator('[data-kind="initiation-miccheck"]')).toHaveCount(0);

  await setLibraryView(page, "want");
  await setRowFinished(page, "Book Three", true);
  await setLibraryView(page, "finished");
  await expect(page.locator('[data-kind="initiation-miccheck"]')).toHaveCount(0);

  await setLibraryView(page, "want");
  await setRowFinished(page, "Book Four", true);
  await setLibraryView(page, "finished");
  await expect(page.locator('[data-kind="initiation-miccheck"]')).toHaveCount(0);

  await setLibraryView(page, "want");
  await setRowFinished(page, "Book Five", true);

  // Eligible: five finished and zero decided comparisons.
  await setLibraryView(page, "finished");
  const banner = page.locator('[data-kind="initiation-miccheck"]');
  await expect(banner).toBeVisible();

  await banner.locator('[data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();

  // After one decided comparison, the banner should no longer show in Library.
  await winA(page);
  await setLibraryView(page, "finished");
  await expect(page.locator('[data-kind="initiation-miccheck"]')).toHaveCount(0);
});
