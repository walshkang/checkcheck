import { test, expect } from "@playwright/test";
import { gotoApp, wipeAll, addBook, setLibraryView, setRowFinished, startMicCheck, winA } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);
});

test("Stars widget uses overlay contract (no double stars)", async ({ page }) => {
  await addBook(page, { title: "Alpha", author: "A" });
  await addBook(page, { title: "Beta", author: "B" });
  await addBook(page, { title: "Gamma", author: "C" });
  await addBook(page, { title: "Delta", author: "D" });
  await addBook(page, { title: "Epsilon", author: "E" });

  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
  await setRowFinished(page, "Gamma", true);
  await setRowFinished(page, "Delta", true);
  await setRowFinished(page, "Epsilon", true);

  await startMicCheck(page);
  await winA(page);

  await setLibraryView(page, "finished");
  const star = page.locator(".stars").first();
  await expect(star).toBeVisible();

  const info = await star.evaluate((el) => {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const svgs = Array.from(el.querySelectorAll("svg.starSvg"));
    const clips = svgs.map((svg) => {
      const cp = svg.querySelector("clipPath rect");
      return cp ? cp.getAttribute("width") : null;
    });
    return {
      display: s.display,
      rect: { w: rect.width, h: rect.height },
      font: { family: s.fontFamily, size: s.fontSize, lineHeight: s.lineHeight },
      svgCount: svgs.length,
      clips
    };
  });

  expect(info.svgCount).toBe(5);
  expect(["inline-flex", "flex"].includes(info.display)).toBe(true);
  // Each clip rect width should be numeric in [0,24].
  for (const w of info.clips) {
    const n = Number(w);
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(24);
  }
});
