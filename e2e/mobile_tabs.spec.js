import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll } from "./helpers.js";

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

async function selectTab(page, tab) {
  const bar = page.locator('[data-kind="tabbar"]');
  await expect(bar).toBeVisible();
  await bar.locator(`button[data-tab="${tab}"]`).click();
  await expect(bar.locator(`button[data-tab="${tab}"]`)).toHaveAttribute("aria-current", "page");
}

async function addFinishedManual(page, title) {
  await selectTab(page, "add");
  const form = page.locator('form[data-action="add:item"]');
  if (!(await form.isVisible())) {
    const details = page.locator('details[data-kind="manual-add"]').first();
    await details.locator("summary").click();
    await expect(form).toBeVisible();
  }
  await form.locator('input[name="title"]').fill(title);
  await form.locator('input[name="author"]').fill("Author");
  await form.locator('button[type="submit"][data-intent="finished"]').click();
  await expect(page.locator('.list-item[data-kind="library-item"]', { hasText: title })).toBeVisible();
}

test("Mobile bottom tabs switch Library sections and hide during Compare", async ({ page }) => {
  const bar = page.locator('[data-kind="tabbar"]');
  await expect(bar).toBeVisible();
  await expect(bar.locator('button[data-tab="add"]')).toHaveAttribute("aria-current", "page");

  // Add tab shows Add books, hides shelf.
  await expect(page.getByRole("heading", { name: "Add books" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your shelf" })).toBeHidden();

  // Want tab shows shelf.
  await selectTab(page, "want");
  await expect(page.getByRole("heading", { name: "Your shelf" })).toBeVisible();

  // Discover tab shows the stub.
  await selectTab(page, "discover");
  await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
  await expect(page.getByText("Coming soon: recommendations and preference signals", { exact: false })).toBeVisible();

  // Seed enough finished books to start a mic check, then ensure the tab bar is hidden in Compare.
  for (let i = 1; i <= 5; i += 1) {
    await addFinishedManual(page, `Finished ${i}`);
  }

  await page.locator('[data-kind="onboarding-init"] [data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
  await expect(page.locator('[data-kind="tabbar"]')).toHaveCount(0);
});

