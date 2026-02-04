import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Onboarding mic check banner appears only before first comparison and starts mic check", async ({ page }) => {
  await addBook(page, { title: "Book One", author: "Author A" });
  await addBook(page, { title: "Book Two", author: "Author B" });

  // Not eligible yet: only one finished.
  await setRowFinished(page, "Book One", true);
  await expect(page.locator('[data-kind="onboarding-miccheck"]')).toHaveCount(0);

  // Eligible: two finished and zero comparisons.
  await setRowFinished(page, "Book Two", true);
  const banner = page.locator('[data-kind="onboarding-miccheck"]');
  await expect(banner).toBeVisible();

  await banner.locator('[data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();

  // After one decided comparison, the banner should no longer show in Library.
  await winA(page);
  await page.locator('[data-action="nav:library"]').click();
  await expect(page.locator('[data-kind="onboarding-miccheck"]')).toHaveCount(0);
});

