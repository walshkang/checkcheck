import { expect } from "@playwright/test";

export async function gotoApp(page) {
  await page.goto("/");
  // Footer is always present.
  await expect(page.locator('[data-action="dev:wipeAll"]')).toBeVisible();
}

export async function wipeAll(page) {
  page.once("dialog", (d) => d.accept());
  await page.locator('[data-action="dev:wipeAll"]').click();
}

export async function resetDisplay(page) {
  page.once("dialog", (d) => d.accept());
  await page.locator('[data-action="dev:resetDerived"]').click();
}

export async function addBook(page, { title, author }) {
  const form = page.locator('form[data-action="add:item"]');
  await form.locator('input[name="title"]').fill(title);
  await form.locator('input[name="author"]').fill(author ?? "");
  // Submit without relying on button text.
  await form.locator('input[name="author"]').press("Enter");
  await expect(getRowByTitle(page, title)).toBeVisible();
}

export function getRowByTitle(page, title) {
  return page.locator(".list-item").filter({ hasText: title }).first();
}

export async function setRowFinished(page, title, finished) {
  const row = getRowByTitle(page, title);
  await expect(row).toBeVisible();
  const chip = row.locator('button.chip[data-action="quick:status"]');
  await expect(chip).toBeVisible();
  const label = (await chip.textContent())?.trim();
  const isFinished = label === "Finished";
  if (finished !== isFinished) await chip.click();
}

export async function startMicCheck(page) {
  await page.locator('[data-action="start:miccheck"]').click();
  await expect(page.locator('[data-action="compare:skip"]')).toBeVisible();
}

export async function winA(page) {
  await page.locator('[data-action="compare:win"][data-winner="a"]').click();
}

export async function winB(page) {
  await page.locator('[data-action="compare:win"][data-winner="b"]').click();
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

