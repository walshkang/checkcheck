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

function toSolrLanguage(code2) {
  const c = String(code2 || "").trim().toLowerCase();
  const variants = {
    en: ["eng"],
    es: ["spa"],
    fr: ["fre", "fra"],
    de: ["ger", "deu"],
    it: ["ita"],
    pt: ["por"],
    ja: ["jpn"],
    ko: ["kor"],
    zh: ["chi", "zho"]
  };
  const v = variants[c];
  return v?.[0] ?? null;
}

function languageVariants(code2) {
  const c = String(code2 || "").trim().toLowerCase();
  const variants = {
    en: ["eng"],
    es: ["spa"],
    fr: ["fre", "fra"],
    de: ["ger", "deu"],
    it: ["ita"],
    pt: ["por"],
    ja: ["jpn"],
    ko: ["kor"],
    zh: ["chi", "zho"]
  };
  return variants[c] ?? [];
}

function editionLanguages(edition) {
  const langsRaw = edition?.languages;
  const arr = Array.isArray(langsRaw) ? langsRaw : typeof langsRaw === "string" ? [{ key: langsRaw }] : [];
  const keys = [];
  for (const x of arr) {
    const k = typeof x === "string" ? x : x?.key;
    if (!k) continue;
    keys.push(String(k));
  }
  return keys;
}

function editionMatchesLanguage(edition, code2) {
  const lang = String(code2 || "").trim().toLowerCase();
  if (!lang || lang === "any") return true;
  const variants = languageVariants(lang);
  if (!variants.length) return false;
  const keys = editionLanguages(edition);
  for (const k of keys) {
    for (const v of variants) {
      if (String(k).endsWith(`/${v}`)) return true;
    }
  }
  return false;
}

function pickIsbnFromEdition(edition) {
  const isbn13 = Array.isArray(edition?.isbn_13) && edition.isbn_13.length ? String(edition.isbn_13[0]) : null;
  const isbn10 = Array.isArray(edition?.isbn_10) && edition.isbn_10.length ? String(edition.isbn_10[0]) : null;
  return isbn13 || isbn10 || null;
}

function pickCoverIdFromEdition(edition) {
  const covers = Array.isArray(edition?.covers) ? edition.covers : [];
  const id = covers.length ? covers[0] : null;
  return id != null ? Number(id) : null;
}

async function fetchEditionsForWork(workKey, { limit = 50 } = {}) {
  const key = String(workKey || "").trim();
  if (!key.startsWith("/works/")) return [];
  const url = new URL(`https://openlibrary.org${key}/editions.json`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open Library editions HTTP ${res.status}`);
  const data = await res.json();
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  return entries;
}

async function resolveEditionForWork(workKey, { language = "en" } = {}) {
  const editions = await fetchEditionsForWork(workKey, { limit: 50 });
  const lang = String(language || "en").trim().toLowerCase();

  // Prefer language match + cover, then language match, then any with cover, then first.
  const scored = editions
    .map((e) => {
      const hasCover = pickCoverIdFromEdition(e) != null;
      const langMatch = editionMatchesLanguage(e, lang);
      const score = (langMatch ? 100 : 0) + (hasCover ? 10 : 0);
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored.length ? scored[0].e : null;
  if (!best) return null;
  if (lang !== "any" && !editionMatchesLanguage(best, lang)) return null;
  return best;
}

export async function searchOpenLibrary(
  q,
  { limit = 10, language = "en", requireLanguage = false, resolveEditions = false } = {}
) {
  const lang = String(language || "en").trim().toLowerCase();
  const queryBase = String(q || "").trim();
  let query = queryBase;
  if (!query) return [];

  const url = new URL("https://openlibrary.org/search.json");
  if (requireLanguage && lang && lang !== "any") {
    const solr = toSolrLanguage(lang);
    if (solr) query = `${query} language:${solr}`;
  }
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  if (lang && lang !== "any") url.searchParams.set("lang", lang);
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

  const results = docs.map((d) => {
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

  const shouldResolve = resolveEditions && lang !== "any" && lang !== "en";
  if (!shouldResolve) return results;

  const max = Math.min(results.length, 5);
  const resolved = await Promise.all(
    results.slice(0, max).map(async (r) => {
      const workKey = r?.source?.key;
      if (!workKey) return r;
      try {
        const edition = await resolveEditionForWork(workKey, { language: lang });
        if (!edition) return r;
        const editionTitle = edition?.title ? String(edition.title) : "";
        const isbn = pickIsbnFromEdition(edition) || r.isbn;
        const coverId = pickCoverIdFromEdition(edition);
        const cover_url = coverId != null ? toCoverUrl({ cover_i: coverId, isbn }, "S") : r.cover_url || toCoverUrl({ isbn }, "S");
        return {
          ...r,
          title: editionTitle || r.title,
          isbn,
          cover_url,
          edition: {
            key: edition?.key ? String(edition.key) : null,
            languages: editionLanguages(edition)
          }
        };
      } catch {
        return r;
      }
    })
  );

  return [...resolved, ...results.slice(max)];
}
