const DB_NAME = "checkcheck";
const DB_VERSION = 1;

export const SCHEMA_VERSION = "v1";

export const STORES = {
  items: "items",
  libraryEntries: "library_entries",
  comparisons: "comparisons",
  uiState: "ui_state"
};

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
    return { items, libraryEntries, comparisons, uiState };
  });
}

export async function addItem({ title, author, source = null, isbn = null, cover_url = null, first_publish_year = null }) {
  const now = new Date().toISOString();
  const meta = {
    source: source ?? null,
    isbn: isbn ?? null,
    cover_url: cover_url ?? null,
    first_publish_year: first_publish_year ?? null
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
    const prev = await reqToPromise(s[STORES.libraryEntries].get(itemId));
    const next = {
      ...(prev ?? {}),
      item_id: itemId,
      status,
      finished_at: status === "finished" ? prev?.finished_at ?? now : null,
      created_at: prev?.created_at ?? now,
      updated_at: now
    };
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
  return withTx(Object.values(STORES), "readwrite", async (s) => {
    for (const name of Object.values(STORES)) s[name].clear();
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
