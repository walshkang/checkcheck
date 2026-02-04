import { test } from "@playwright/test";
import {
  gotoApp,
  wipeAll,
  addBook,
  setRowFinished,
  startMicCheck,
  winA,
  skip,
  undo,
  expectProgress
} from "./helpers.js";

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await gotoApp(page);
  await wipeAll(page);

  await addBook(page, { title: "Alpha", author: "Author A" });
  await addBook(page, { title: "Beta", author: "Author B" });
  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
});

test("Mic check increments progress; skip works; undo removes last step", async ({ page }) => {
  await startMicCheck(page);

  await expectProgress(page, 1, 10);

  await winA(page);
  await expectProgress(page, 2, 10);

  await skip(page);
  await expectProgress(page, 3, 10);

  await undo(page);
  await expectProgress(page, 2, 10);
});

