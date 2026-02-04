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
    const before = getComputedStyle(el, "::before");
    const after = getComputedStyle(el, "::after");
    const rect = el.getBoundingClientRect();
    const probe = document.createElement("span");
    probe.textContent = "★★★★★";
    probe.style.position = "absolute";
    probe.style.left = "-99999px";
    probe.style.top = "-99999px";
    probe.style.fontFamily = s.fontFamily;
    probe.style.fontSize = s.fontSize;
    probe.style.letterSpacing = s.letterSpacing;
    probe.style.whiteSpace = "nowrap";
    document.body.appendChild(probe);
    const probeRect = probe.getBoundingClientRect();
    probe.remove();
    return {
      text: (el.textContent || "").trim(),
      position: s.position,
      display: s.display,
      rect: { w: rect.width, h: rect.height },
      probe: { w: probeRect.width, h: probeRect.height },
      before: { content: before.content, display: before.display, color: before.color },
      after: {
        content: after.content,
        position: after.position,
        overflow: after.overflow,
        width: after.width,
        left: after.left,
        top: after.top
      },
      fill: s.getPropertyValue("--stars-fill").trim()
    };
  });

  expect(info.text).toBe("");
  expect(info.position).toBe("relative");
  expect(["inline-block", "block", "inline"].includes(info.display)).toBe(true);
  expect(info.before.content).toContain("★★★★★");
  expect(info.after.content).toContain("★★★★★");
  expect(info.after.position).toBe("absolute");
  expect(info.after.overflow).toBe("hidden");

  // Container should shrink-wrap to the intrinsic width of "★★★★★" in the current font/size.
  expect(Math.abs(info.rect.w - info.probe.w)).toBeLessThan(2);

  const afterWidth = Number.parseFloat(String(info.after.width).replace("px", ""));
  expect(Number.isFinite(afterWidth)).toBe(true);
  expect(afterWidth).toBeGreaterThan(0);
  expect(afterWidth).toBeLessThanOrEqual(info.rect.w + 1);
  expect(info.fill.endsWith("%")).toBe(true);
});
