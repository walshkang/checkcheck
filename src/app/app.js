import { CURVE_VERSION } from "../rating/curve_v1.js";
import { recomputeDerived } from "../rating/recompute.js";
import * as idb from "../storage/idb.js";
import { pickPair } from "./pairs.js";
import { renderApp } from "./render.js";
import { searchOpenLibrary } from "./catalog/openlibrary.js";

function byId(arr) {
  const m = new Map();
  for (const x of arr) m.set(x.id ?? x.item_id, x);
  return m;
}

function nowIso() {
  return new Date().toISOString();
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function startApp() {
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing #app");

  const qs = new URLSearchParams(location.search);
  const searchEnabled = qs.get("search") === "1" || qs.has("search");

  const state = {
    surface: "library",
    items: [],
    itemsById: new Map(),
    libraryEntries: [],
    libraryByItemId: new Map(),
    comparisons: [],
    uiStarsDisplayById: {},

    derivedById: new Map(),
    rankById: new Map(),
    finishedIds: [],
    scoredIds: [],
    libraryRows: [],

    detailItemId: null,
    session: null,
    currentPair: null,
    toast: null,

    searchEnabled,
    searchQuery: "",
    searchStatus: "idle", // idle | loading | done | error
    searchResults: [],
    searchError: null,
    searchRequestId: 0
  };

  function setToast(msg, { hint = null, ms = 2500 } = {}) {
    const id = crypto.randomUUID();
    state.toast = { id, msg, hint };
    render();
    setTimeout(() => {
      if (state.toast?.id === id) {
        state.toast = null;
        render();
      }
    }, ms);
  }

  async function recomputeAndPersist() {
    const prior = state.uiStarsDisplayById ?? {};
    const { derivedById, rankById } = recomputeDerived(
      {
        libraryEntries: state.libraryEntries,
        comparisons: state.comparisons,
        priorDisplayByItemId: prior
      },
      { curve: CURVE_VERSION, bootstrapItemIds: [] }
    );

    state.derivedById = derivedById;
    state.rankById = rankById;

    const nextStars = {};
    for (const [id, d] of derivedById.entries()) {
      if (d.stars_display != null) nextStars[id] = d.stars_display;
    }
    state.uiStarsDisplayById = nextStars;
    await idb.setStarsDisplayState(nextStars);
  }

  async function recomputeAndPersistWithBootstrap(bootstrapItemIds) {
    const prior = state.uiStarsDisplayById ?? {};
    const { derivedById, rankById } = recomputeDerived(
      {
        libraryEntries: state.libraryEntries,
        comparisons: state.comparisons,
        priorDisplayByItemId: prior
      },
      { curve: CURVE_VERSION, bootstrapItemIds }
    );

    state.derivedById = derivedById;
    state.rankById = rankById;

    const nextStars = {};
    for (const [id, d] of derivedById.entries()) {
      if (d.stars_display != null) nextStars[id] = d.stars_display;
    }
    state.uiStarsDisplayById = nextStars;
    await idb.setStarsDisplayState(nextStars);
  }

  function rebuildSelectors() {
    state.finishedIds = state.libraryEntries
      .filter((e) => e.status === "finished")
      .map((e) => e.item_id);

    state.scoredIds = state.finishedIds.filter((id) => state.derivedById.get(id)?.is_scored);

    // List order: finished first by rank_score_raw desc; then non-finished by created_at desc.
    const finishedRows = state.finishedIds
      .slice()
      .sort((a, b) => {
        const da = state.derivedById.get(a);
        const db = state.derivedById.get(b);
        const ratedA = da?.is_rated ? 1 : 0;
        const ratedB = db?.is_rated ? 1 : 0;
        if (ratedA !== ratedB) return ratedB - ratedA;

        const ra = da?.rank_score_raw ?? -Infinity;
        const rb = db?.rank_score_raw ?? -Infinity;
        if (ra > rb) return -1;
        if (ra < rb) return 1;
        return a < b ? -1 : 1;
      })
      .map((id) => {
        const item = state.itemsById.get(id);
        const entry = state.libraryByItemId.get(id);
        return {
          item,
          entry,
          derived: state.derivedById.get(id) ?? null,
          rank: state.rankById.get(id) ?? null
        };
      });

    const other = state.libraryEntries
      .filter((e) => e.status !== "finished")
      .map((e) => ({ entry: e, item: state.itemsById.get(e.item_id) }))
      .sort((a, b) => {
        const ca = a.entry?.created_at ?? "";
        const cb = b.entry?.created_at ?? "";
        if (ca > cb) return -1;
        if (ca < cb) return 1;
        return a.item.id < b.item.id ? -1 : 1;
      })
      .map(({ item, entry }) => ({ item, entry, derived: null, rank: null }));

    state.libraryRows = [...finishedRows, ...other].filter((r) => r.item && r.entry);
  }

  function setSurface(surface) {
    state.surface = surface;
    if (surface !== "detail") state.detailItemId = null;
    if (surface !== "compare") {
      state.session = null;
      state.currentPair = null;
    }
  }

  function updateCurrentPair() {
    if (!state.session) {
      state.currentPair = null;
      return;
    }
    state.currentPair = pickPair({
      finishedIds: state.finishedIds,
      comparisons: state.comparisons,
      derivedById: state.derivedById,
      targetId: state.session.target_item_id
    });
  }

  function render() {
    rebuildSelectors();
    updateCurrentPair();
    root.innerHTML = renderApp(state);
  }

  async function load() {
    const { items, libraryEntries, comparisons } = await idb.loadAll();
    state.items = items;
    state.itemsById = byId(items);
    state.libraryEntries = libraryEntries;
    state.libraryByItemId = byId(libraryEntries);
    state.comparisons = comparisons;
    state.uiStarsDisplayById = await idb.getStarsDisplayState();
    await recomputeAndPersist();
    render();
  }

  async function handleAddItem(form) {
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const author = String(fd.get("author") || "").trim();
    if (!title) return;

    const { item, entry } = await idb.addItem({ title, author });
    state.items.push(item);
    state.itemsById.set(item.id, item);
    state.libraryEntries.push(entry);
    state.libraryByItemId.set(item.id, entry);

    form.reset();
    render();
  }

  async function handleSearchOpenLibrary(form) {
    if (!state.searchEnabled) return;

    const fd = new FormData(form);
    const q = String(fd.get("q") || "").trim();
    state.searchQuery = q;

    if (!q) {
      state.searchStatus = "idle";
      state.searchResults = [];
      state.searchError = null;
      render();
      return;
    }

    state.searchStatus = "loading";
    state.searchError = null;
    render();

    const reqId = ++state.searchRequestId;
    try {
      const results = await searchOpenLibrary(q, { limit: 10 });
      if (reqId !== state.searchRequestId) return; // stale response
      state.searchResults = results;
      state.searchStatus = "done";
      state.searchError = null;
      render();
    } catch (e) {
      if (reqId !== state.searchRequestId) return;
      state.searchStatus = "error";
      state.searchResults = [];
      state.searchError = String(e?.message ?? e);
      setToast("Search failed.", { hint: navigator.onLine ? state.searchError : "You’re offline." });
      render();
    }
  }

  function normalizeKey(title, author) {
    return `${String(title || "").trim().toLowerCase()}|${String(author || "").trim().toLowerCase()}`;
  }

  async function handleAddFromSearch(idx) {
    const r = state.searchResults[idx];
    if (!r) return;

    const sourceKey = r?.source?.provider === "openlibrary" ? r.source.key : null;
    const existsBySource =
      sourceKey &&
      state.items.some((it) => it?.source?.provider === "openlibrary" && it?.source?.key === sourceKey);
    if (existsBySource) {
      setToast("Already in your library.", { hint: "Relative to your library." });
      return;
    }

    const key = normalizeKey(r.title, r.author);
    const existsByText = !sourceKey && state.items.some((it) => normalizeKey(it.title, it.author) === key);
    if (existsByText) {
      setToast("Already in your library.", { hint: "Try a different edition or spelling." });
      return;
    }

    const { item, entry } = await idb.addItem({
      title: r.title,
      author: r.author,
      source: r.source ?? null,
      isbn: r.isbn ?? null,
      cover_url: r.cover_url ?? null,
      first_publish_year: r.first_publish_year ?? null
    });

    state.items.push(item);
    state.itemsById.set(item.id, item);
    state.libraryEntries.push(entry);
    state.libraryByItemId.set(item.id, entry);
    render();
    setToast("Added.", { hint: "Ratings are relative to your library." });
  }

  async function handleSetStatus(itemId, status) {
    const entry = await idb.setLibraryStatus(itemId, status);
    state.libraryByItemId.set(itemId, entry);
    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
    if (idx >= 0) state.libraryEntries[idx] = entry;
    else state.libraryEntries.push(entry);

    await recomputeAndPersist();
    render();
  }

  function startSession({ stepsTotal, mode, targetItemId = null }) {
    state.session = {
      session_id: crypto.randomUUID(),
      mode,
      steps_total: stepsTotal,
      target_item_id: targetItemId,
      started_at: nowIso()
    };
    setSurface("compare");
    render();
  }

  async function handleCompare({ winner }) {
    if (!state.session || !state.currentPair) return;
    const { a, b } = state.currentPair;
    const winnerId = winner === "a" ? a : winner === "b" ? b : null;

    const c = await idb.addComparison({
      item_a_id: a,
      item_b_id: b,
      winner_item_id: winnerId,
      session_id: state.session.session_id,
      mode: state.session.mode
    });
    state.comparisons.push(c);
    await recomputeAndPersistWithBootstrap([a, b]);
    render();
  }

  async function handleUndo() {
    const deleted = await idb.deleteLastComparison();
    if (!deleted) return;
    state.comparisons = state.comparisons.filter((c) => c.id !== deleted.id);
    await recomputeAndPersistWithBootstrap([deleted.item_a_id, deleted.item_b_id]);
    render();
  }

  async function handleExport() {
    const data = await idb.exportAllData({ curveVersion: CURVE_VERSION });
    const ts = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
    downloadJson(`checkcheck-export-${ts}.json`, data);
  }

  async function handleImport(file) {
    const text = await file.text();
    const obj = JSON.parse(text);
    if (!obj?.data) throw new Error("Invalid export: missing data");
    if (!confirm("Replace local data with this import?")) return;
    await idb.importExportBlob(obj);
    await load();
    setToast("Import complete.", { hint: "Ratings are relative to your library." });
  }

  async function handleResetDerived() {
    if (!confirm("Reset display? (keeps comparisons)")) return;
    await idb.resetDerivedState();
    state.uiStarsDisplayById = {};
    // Important: do not bootstrap ratings during reset. This should remove ratings entirely.
    await recomputeAndPersistWithBootstrap([]);
    render();
    setToast("Display reset.", { hint: "Ratings cleared (comparisons kept)." });
  }

  async function handleWipeAll() {
    if (!confirm("Clear all local data? This cannot be undone.")) return;
    await idb.wipeAllData();
    setSurface("library");
    await load();
    setToast("Local data cleared.", { hint: "You can import a JSON export to restore." });
  }

  root.addEventListener("submit", (ev) => {
    const form = ev.target;
    if (!(form instanceof HTMLFormElement)) return;
    const action = form.getAttribute("data-action");
    if (action === "add:item") {
      ev.preventDefault();
      handleAddItem(form).catch((e) => alert(String(e)));
    }
    if (action === "search:openlibrary") {
      ev.preventDefault();
      handleSearchOpenLibrary(form).catch((e) => alert(String(e)));
    }
  });

  root.addEventListener("click", (ev) => {
    const el = ev.target instanceof Element ? ev.target.closest("[data-action]") : null;
    if (!el) return;
    const action = el.getAttribute("data-action");
    if (!action) return;

    if (action === "nav:library") return setSurface("library"), render();
    if (action === "nav:compare") return setSurface("compare"), render();
    if (action === "export") return void handleExport().catch((e) => alert(String(e)));

    if (action === "import:open") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) handleImport(file).catch((e) => alert(String(e)));
      };
      input.click();
      return;
    }

    if (action === "dev:resetDerived") return void handleResetDerived();
    if (action === "dev:wipeAll") return void handleWipeAll().catch((e) => alert(String(e)));

    if (action === "start:miccheck") return startSession({ stepsTotal: 10, mode: "mic_check" });
    if (action === "start:more") {
      const steps = Number(el.getAttribute("data-steps") || "5");
      return startSession({ stepsTotal: Number.isFinite(steps) ? steps : 5, mode: "mic_check" });
    }

    if (action === "start:focus") {
      const itemId = el.getAttribute("data-item-id");
      if (!itemId) return;
      return startSession({ stepsTotal: 3, mode: "after_finish", targetItemId: itemId });
    }

    if (action === "compare:win") {
      const winner = el.getAttribute("data-winner");
      if (winner !== "a" && winner !== "b") return;
      return void handleCompare({ winner }).catch((e) => alert(String(e)));
    }
    if (action === "compare:skip") return void handleCompare({ winner: null }).catch((e) => alert(String(e)));
    if (action === "compare:undo") return void handleUndo().catch((e) => alert(String(e)));

    if (action === "open:detail") {
      const itemId = el.getAttribute("data-item-id");
      if (!itemId) return;
      state.detailItemId = itemId;
      state.surface = "detail";
      return render();
    }

    if (action === "quick:status") {
      const itemId = el.getAttribute("data-item-id");
      const nextStatus = el.getAttribute("data-next-status");
      if (!itemId) return;
      if (nextStatus !== "want" && nextStatus !== "reading" && nextStatus !== "finished") return;
      return void handleSetStatus(itemId, nextStatus).catch((e) => alert(String(e)));
    }

    if (action === "search:add") {
      const idx = Number(el.getAttribute("data-result-idx") || "-1");
      if (!Number.isFinite(idx) || idx < 0) return;
      return void handleAddFromSearch(idx).catch((e) => alert(String(e)));
    }

    if (action === "search:clear") {
      state.searchQuery = "";
      state.searchResults = [];
      state.searchStatus = "idle";
      state.searchError = null;
      state.searchRequestId++;
      render();
      return;
    }

    if (action === "status:set") {
      const status = el.getAttribute("data-status");
      const itemId = state.detailItemId;
      if (!itemId) return;
      if (status !== "want" && status !== "reading" && status !== "finished") return;
      return void handleSetStatus(itemId, status).catch((e) => alert(String(e)));
    }
  });

  await load();
}
