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
  await addBook(page, { title: "Gamma", author: "Author C" });
  await addBook(page, { title: "Delta", author: "Author D" });
  await addBook(page, { title: "Epsilon", author: "Author E" });
  await setRowFinished(page, "Alpha", true);
  await setRowFinished(page, "Beta", true);
  await setRowFinished(page, "Gamma", true);
  await setRowFinished(page, "Delta", true);
  await setRowFinished(page, "Epsilon", true);
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
