function toCoverUrl({ cover_i, isbn }, size = "S") {
  // Prefer cover_i if present; fallback to ISBN if available.
  if (cover_i != null) {
    return `https://covers.openlibrary.org/b/id/${encodeURIComponent(String(cover_i))}-${size}.jpg?default=false`;
  }
  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(String(isbn))}-${size}.jpg?default=false`;
  }
  return null;
}

function normalizeRawSubjectsFromDoc(d) {
  const sources = [d?.subject, d?.subject_facet, d?.subject_key];
  const out = [];
  for (const subjects of sources) {
    const raw = Array.isArray(subjects) ? subjects : typeof subjects === "string" ? [subjects] : [];
    for (const s of raw) {
      const v = String(s || "").trim();
      if (!v) continue;
      out.push(v.length > 120 ? v.slice(0, 120) : v);
      if (out.length >= 50) return out;
    }
  }
  return out;
}

export async function searchOpenLibrary(q, { limit = 10, langMode = "prefer_en" } = {}) {
  const query = String(q || "").trim();
  if (!query) return [];

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (langMode === "prefer_en") url.searchParams.set("lang", "en");
  url.searchParams.set(
    "fields",
    [
      "key",
      "title",
      "author_name",
      "first_publish_year",
      "isbn",
      "cover_i",
      "subject",
      "subject_facet",
      "subject_key"
    ].join(",")
  );

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open Library HTTP ${res.status}`);

  const data = await res.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  return docs.map((d) => {
    const isbn = Array.isArray(d.isbn) && d.isbn.length ? String(d.isbn[0]) : null;
    return {
      source: { provider: "openlibrary", key: d.key ? String(d.key) : null },
      title: d.title ? String(d.title) : "",
      author: Array.isArray(d.author_name) && d.author_name.length ? String(d.author_name[0]) : "",
      first_publish_year:
        typeof d.first_publish_year === "number" ? d.first_publish_year : d.first_publish_year ?? null,
      isbn,
      cover_url: toCoverUrl({ cover_i: d.cover_i, isbn }),
      raw_subjects: normalizeRawSubjectsFromDoc(d)
    };
  });
}
