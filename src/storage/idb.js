const DB_NAME = "checkcheck";
const DB_VERSION = 2;

export const SCHEMA_VERSION = "v1";

export const STORES = {
  items: "items",
  libraryEntries: "library_entries",
  comparisons: "comparisons",
  uiState: "ui_state"
};

const EVENTS_STORE = "events";

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORES.items)) {
      db.createObjectStore(STORES.items, { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains(STORES.libraryEntries)) {
      db.createObjectStore(STORES.libraryEntries, { keyPath: "item_id" });
    }
    if (!db.objectStoreNames.contains(STORES.comparisons)) {
      db.createObjectStore(STORES.comparisons, { keyPath: "id", autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(STORES.uiState)) {
      db.createObjectStore(STORES.uiState, { keyPath: "key" });
    }
    // Instrumentation events are ephemeral (not durable truth) but useful for tuning/latency work.
    if (!db.objectStoreNames.contains(EVENTS_STORE)) {
      const s = db.createObjectStore(EVENTS_STORE, { keyPath: "id", autoIncrement: true });
      s.createIndex("created_at", "created_at", { unique: false });
      s.createIndex("type", "type", { unique: false });
    }
  };
  return reqToPromise(req);
}

async function withTx(storeNames, mode, fn) {
  const db = await openDb();
  const tx = db.transaction(storeNames, mode);
  const stores = {};
  for (const name of storeNames) stores[name] = tx.objectStore(name);
  const result = await fn(stores, tx);
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return result;
}

export async function loadAll() {
  return withTx(Object.values(STORES), "readonly", async (s) => {
    const [items, libraryEntries, comparisons, uiState] = await Promise.all([
      reqToPromise(s[STORES.items].getAll()),
      reqToPromise(s[STORES.libraryEntries].getAll()),
      reqToPromise(s[STORES.comparisons].getAll()),
      reqToPromise(s[STORES.uiState].getAll())
    ]);
    return {
      items: items.map(normalizeItem),
      libraryEntries: libraryEntries.map(normalizeLibraryEntry),
      comparisons,
      uiState
    };
  });
}

function normalizeItem(it) {
  const rawSubjects = Array.isArray(it?.raw_subjects) ? it.raw_subjects : [];
  const legacy = it?.legacy && typeof it.legacy === "object" ? it.legacy : {};
  const openlibrary = it?.openlibrary && typeof it.openlibrary === "object" ? it.openlibrary : null;
  return { ...it, raw_subjects: rawSubjects, legacy, openlibrary };
}

function normalizeLibraryEntry(e) {
  const tagsRaw = Array.isArray(e?.tags) ? e.tags : [];
  const tags = [];
  const seen = new Set();
  for (const t of tagsRaw) {
    const v = String(t || "").trim().replace(/\s+/g, " ");
    if (!v) continue;
    const clipped = v.length > 40 ? v.slice(0, 40) : v;
    const key = clipped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(clipped);
    if (tags.length >= 20) break;
  }

  const typeSuggested = typeof e?.type_suggested === "string" ? e.type_suggested.trim() : "";
  const typeConfirmed = typeof e?.type_confirmed === "string" ? e.type_confirmed.trim() : "";
  const decision = e?.type_decision === "confirmed" || e?.type_decision === "cleared" ? e.type_decision : null;

  return {
    ...e,
    type_suggested: typeSuggested ? typeSuggested : null,
    type_confirmed: typeConfirmed ? typeConfirmed : null,
    type_decision: decision,
    tags
  };
}

export async function addItem({
  title,
  author,
  source = null,
  isbn = null,
  cover_url = null,
  first_publish_year = null,
  raw_subjects = null,
  type_suggested = null
}) {
  const now = new Date().toISOString();
  const meta = {
    source: source ?? null,
    isbn: isbn ?? null,
    cover_url: cover_url ?? null,
    first_publish_year: first_publish_year ?? null,
    raw_subjects: Array.isArray(raw_subjects) ? raw_subjects : []
  };
  const item = {
    ...meta,
    id: crypto.randomUUID(),
    title: String(title || "").trim(),
    author: String(author || "").trim(),
    created_at: now
  };
  const entry = {
    item_id: item.id,
    status: "want",
    finished_at: null,
    type_suggested: typeof type_suggested === "string" && type_suggested.trim() ? type_suggested.trim() : null,
    type_confirmed: null,
    type_decision: null,
    tags: [],
    created_at: now,
    updated_at: now
  };

  await withTx([STORES.items, STORES.libraryEntries], "readwrite", async (s) => {
    s[STORES.items].put(item);
    s[STORES.libraryEntries].put(entry);
  });

  return { item, entry };
}

export async function setLibraryStatus(itemId, status) {
  const now = new Date().toISOString();
  return withTx([STORES.libraryEntries], "readwrite", async (s) => {
    const prevRaw = await reqToPromise(s[STORES.libraryEntries].get(itemId));
    const prev = normalizeLibraryEntry(prevRaw ?? {});
    const transitioningToFinished = prev.status !== "finished" && status === "finished";

    let next = normalizeLibraryEntry({
      ...(prevRaw ?? {}),
      ...prev,
      item_id: itemId,
      status,
      finished_at: status === "finished" ? prevRaw?.finished_at ?? now : null,
      created_at: prevRaw?.created_at ?? now,
      updated_at: now
    });

    if (
      transitioningToFinished &&
      !next.archived_at &&
      !next.type_confirmed &&
      next.type_decision !== "cleared" &&
      next.type_suggested
    ) {
      next = { ...next, type_confirmed: next.type_suggested, type_decision: "confirmed" };
    }
    s[STORES.libraryEntries].put(next);
    return next;
  });
}

export async function patchLibraryEntry(itemId, patch) {
  const now = new Date().toISOString();
  return withTx([STORES.libraryEntries], "readwrite", async (s) => {
    const prevRaw = await reqToPromise(s[STORES.libraryEntries].get(itemId));
    const prev = normalizeLibraryEntry(prevRaw ?? {});
    const next = normalizeLibraryEntry({
      ...(prevRaw ?? {}),
      ...prev,
      ...(patch ?? {}),
      item_id: itemId,
      created_at: prevRaw?.created_at ?? now,
      updated_at: now
    });
    s[STORES.libraryEntries].put(next);
    return next;
  });
}

export async function archiveItem(itemId) {
  const now = new Date().toISOString();
  return withTx([STORES.libraryEntries], "readwrite", async (s) => {
    const prev = await reqToPromise(s[STORES.libraryEntries].get(itemId));
    if (!prev) return null;
    const next = { ...prev, archived_at: now, updated_at: now };
    s[STORES.libraryEntries].put(next);
    return next;
  });
}

export async function unarchiveItem(itemId) {
  const now = new Date().toISOString();
  return withTx([STORES.libraryEntries], "readwrite", async (s) => {
    const prev = await reqToPromise(s[STORES.libraryEntries].get(itemId));
    if (!prev) return null;
    const next = { ...prev, archived_at: null, updated_at: now };
    s[STORES.libraryEntries].put(next);
    return next;
  });
}

export async function addComparison({
  item_a_id,
  item_b_id,
  winner_item_id,
  session_id = null,
  mode = null
}) {
  const row = {
    item_a_id,
    item_b_id,
    winner_item_id: winner_item_id ?? null,
    session_id,
    mode,
    created_at: new Date().toISOString()
  };
  const id = await withTx([STORES.comparisons], "readwrite", async (s) =>
    reqToPromise(s[STORES.comparisons].add(row))
  );
  return { ...row, id };
}

export async function patchItem(itemId, patch) {
  const now = new Date().toISOString();
  return withTx([STORES.items], "readwrite", async (s) => {
    const prevRaw = await reqToPromise(s[STORES.items].get(itemId));
    if (!prevRaw) throw new Error("Item not found");
    const prev = normalizeItem(prevRaw ?? {});
    const next = normalizeItem({
      ...(prevRaw ?? {}),
      ...prev,
      ...(patch ?? {}),
      id: itemId,
      updated_at: now
    });
    s[STORES.items].put(next);
    return next;
  });
}

export async function deleteLastComparison() {
  return withTx([STORES.comparisons], "readwrite", async (s) => {
    const all = await reqToPromise(s[STORES.comparisons].getAll());
    if (all.length === 0) return null;
    all.sort((a, b) => {
      if (a.created_at < b.created_at) return -1;
      if (a.created_at > b.created_at) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const last = all[all.length - 1];
    s[STORES.comparisons].delete(last.id);
    return last;
  });
}

export async function getStarsDisplayState() {
  return withTx([STORES.uiState], "readonly", async (s) => {
    const row = await reqToPromise(s[STORES.uiState].get("stars_display"));
    return row?.value ?? {};
  });
}

export async function setStarsDisplayState(value) {
  return withTx([STORES.uiState], "readwrite", async (s) => {
    s[STORES.uiState].put({
      key: "stars_display",
      value,
      updated_at: new Date().toISOString()
    });
  });
}

export async function resetDerivedState() {
  return withTx([STORES.uiState], "readwrite", async (s) => {
    s[STORES.uiState].clear();
  });
}

export async function wipeAllData() {
  return withTx([...Object.values(STORES), EVENTS_STORE], "readwrite", async (s) => {
    for (const name of Object.values(STORES)) s[name].clear();
    s[EVENTS_STORE].clear();
  });
}

export async function importExportBlob(exportObj) {
  // Truth
  const items = exportObj?.data?.items ?? [];
  const libraryEntries = exportObj?.data?.library_entries ?? [];
  const comparisons = exportObj?.data?.comparisons ?? [];
  const uiState = exportObj?.data?.ui_state ?? [];

  await wipeAllData();

  await withTx(Object.values(STORES), "readwrite", async (s) => {
    for (const it of items) s[STORES.items].put(it);
    for (const e of libraryEntries) s[STORES.libraryEntries].put(e);
    for (const c of comparisons) s[STORES.comparisons].put(c);
    for (const row of uiState) s[STORES.uiState].put(row);
  });
}

export async function exportAllData({ curveVersion }) {
  const { items, libraryEntries, comparisons, uiState } = await loadAll();
  return {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    curve_version: curveVersion,
    data: {
      items,
      library_entries: libraryEntries,
      comparisons,
      ui_state: uiState
    }
  };
}

export async function bulkAddItemsAndEntries({ items = [], libraryEntries = [] } = {}) {
  if (!Array.isArray(items) || !Array.isArray(libraryEntries)) {
    throw new Error("bulkAddItemsAndEntries expects arrays");
  }
  if (items.length === 0 && libraryEntries.length === 0) return;
  await withTx([STORES.items, STORES.libraryEntries], "readwrite", async (s) => {
    for (const it of items) s[STORES.items].put(it);
    for (const e of libraryEntries) s[STORES.libraryEntries].put(e);
  });
}

const DEFAULT_EVENTS_LIMIT = 1000;

export async function addEvent({ type, data = null, session_id = null, created_at = null } = {}) {
  const row = {
    type: String(type || "").trim() || "event",
    data: data ?? null,
    session_id: session_id ?? null,
    created_at: created_at ?? new Date().toISOString()
  };

  const id = await withTx([EVENTS_STORE], "readwrite", async (s) =>
    reqToPromise(s[EVENTS_STORE].add(row))
  );

  // Cap size (best-effort).
  // Do pruning occasionally to avoid slowing down Compare interactions.
  if (id % 50 === 0) {
    await withTx([EVENTS_STORE], "readwrite", async (s) => {
      const all = await reqToPromise(s[EVENTS_STORE].getAll());
      const limit = DEFAULT_EVENTS_LIMIT;
      if (all.length <= limit) return;
      all.sort((a, b) => {
        const ca = a?.created_at ?? "";
        const cb = b?.created_at ?? "";
        if (ca < cb) return -1;
        if (ca > cb) return 1;
        const ia = a?.id ?? 0;
        const ib = b?.id ?? 0;
        return ia < ib ? -1 : ia > ib ? 1 : 0;
      });
      const toDelete = all.slice(0, all.length - limit);
      for (const r of toDelete) s[EVENTS_STORE].delete(r.id);
    });
  }

  return { ...row, id };
}

export async function listEvents({ limit = 200 } = {}) {
  const n = Math.max(0, Math.min(DEFAULT_EVENTS_LIMIT, Number(limit) || 0));
  return withTx([EVENTS_STORE], "readonly", async (s) => {
    const all = await reqToPromise(s[EVENTS_STORE].getAll());
    all.sort((a, b) => {
      const ca = a?.created_at ?? "";
      const cb = b?.created_at ?? "";
      if (ca > cb) return -1;
      if (ca < cb) return 1;
      const ia = a?.id ?? 0;
      const ib = b?.id ?? 0;
      return ia > ib ? -1 : ia < ib ? 1 : 0;
    });
    return n ? all.slice(0, n) : [];
  });
}

export async function clearEvents() {
  return withTx([EVENTS_STORE], "readwrite", async (s) => {
    s[EVENTS_STORE].clear();
  });
}

export async function exportEvents({ app = null } = {}) {
  const events = await listEvents({ limit: DEFAULT_EVENTS_LIMIT });
  return {
    schema_version: "events_v1",
    exported_at: new Date().toISOString(),
    app: app ?? null,
    events
  };
}
