import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Onboarding shows until first decided comparison; mic check nav is hidden under 5 finished", async ({ page }) => {
  await addBook(page, { title: "Book One", author: "Author A" });
  await addBook(page, { title: "Book Two", author: "Author B" });
  await addBook(page, { title: "Book Three", author: "Author C" });
  await addBook(page, { title: "Book Four", author: "Author D" });
  await addBook(page, { title: "Book Five", author: "Author E" });

  const onboarding = page.locator('[data-kind="onboarding-init"]');
  await expect(onboarding).toBeVisible();

  // Under 5 finished, CTA is disabled.
  await setRowFinished(page, "Book One", true);
  await expect(onboarding.locator('[data-action="start:miccheck"]')).toBeDisabled();

  // Reach 5 finished: CTA enables.
  await setRowFinished(page, "Book Two", true);
  await setRowFinished(page, "Book Three", true);
  await setRowFinished(page, "Book Four", true);
  await setRowFinished(page, "Book Five", true);

  await expect(onboarding.locator('[data-action="start:miccheck"]')).toBeEnabled();

  // Start mic check and record one decided comparison.
  await onboarding.locator('[data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await winA(page);

  // After first decided comparison, onboarding disappears.
  await page.locator('[data-action="nav:library"]').click();
  await expect(page.locator('[data-kind="onboarding-init"]')).toHaveCount(0);
});
