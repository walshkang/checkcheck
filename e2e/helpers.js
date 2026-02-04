import { expect } from "@playwright/test";

export async function gotoApp(page) {
  await page.goto("/");
  // Footer is always present.
  await expect(page.locator('[data-action="dev:wipeAll"]')).toBeVisible();
  await expect(page.locator('form[data-action="add:item"]')).toBeVisible();
}

export async function wipeAll(page) {
  await page.locator('[data-action="dev:wipeAll"]').click();
  // Wait for the app to finish clearing + reloading before tests proceed.
  await expect(page.locator(".toast .msg")).toHaveText(/Local data cleared\./);
  await expect(page.locator(".footer")).toContainText(/Finished:\s*0/);
  await expect(page.locator(".footer")).toContainText(/Comparisons:\s*0/);
  await expect(page.getByText("Add your first book to begin.")).toBeVisible();
}

export async function resetDisplay(page) {
  await page.locator('[data-action="dev:resetDerived"]').click();
  await expect(page.getByText("Display reset.")).toBeVisible();
}

export async function addBook(page, { title, author }) {
  const form = page.locator('form[data-action="add:item"]');
  await form.locator('input[name="title"]').fill(title);
  await form.locator('input[name="author"]').fill(author ?? "");
  await form.locator('button[type="submit"]').click();
  await expect(getRowByTitle(page, title)).toBeVisible();
}

export function getRowByTitle(page, title) {
  return page.locator('.list-item[data-kind="library-item"]').filter({ hasText: title }).first();
}

export async function setRowFinished(page, title, finished) {
  const row = getRowByTitle(page, title);
  await expect(row).toBeVisible();
  // Status changes happen via Detail (Finished view disables quick toggles by design).
  await row.click();
  const btn = page.locator(`[data-action="status:set"][data-status="${finished ? "finished" : "want"}"]`);
  await expect(btn).toBeVisible();

  const footer = page.locator(".footer").first();
  const beforeText = (await footer.textContent()) ?? "";
  const beforeMatch = beforeText.match(/Finished:\s*(\d+)/);
  const before = beforeMatch ? Number(beforeMatch[1]) : null;

  await btn.click();
  await page.locator('button.btn[data-action="nav:library"]').click();

  if (before != null) {
    const delta = finished ? 1 : -1;
    await expect.poll(async () => {
      const t = (await footer.textContent()) ?? "";
      const m = t.match(/Finished:\s*(\d+)/);
      return m ? Number(m[1]) : null;
    }).toBe(before + delta);
  }
}

export async function setLibraryView(page, view) {
  if (view !== "want" && view !== "finished") throw new Error(`Invalid library view: ${view}`);
  await page.locator('[data-action="nav:library"]').click();
  const btn = page.locator(`[data-action="library:view"][data-view="${view}"]`);
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(btn).toHaveAttribute("aria-current", "page");
}

export async function startMicCheck(page) {
  // Mic check is a separate surface; navigate there explicitly so this doesn't
  // accidentally click a different "start" CTA.
  await page.locator('[data-action="nav:compare"]').click();
  await page.locator('[data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
}

export async function winA(page) {
  await page.locator('button.btn[data-action="compare:win"][data-winner="a"]').click();
}

export async function winB(page) {
  await page.locator('button.btn[data-action="compare:win"][data-winner="b"]').click();
}

export async function skip(page) {
  await page.locator('[data-action="compare:skip"]').click();
}

export async function undo(page) {
  await page.locator('[data-action="compare:undo"]').click();
}

export function compareCard(page) {
  // Anchor to compare actions; avoid relying on copy.
  return page.locator(".card").filter({
    has: page.locator('[data-action="compare:win"][data-winner="a"]')
  });
}

export async function expectProgress(page, current, total) {
  const card = compareCard(page);
  const chip = card.locator(".row .chip").first();
  await expect(chip).toHaveText(new RegExp(`^\\s*${current}\\s*/\\s*${total}\\s*$`));
}

export async function rowHasStars(page, title) {
  const row = getRowByTitle(page, title);
  return (await row.locator(".stars").count()) > 0;
}

export async function rowHasNotRated(page, title) {
  const row = getRowByTitle(page, title);
  return (await row.locator(".chip").filter({ hasText: "Not rated" }).count()) > 0;
}
