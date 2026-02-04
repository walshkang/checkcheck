import { CURVE_VERSION } from "../rating/curve_v1.js";
import { recomputeDerived } from "../rating/recompute.js";
import * as idb from "../storage/idb.js";
import { pickPair } from "./pairs.js";
import { renderApp } from "./render.js";
import { searchOpenLibrary } from "./catalog/openlibrary.js";
import { mapSubjectsToTypeSuggested } from "./catalog/type_mapping.js";

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
  // Search is now shown by default. You can hide it with `?search=0`.
  const searchParam = qs.get("search");
  const searchEnabled = !(searchParam === "0" || searchParam === "false" || searchParam === "off");

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
    finishedIds: [], // active finished (archived excluded)
    archivedIds: [],
    scoredIds: [],
    libraryRows: [],

    detailItemId: null,
    session: null,
    currentPair: null,
	    toast: null,

	    showArchived: false,
	    libraryView: "want", // want | finished

	    finishPromptItemId: null,
	    finishPromptToken: null,

    searchEnabled,
    searchLangMode: "prefer_en", // prefer_en | any
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
    state.archivedIds = state.libraryEntries.filter((e) => !!e.archived_at).map((e) => e.item_id);

    state.finishedIds = state.libraryEntries
      .filter((e) => e.status === "finished" && !e.archived_at)
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
      .filter((e) => e.status !== "finished" && !e.archived_at)
      .map((e) => ({ entry: e, item: state.itemsById.get(e.item_id) }))
      .sort((a, b) => {
        const ca = a.entry?.created_at ?? "";
        const cb = b.entry?.created_at ?? "";
        if (ca > cb) return -1;
        if (ca < cb) return 1;
        return a.item.id < b.item.id ? -1 : 1;
      })
      .map(({ item, entry }) => ({ item, entry, derived: null, rank: null }));

    const archived = state.showArchived
      ? state.libraryEntries
          .filter((e) => !!e.archived_at)
          .map((e) => ({ entry: e, item: state.itemsById.get(e.item_id) }))
          .sort((a, b) => {
            const aa = a.entry?.archived_at ?? "";
            const ab = b.entry?.archived_at ?? "";
            if (aa > ab) return -1;
            if (aa < ab) return 1;
            return a.item.id < b.item.id ? -1 : 1;
          })
          .map(({ item, entry }) => ({ item, entry, derived: null, rank: null }))
      : [];

    state.libraryRows = [...finishedRows, ...other, ...archived].filter((r) => r.item && r.entry);
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
    const activeSet = new Set(state.finishedIds);
    const activeComparisons = state.comparisons.filter(
      (c) => activeSet.has(c.item_a_id) && activeSet.has(c.item_b_id)
    );
    const sessionComparisons = state.comparisons.filter((c) => c.session_id === state.session.session_id);
    const stepIndex = sessionComparisons.length;
    const usedOpponentIds = new Set();
    const targetId = state.session.target_item_id;
    if (targetId) {
      for (const c of sessionComparisons) {
        if (c.item_a_id === targetId) usedOpponentIds.add(c.item_b_id);
        if (c.item_b_id === targetId) usedOpponentIds.add(c.item_a_id);
      }
    }
    state.currentPair = pickPair({
      finishedIds: state.finishedIds,
      comparisons: activeComparisons,
      derivedById: state.derivedById,
      mode: state.session.mode,
      targetId: state.session.target_item_id,
      stepIndex,
      usedOpponentIds
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
	    const alreadyFinished = fd.get("already_finished") != null;
	    if (!title) return;

	    const { item, entry } = await idb.addItem({ title, author });
	    state.items.push(item);
	    state.itemsById.set(item.id, item);
	    state.libraryEntries.push(entry);
	    state.libraryByItemId.set(item.id, entry);

	    form.reset();
	    if (alreadyFinished) {
	      state.libraryView = "finished";
	      await handleSetStatus(item.id, "finished");
	      return;
	    }
	    render();
	  }

  async function handleSearchOpenLibrary(form) {
    if (!state.searchEnabled) return;

    const fd = new FormData(form);
    const q = String(fd.get("q") || "").trim();
    const langMode = String(fd.get("lang_mode") || "prefer_en");
    state.searchLangMode = langMode === "any" ? "any" : "prefer_en";
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
      const results = await searchOpenLibrary(q, { limit: 10, langMode: state.searchLangMode });
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
    if (sourceKey) {
      const existing = state.items.find(
        (it) => it?.source?.provider === "openlibrary" && it?.source?.key === sourceKey
      );
      if (existing) {
        const entry = state.libraryByItemId.get(existing.id);
        if (entry?.archived_at) {
          await handleRestore(existing.id);
          return;
        }
        setToast("Already in your library.", { hint: "Relative to your library." });
        return;
      }
    }

    const key = normalizeKey(r.title, r.author);
    if (!sourceKey) {
      const existing = state.items.find((it) => normalizeKey(it.title, it.author) === key);
      if (existing) {
        const entry = state.libraryByItemId.get(existing.id);
        if (entry?.archived_at) {
          await handleRestore(existing.id);
          return;
        }
        setToast("Already in your library.", { hint: "Try a different edition or spelling." });
        return;
      }
    }

    const { item, entry } = await idb.addItem({
      title: r.title,
      author: r.author,
      source: r.source ?? null,
      isbn: r.isbn ?? null,
      cover_url: r.cover_url ?? null,
      first_publish_year: r.first_publish_year ?? null,
      raw_subjects: r.raw_subjects ?? [],
      type_suggested: mapSubjectsToTypeSuggested(r.raw_subjects)
    });

    state.items.push(item);
    state.itemsById.set(item.id, item);
    state.libraryEntries.push(entry);
    state.libraryByItemId.set(item.id, entry);
    render();
    setToast("Added.", { hint: "Ratings are relative to your library." });
  }

	  async function handleSetStatus(itemId, status) {
	    const prev = state.libraryByItemId.get(itemId);
	    const entry = await idb.setLibraryStatus(itemId, status);
	    state.libraryByItemId.set(itemId, entry);
	    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
	    if (idx >= 0) state.libraryEntries[idx] = entry;
	    else state.libraryEntries.push(entry);

	    const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;
	    if (entry.status === "finished" && !entry.archived_at && decidedComparisonsCount > 0) state.libraryView = "finished";
	    if (entry.status === "want" || entry.status === "reading") state.libraryView = "want";

	    // When the user marks an item finished, show a temporary inline prompt to do 3 comparisons.
	    if (prev?.status !== "finished" && entry.status === "finished" && !entry.archived_at) {
	      state.finishPromptItemId = itemId;
	      const token = crypto.randomUUID();
	      state.finishPromptToken = token;
      setTimeout(() => {
        if (state.finishPromptToken === token && state.finishPromptItemId === itemId) {
          state.finishPromptItemId = null;
          state.finishPromptToken = null;
          render();
        }
      }, 30_000);
    }
    if (state.finishPromptItemId === itemId && (entry.archived_at || entry.status !== "finished")) {
      state.finishPromptItemId = null;
      state.finishPromptToken = null;
    }

    await recomputeAndPersist();
    render();
  }

  async function handleArchive(itemId) {
    const entry = await idb.archiveItem(itemId);
    if (!entry) return;
    state.libraryByItemId.set(itemId, entry);
    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
    if (idx >= 0) state.libraryEntries[idx] = entry;
    if (state.finishPromptItemId === itemId) {
      state.finishPromptItemId = null;
      state.finishPromptToken = null;
    }
    await recomputeAndPersist();
    render();
    setToast("Removed from library.", { hint: "Comparisons kept." });
  }

  async function handleRestore(itemId) {
    const entry = await idb.unarchiveItem(itemId);
    if (!entry) return;
    state.libraryByItemId.set(itemId, entry);
    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
    if (idx >= 0) state.libraryEntries[idx] = entry;
    await recomputeAndPersist();
    render();
    setToast("Restored.", { hint: "Relative to your library." });
  }

	  function startSession({ stepsTotal, mode, targetItemId = null }) {
	    const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;
	    state.session = {
	      session_id: crypto.randomUUID(),
	      mode,
	      is_initial: mode === "mic_check" && decidedComparisonsCount === 0,
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
    // Bootstrap ratings only on *decided* comparisons. A Skip should not resurrect ratings after "Reset display".
    await recomputeAndPersistWithBootstrap(winnerId ? [a, b] : []);
    render();
  }

  async function handleUndo() {
    const deleted = await idb.deleteLastComparison();
    if (!deleted) return;
    state.comparisons = state.comparisons.filter((c) => c.id !== deleted.id);
    // Undo should not bootstrap ratings either; just recompute from truth.
    await recomputeAndPersistWithBootstrap([]);
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

	    if (action === "library:view") {
	      const view = el.getAttribute("data-view");
	      if (view !== "want" && view !== "finished") return;
	      state.libraryView = view;
	      render();
	      return;
	    }

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

	    if (action === "toggle:archived") {
	      state.showArchived = !state.showArchived;
	      render();
	      return;
	    }

	    const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;
	    const canStartCompare = state.finishedIds.length >= 5;

	    if (action === "start:miccheck") {
	      if (!canStartCompare) {
	        setToast("Add at least 5 finished books to begin.", { hint: "Finish a few books, then we’ll calibrate your shelf." });
	        return;
	      }
	      return startSession({ stepsTotal: 10, mode: "mic_check" });
	    }
	    if (action === "start:more") {
	      if (!canStartCompare) {
	        setToast("Add at least 5 finished books to begin.", { hint: "Finish a few books, then we’ll calibrate your shelf." });
	        return;
	      }
	      const steps = Number(el.getAttribute("data-steps") || "5");
	      return startSession({ stepsTotal: Number.isFinite(steps) ? steps : 5, mode: "mic_check" });
	    }

	    if (action === "start:focus") {
	      if (decidedComparisonsCount === 0) {
	        setToast("Do a mic check first.", { hint: "Your shelf calibrates from comparisons." });
	        return;
	      }
	      const itemId = el.getAttribute("data-item-id");
	      if (!itemId) return;
	      if (state.finishPromptItemId === itemId) {
	        state.finishPromptItemId = null;
	        state.finishPromptToken = null;
      }
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

    if (action === "item:archive") {
      const itemId = state.detailItemId;
      if (!itemId) return;
      if (!confirm("Remove from library? (keeps comparisons)")) return;
      return void handleArchive(itemId).catch((e) => alert(String(e)));
    }

    if (action === "item:restore") {
      const itemId = state.detailItemId;
      if (!itemId) return;
      return void handleRestore(itemId).catch((e) => alert(String(e)));
    }

    if (action === "finishprompt:dismiss") {
      state.finishPromptItemId = null;
      state.finishPromptToken = null;
      render();
      return;
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
