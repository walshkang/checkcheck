import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setRowFinished, startMicCheck, winA } from "./helpers.js";

async function readEvents(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("checkcheck");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      const tx = db.transaction(["events"], "readonly");
      const store = tx.objectStore("events");
      const rows = await new Promise((resolve, reject) => {
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      return Array.isArray(rows) ? rows : [];
    } finally {
      db.close();
    }
  });
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);

  await addBook(page, { title: "Alpha", author: "Author A" });
  await addBook(page, { title: "Beta", author: "Author B" });
  await addBook(page, { title: "Gamma", author: "Author C" });
  await addBook(page, { title: "Delta", author: "Author D" });
  await addBook(page, { title: "Epsilon", author: "Author E" });
  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
  await setRowFinished(page, "Gamma", true);
  await setRowFinished(page, "Delta", true);
  await setRowFinished(page, "Epsilon", true);
});

test("Compare interactions emit instrumentation events; trace can be cleared", async ({ page }) => {
  await startMicCheck(page);
  await winA(page);

  await expect.poll(async () => {
    const events = await readEvents(page);
    return events.map((e) => e.type);
  }).toEqual(expect.arrayContaining(["compare_session_started", "compare_input", "comparison_made"]));

  await page.locator('[data-action="trace:clear"]').click();
  await expect(page.getByText("Trace cleared.")).toBeVisible();

  await expect.poll(async () => {
    const events = await readEvents(page);
    return events.length;
  }).toBe(0);
});

