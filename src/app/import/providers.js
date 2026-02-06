function normKey(s) {
  return String(s ?? "").trim().toLowerCase();
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj[normKey(k)];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function parseIsoDateMaybe(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // Goodreads commonly exports dates like "2024/01/31" or "2024-01-31".
  const cleaned = s.replaceAll("/", "-");
  const d = new Date(cleaned);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

function parseNumberMaybe(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "to-read" || s === "to read" || s === "want" || s === "want to read") return "want";
  if (s === "currently-reading" || s === "currently reading" || s === "reading") return "reading";
  if (s === "read" || s === "finished") return "finished";
  // StoryGraph sometimes uses "did not finish".
  if (s === "did not finish" || s === "dnf") return "finished";
  return null;
}

export function detectProviderFromHeaders(headersLower) {
  const set = new Set(headersLower.map((h) => normKey(h)));
  if (set.has("exclusive shelf")) return "goodreads";
  if (set.has("read status") || set.has("status")) return "storygraph";
  return "unknown";
}

export function mapGoodreadsRecordToImportBook(rec) {
  const title = pick(rec, ["title"]);
  const author = pick(rec, ["author", "author l-f"]);
  const shelf = pick(rec, ["exclusive shelf"]);
  const status = normalizeStatus(shelf) ?? "want";

  const bookId = pick(rec, ["book id"]);
  const isbn13 = pick(rec, ["isbn13"]);
  const isbn = pick(rec, ["isbn"]);
  const myRating = parseNumberMaybe(pick(rec, ["my rating"]));
  const myReview = pick(rec, ["my review"]);
  const finishedAt = status === "finished" ? parseIsoDateMaybe(pick(rec, ["date read"])) : null;

  return {
    title,
    author,
    status,
    finished_at: finishedAt,
    source: { provider: "goodreads", key: bookId ? String(bookId).trim() : null },
    isbn: (isbn13 || isbn || "").trim() || null,
    legacy: {
      provider: "goodreads",
      rating: myRating,
      review: myReview ? String(myReview) : null
    }
  };
}

export function mapStoryGraphRecordToImportBook(rec) {
  const title = pick(rec, ["title", "book title"]);
  const author = pick(rec, ["author", "authors"]);
  const statusRaw = pick(rec, ["read status", "status"]);
  const status = normalizeStatus(statusRaw) ?? "want";

  const bookId = pick(rec, ["book id", "id", "storygraph id"]);
  const isbn13 = pick(rec, ["isbn13", "isbn 13", "isbn-13"]);
  const isbn = pick(rec, ["isbn"]);
  const rating = parseNumberMaybe(pick(rec, ["rating", "my rating"]));
  const review = pick(rec, ["review", "my review"]);
  const finishedAt = status === "finished" ? parseIsoDateMaybe(pick(rec, ["date read", "read date", "date finished"])) : null;

  return {
    title,
    author,
    status,
    finished_at: finishedAt,
    source: { provider: "storygraph", key: bookId ? String(bookId).trim() : null },
    isbn: (isbn13 || isbn || "").trim() || null,
    legacy: {
      provider: "storygraph",
      rating,
      review: review ? String(review) : null
    }
  };
}
