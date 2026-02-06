import { parseCsv, rowsToObjects } from "./csv.js";
import {
  detectProviderFromHeaders,
  mapGoodreadsRecordToImportBook,
  mapStoryGraphRecordToImportBook
} from "./providers.js";

function looksLikeJson(text) {
  const s = String(text ?? "").trimStart();
  return s.startsWith("{") || s.startsWith("[");
}

function normalizeTitleAuthorKey({ title, author }) {
  const t = String(title ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
  const a = String(author ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
  return `${t}|||${a}`;
}

export function parseImportFileText({ text, fileName = "" }) {
  const raw = String(text ?? "");
  const name = String(fileName ?? "");

  if (looksLikeJson(raw) || name.toLowerCase().endsWith(".json")) {
    try {
      const obj = JSON.parse(raw);
      if (obj?.data && obj?.schema_version && obj?.data?.items && obj?.data?.library_entries) {
        return { kind: "checkcheck_json", fileName: name, exportObj: obj };
      }
      return { kind: "unknown", fileName: name, error: "JSON file is not a checkcheck export." };
    } catch {
      return { kind: "unknown", fileName: name, error: "Could not parse JSON." };
    }
  }

  if (name.toLowerCase().endsWith(".csv") || raw.includes(",")) {
    const rows = parseCsv(raw);
    const { headers, records } = rowsToObjects(rows);
    const provider = detectProviderFromHeaders(headers);
    if (provider === "unknown") {
      return {
        kind: "unknown",
        fileName: name,
        error: "Could not recognize this CSV export (expected Goodreads or StoryGraph)."
      };
    }

    const mapper = provider === "goodreads" ? mapGoodreadsRecordToImportBook : mapStoryGraphRecordToImportBook;
    const books = records
      .map(mapper)
      .map((b) => ({
        ...b,
        title: String(b.title ?? "").trim(),
        author: String(b.author ?? "").trim()
      }))
      .filter((b) => b.title);

    const statusCounts = { want: 0, reading: 0, finished: 0 };
    for (const b of books) statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1;

    const byKey = new Map();
    const deduped = [];
    for (const b of books) {
      const k =
        b.source?.key && b.source?.provider
          ? `${String(b.source.provider)}|||${String(b.source.key)}`
          : normalizeTitleAuthorKey(b);
      if (byKey.has(k)) continue;
      byKey.set(k, true);
      deduped.push(b);
    }

    return {
      kind: "csv_export",
      provider,
      fileName: name,
      books: deduped,
      statusCounts
    };
  }

  return { kind: "unknown", fileName: name, error: "Unsupported file type." };
}

export function normalizeTitleAuthorKeyForDedupe({ title, author }) {
  return normalizeTitleAuthorKey({ title, author });
}

