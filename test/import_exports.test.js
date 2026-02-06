import test from "node:test";
import assert from "node:assert/strict";

import { parseImportFileText } from "../src/app/import/import_file.js";

test("Goodreads CSV is detected and mapped", () => {
  const csv = [
    "Book Id,Title,Author,Exclusive Shelf,My Rating,My Review,ISBN13,Date Read",
    '123,"The, Comma Book",Alice,to-read,5,"Loved it",9780000000001,2024/01/31',
    "456,Plain Book,Bob,read,0,,,"
  ].join("\n");

  const out = parseImportFileText({ text: csv, fileName: "goodreads_library_export.csv" });
  assert.equal(out.kind, "csv_export");
  assert.equal(out.provider, "goodreads");
  assert.equal(out.books.length, 2);

  const a = out.books[0];
  assert.equal(a.title, "The, Comma Book");
  assert.equal(a.author, "Alice");
  assert.equal(a.status, "want");
  assert.equal(a.source.provider, "goodreads");
  assert.equal(a.source.key, "123");
  assert.equal(a.isbn, "9780000000001");
  assert.equal(a.legacy.provider, "goodreads");
  assert.equal(a.legacy.rating, 5);
  assert.equal(a.legacy.review, "Loved it");

  const b = out.books[1];
  assert.equal(b.status, "finished");
});

test("StoryGraph CSV is detected and mapped", () => {
  const csv = [
    "Title,Author,Read Status,Rating,Review,ISBN13,Date Read,Book Id",
    'First Book,Carol,currently-reading,4,"nice",9780000000002,,SG-1',
    "Second Book,Dan,read,5,,9780000000003,2023-12-12,SG-2"
  ].join("\n");

  const out = parseImportFileText({ text: csv, fileName: "storygraph_export.csv" });
  assert.equal(out.kind, "csv_export");
  assert.equal(out.provider, "storygraph");
  assert.equal(out.books.length, 2);

  assert.equal(out.books[0].status, "reading");
  assert.equal(out.books[1].status, "finished");
  assert.equal(out.books[1].source.key, "SG-2");
});

test("checkcheck JSON export is detected", () => {
  const obj = {
    schema_version: "v1",
    exported_at: "2026-02-06T00:00:00.000Z",
    curve_version: "v1",
    data: { items: [], library_entries: [], comparisons: [], ui_state: [] }
  };
  const out = parseImportFileText({ text: JSON.stringify(obj), fileName: "checkcheck-export.json" });
  assert.equal(out.kind, "checkcheck_json");
});

