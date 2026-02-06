import { CURVE_VERSION } from "../rating/curve_v1.js";
import { recomputeDerived } from "../rating/recompute.js";
import * as idb from "../storage/idb.js";
import { pickPair } from "./pairs.js";
import { renderApp } from "./render.js";
import * as openlibrary from "./catalog/openlibrary.js";
import { mapSubjectsToTypeSuggested } from "./catalog/type_mapping.js";
import { parseImportFileText, normalizeTitleAuthorKeyForDedupe } from "./import/import_file.js";

const searchOpenLibrary = openlibrary.searchOpenLibrary;
const resolveOpenLibraryEditionForWork = openlibrary.resolveOpenLibraryEditionForWork ?? null;

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
	    decidedComparisonsCount: 0,
	    unplacedIds: [],

	    detailItemId: null,
	    session: null,
	    currentPair: null,
    currentStepIndex: 0,
    currentPairKey: null,
    currentPairShownAt: null,
		    toast: null,

		    showArchived: false,
		    libraryView: "want", // want | unplaced | finished
        libraryTab: "add", // add | want | ranking | discover
        libraryTabTouched: false,

		    finishPromptItemId: null,
		    finishPromptToken: null,

    searchEnabled,
    searchLanguage: "en", // en | es | fr | de | it | pt | ja | ko | zh | any
    searchQuery: "",
    searchStatus: "idle", // idle | loading | done | error
	    searchResults: [],
	    searchError: null,
	    searchRequestId: 0,
	    searchConfidence: null, // { ok, bestScore, secondScore } | null
	    searchEditionPreview: null, // { resultIdx, existingItemId, status, candidate, error }

    comparePending: null, // { action: "win"|"skip"|"undo", winner: "a"|"b"|null, at: number }
    compareEnterAt: 0,
    lastCompareInput: null, // { input: "card"|"button"|"unknown", action: "win"|"skip"|"undo", winner: "a"|"b"|null, at: number }

	    importFlow: null, // { kind, provider, fileName, ... }
    postImportMicCheckPrompt: null, // { at: number }

		    detailOpenLibraryStatus: "idle", // idle | loading | pick | preview
		    detailOpenLibraryCandidate: null, // normalized OL result
		    detailOpenLibraryCandidates: null // normalized OL results[]
		  };

  function primeInitialLibraryTab() {
    if (state.libraryTabTouched) return;

    const finishedCount = state.finishedIds?.length ?? 0;
    if (state.items.length === 0) {
      state.libraryTab = "add";
      return;
    }
    if (finishedCount > 0) {
      state.libraryTab = "ranking";
      const rankedCount = state.finishedIds.filter((id) => state.derivedById.get(id)?.stars_display != null).length;
      if (rankedCount > 0) state.libraryView = "finished";
      else if ((state.unplacedIds?.length ?? 0) > 0) state.libraryView = "unplaced";
      else state.libraryView = "finished";
      return;
    }
    state.libraryTab = "want";
    state.libraryView = "want";
  }

  function setLibraryTab(tab, { touched = true, renderNow = true, preserveView = false } = {}) {
    if (tab !== "add" && tab !== "want" && tab !== "ranking" && tab !== "discover") return;
    const prevTab = state.libraryTab;
    state.libraryTab = tab;
    if (touched) state.libraryTabTouched = true;

    if (!preserveView) {
      if (tab === "want") state.libraryView = "want";
      if (tab === "ranking") {
        const rankedCount = state.finishedIds.filter((id) => state.derivedById.get(id)?.stars_display != null).length;
        const shouldPickDefault =
          prevTab !== "ranking" || (state.libraryView !== "unplaced" && state.libraryView !== "finished");
        if (shouldPickDefault) {
          if (rankedCount > 0) state.libraryView = "finished";
          else state.libraryView = (state.unplacedIds?.length ?? 0) > 0 ? "unplaced" : "finished";
        }
      }
    }

    if (renderNow) render();
  }

  function logEvent(type, data, { sessionId = null } = {}) {
    const sid = sessionId ?? state.session?.session_id ?? null;
    void idb
      .addEvent({ type, data: data ?? null, session_id: sid })
      .catch(() => {});
  }

  function normalizeForMatch(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function tokensForMatch(s) {
    const t = normalizeForMatch(s);
    if (!t) return [];
    const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "by"]);
    return t
      .split(" ")
      .filter(Boolean)
      .filter((x) => x.length >= 2 && !stop.has(x))
      .slice(0, 16);
  }

  function overlapCount(a, b) {
    if (!a?.length || !b?.length) return 0;
    const set = new Set(a);
    let n = 0;
    for (const x of b) if (set.has(x)) n += 1;
    return n;
  }

  function titleLooksLikeListingPenalty({ candidateTitle, authorTokensAcrossResults, candidateAuthorTokens }) {
    const titleTokens = tokensForMatch(candidateTitle);
    if (!titleTokens.length) return 0;
    const pool = authorTokensAcrossResults instanceof Set ? authorTokensAcrossResults : new Set();
    let hits = 0;
    for (const t of titleTokens) if (pool.has(t) && !candidateAuthorTokens.includes(t)) hits += 1;
    return hits >= 2 ? -80 : hits === 1 ? -20 : 0;
  }

  function scoreCandidateForQuery(r, { queryText, queryTitle = null, queryAuthor = null, authorTokensAcrossResults = null } = {}) {
    const candTitle = String(r?.title || "");
    const candAuthor = String(r?.author || "");
    const candTitleNorm = normalizeForMatch(candTitle);
    const candAuthorNorm = normalizeForMatch(candAuthor);
    const candTitleTokens = tokensForMatch(candTitle);
    const candAuthorTokens = tokensForMatch(candAuthor);

    const qTitle = queryTitle != null ? String(queryTitle || "") : "";
    const qAuthor = queryAuthor != null ? String(queryAuthor || "") : "";
    const qText = String(queryText || "");

    const qTitleNorm = qTitle ? normalizeForMatch(qTitle) : "";
    const qAuthorNorm = qAuthor ? normalizeForMatch(qAuthor) : "";
    const qTokens = tokensForMatch(qText);
    const qTitleTokens = qTitle ? tokensForMatch(qTitle) : qTokens;
    const qAuthorTokens = qAuthor ? tokensForMatch(qAuthor) : [];

    let score = 0;

    // Title matching.
    if (qTitleNorm && candTitleNorm && qTitleNorm === candTitleNorm) score += 120;
    const titleOverlap = overlapCount(qTitleTokens, candTitleTokens);
    score += Math.min(60, titleOverlap * 12);

    // Author matching when known.
    if (qAuthorNorm) {
      if (candAuthorNorm && candAuthorNorm === qAuthorNorm) score += 90;
      const authorOverlap = overlapCount(qAuthorTokens, candAuthorTokens);
      score += Math.min(60, authorOverlap * 20);

      // Penalize "Title, Author" imposters where the author tokens appear in the title but author doesn't match.
      const authorInTitle = overlapCount(qAuthorTokens, candTitleTokens);
      if (authorInTitle >= 2 && candAuthorNorm && candAuthorNorm !== qAuthorNorm) score -= 90;
    } else {
      // If user typed an author into freeform query, favor results whose author matches query tokens.
      const authorOverlap = overlapCount(qTokens, candAuthorTokens);
      score += Math.min(40, authorOverlap * 10);
    }

    // Penalize titles that look like listings ("Title, Author") based on the returned author pool.
    score += titleLooksLikeListingPenalty({
      candidateTitle: candTitle,
      authorTokensAcrossResults,
      candidateAuthorTokens: candAuthorTokens
    });

    // Tie-breakers (low weight).
    if (r?.isbn) score += 4;
    if (r?.cover_url) score += 4;

    return score;
  }

  function rerankOpenLibraryResults(results, { queryText, queryTitle = null, queryAuthor = null } = {}) {
    const arr = Array.isArray(results) ? results.slice() : [];
    const authorTokensAcrossResults = new Set();
    for (const r of arr) for (const t of tokensForMatch(r?.author)) authorTokensAcrossResults.add(t);

    const scored = arr.map((r, idx) => ({
      r,
      idx,
      s: scoreCandidateForQuery(r, { queryText, queryTitle, queryAuthor, authorTokensAcrossResults })
    }));
    scored.sort((a, b) => (b.s - a.s) || (a.idx - b.idx));
    return scored.map((x) => x.r);
  }

  function isConfidentBestMatch(results, { queryText, queryTitle = null, queryAuthor = null } = {}) {
    const arr = Array.isArray(results) ? results : [];
    if (!arr.length) return { ok: false };
    const authorTokensAcrossResults = new Set();
    for (const r of arr) for (const t of tokensForMatch(r?.author)) authorTokensAcrossResults.add(t);
    const best = arr[0];
    const second = arr[1] ?? null;
    const bestScore = scoreCandidateForQuery(best, { queryText, queryTitle, queryAuthor, authorTokensAcrossResults });
    const secondScore = second
      ? scoreCandidateForQuery(second, { queryText, queryTitle, queryAuthor, authorTokensAcrossResults })
      : -Infinity;
    // Heuristic thresholds: strong enough to avoid "close semantic match" applying.
    const ok = bestScore >= 140 && bestScore - secondScore >= 25;
    return { ok, bestScore, secondScore };
  }

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

	    state.decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;

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

	    // Unplaced is derived from finished items that do not yet have a displayed rating.
	    // Order matches the Finished list order (stable + defensible for e2e).
	    state.unplacedIds = finishedRows
	      .map((r) => r?.item?.id)
	      .filter((id) => {
	        if (!id) return false;
	        const d = state.derivedById.get(id);
	        return !(d?.is_rated ?? false);
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
    if (surface !== "detail") {
      state.detailItemId = null;
      state.detailOpenLibraryStatus = "idle";
      state.detailOpenLibraryCandidate = null;
    }
    if (surface !== "compare") {
      state.session = null;
      state.currentPair = null;
    }
  }

	  function updateCurrentPair() {
	    if (!state.session) {
	      state.currentPair = null;
      state.currentStepIndex = 0;
	      return;
	    }
	    const activeSet = new Set(state.finishedIds);
	    const activeComparisons = state.comparisons.filter(
	      (c) => activeSet.has(c.item_a_id) && activeSet.has(c.item_b_id)
	    );
	    const sessionComparisons = state.comparisons.filter((c) => c.session_id === state.session.session_id);
	    const stepIndex =
	      state.session.mode === "after_finish" || state.session.mode === "recheck"
	        ? sessionComparisons.filter((c) => c.winner_item_id != null).length
	        : sessionComparisons.length;
    state.currentStepIndex = stepIndex;
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
      isInitial: !!state.session.is_initial,
	      targetId: state.session.target_item_id,
	      stepIndex,
	      usedOpponentIds
	    });
	  }

  function render() {
    rebuildSelectors();
    updateCurrentPair();
    if (state.surface === "compare" && state.session && state.currentPair && !state.comparePending) {
      const { a, b } = state.currentPair;
      const key = `${state.session.session_id}:${state.session.mode}:${state.currentStepIndex}:${a}:${b}`;
      if (key !== state.currentPairKey) {
        state.currentPairKey = key;
        state.currentPairShownAt = Date.now();
      }
    }
    root.setAttribute("data-surface", state.surface);
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
	    rebuildSelectors();
	    primeInitialLibraryTab();
	    render();
	  }

  function normalizeTag(tag) {
    const v = String(tag || "").trim().replace(/\s+/g, " ");
    if (!v) return null;
    return v.length > 40 ? v.slice(0, 40) : v;
  }

  function dedupeTags(tags) {
    const out = [];
    const seen = new Set();
    for (const t of Array.isArray(tags) ? tags : []) {
      const v = normalizeTag(t);
      if (!v) continue;
      const key = v.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
      if (out.length >= 20) break;
    }
    return out;
  }

  async function handlePatchEntry(itemId, patch) {
    if (typeof idb.patchLibraryEntry !== "function") {
      throw new Error("App is out of date. Hard refresh and try again.");
    }
    const entry = await idb.patchLibraryEntry(itemId, patch);
    state.libraryByItemId.set(itemId, entry);
    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
    if (idx >= 0) state.libraryEntries[idx] = entry;
    else state.libraryEntries.push(entry);
    await recomputeAndPersist();
    render();
    return entry;
  }

  async function handlePatchItem(itemId, patch) {
    if (typeof idb.patchItem !== "function") {
      throw new Error("App is out of date. Hard refresh and try again.");
    }
    const item = await idb.patchItem(itemId, patch);
    state.itemsById.set(itemId, item);
    const idx = state.items.findIndex((it) => it.id === itemId);
    if (idx >= 0) state.items[idx] = item;
    else state.items.push(item);
    render();
    return item;
  }

  async function handleTypeUseSuggested() {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const entry = state.libraryByItemId.get(itemId);
    if (!entry?.type_suggested) return;
    await handlePatchEntry(itemId, { type_confirmed: entry.type_suggested, type_decision: "confirmed" });
  }

  async function handleTypeClear() {
    const itemId = state.detailItemId;
    if (!itemId) return;
    await handlePatchEntry(itemId, { type_confirmed: null, type_decision: "cleared" });
  }

  async function handleTypeSelect(value) {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const v = String(value || "").trim();
    if (!v) return;
    await handlePatchEntry(itemId, { type_confirmed: v, type_decision: "confirmed" });
  }

  async function handleTagAdd(form) {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const entry = state.libraryByItemId.get(itemId);
    if (!entry || entry.archived_at) return;

    const fd = new FormData(form);
    const raw = fd.get("tag");
    const tag = normalizeTag(raw);
    if (!tag) return;

    const next = dedupeTags([...(entry.tags ?? []), tag]);
    if (next.length === (entry.tags ?? []).length) {
      setToast("Tag already added.", { hint: "Tags are just for you." });
      form.reset();
      return;
    }
    await handlePatchEntry(itemId, { tags: next });
    form.reset();
  }

  async function handleTagRemove(idx) {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const entry = state.libraryByItemId.get(itemId);
    if (!entry || entry.archived_at) return;
    const i = Number(idx);
    if (!Number.isFinite(i) || i < 0) return;
    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    if (i >= tags.length) return;
    const next = tags.slice(0, i).concat(tags.slice(i + 1));
    await handlePatchEntry(itemId, { tags: next });
  }

  async function startOpenLibraryUpdate() {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const item = state.itemsById.get(itemId);
    const entry = state.libraryByItemId.get(itemId);
    if (!item || !entry || entry.archived_at) return;

	    if (state.detailOpenLibraryStatus === "loading") return;
	    state.detailOpenLibraryStatus = "loading";
	    state.detailOpenLibraryCandidate = null;
	    state.detailOpenLibraryCandidates = null;
	    render();

    try {
      const qTitle = String(item.title || "").trim();
      const qAuthor = String(item.author || "").trim();
      const qLoose = [qTitle, qAuthor].filter(Boolean).join(" ");
      const qStrict =
        qTitle && qAuthor
          ? `title:"${qTitle.replaceAll('"', "")}" author:"${qAuthor.replaceAll('"', "")}"`
          : qTitle
            ? `title:"${qTitle.replaceAll('"', "")}"`
            : qLoose;
      const language = state.searchLanguage || "en";
      let results = [];
      if (language && language !== "any" && language !== "en") {
        results = await searchOpenLibrary(qStrict, { limit: 8, language, requireLanguage: true, resolveEditions: true });
        if (!results.length) results = await searchOpenLibrary(qLoose, { limit: 8, language, requireLanguage: true, resolveEditions: true });
        if (!results.length) results = await searchOpenLibrary(qStrict, { limit: 8, language, requireLanguage: false, resolveEditions: true });
        if (!results.length) results = await searchOpenLibrary(qLoose, { limit: 8, language, requireLanguage: false, resolveEditions: true });
      } else if (language && language !== "any") {
        results = await searchOpenLibrary(qStrict, { limit: 8, language, requireLanguage: false, resolveEditions: false });
        if (!results.length) results = await searchOpenLibrary(qLoose, { limit: 8, language, requireLanguage: false, resolveEditions: false });
      } else {
        results = await searchOpenLibrary(qStrict, { limit: 8, language: "any", requireLanguage: false, resolveEditions: false });
        if (!results.length) results = await searchOpenLibrary(qLoose, { limit: 8, language: "any", requireLanguage: false, resolveEditions: false });
      }
      if (!results.length && language && language !== "any") {
        results = await searchOpenLibrary(qLoose, { limit: 8, language: "any", requireLanguage: false, resolveEditions: false });
      }
      results = rerankOpenLibraryResults(results, { queryText: qLoose, queryTitle: qTitle, queryAuthor: qAuthor });
      const confidence = isConfidentBestMatch(results, { queryText: qLoose, queryTitle: qTitle, queryAuthor: qAuthor });
      const best = results[0] ?? null;
      if (!best) {
        state.detailOpenLibraryStatus = "idle";
        render();
        setToast("No Open Library match found.", { hint: "Try editing title/author, then retry." });
        return;
      }
	      if (!confidence.ok) {
	        state.detailOpenLibraryStatus = "pick";
	        state.detailOpenLibraryCandidate = null;
	        state.detailOpenLibraryCandidates = results.slice(0, 5);
	        render();
	        return;
	      }
	      state.detailOpenLibraryStatus = "preview";
	      state.detailOpenLibraryCandidate = best;
	      state.detailOpenLibraryCandidates = null;
	      render();
	    } catch (e) {
	      state.detailOpenLibraryStatus = "idle";
	      state.detailOpenLibraryCandidates = null;
	      render();
	      setToast("Open Library update failed.", { hint: String(e?.message || e) });
	    }
	  }

	  function pickOpenLibraryCandidate(idx) {
	    const i = Number(idx);
	    const arr = Array.isArray(state.detailOpenLibraryCandidates) ? state.detailOpenLibraryCandidates : [];
	    if (!Number.isFinite(i) || i < 0 || i >= arr.length) return;
	    const cand = arr[i];
	    if (!cand) return;
	    state.detailOpenLibraryStatus = "preview";
	    state.detailOpenLibraryCandidate = cand;
	    state.detailOpenLibraryCandidates = null;
	    render();
	  }

	  function cancelOpenLibraryUpdate() {
	    state.detailOpenLibraryStatus = "idle";
	    state.detailOpenLibraryCandidate = null;
	    state.detailOpenLibraryCandidates = null;
	    render();
	  }

  async function applyOpenLibraryUpdate() {
    const itemId = state.detailItemId;
    if (!itemId) return;
    const item = state.itemsById.get(itemId);
    const entry = state.libraryByItemId.get(itemId);
    const cand = state.detailOpenLibraryCandidate;
    if (!item || !entry || !cand) return;

    const patch = {};
    // Work identity: keep the user’s canonical title stable; only fill missing fields.
    if ((!item.title || !String(item.title).trim()) && cand.title && String(cand.title).trim()) {
      patch.title = String(cand.title).trim();
    }
    if ((!item.author || !String(item.author).trim()) && cand.author && String(cand.author).trim()) {
      patch.author = String(cand.author).trim();
    }
    if (!item.cover_url && cand.cover_url) patch.cover_url = cand.cover_url;
    if (!item.first_publish_year && cand.first_publish_year != null) patch.first_publish_year = cand.first_publish_year;
    if (!item.isbn && cand.isbn) patch.isbn = cand.isbn;
    if (!item.publisher && cand.publisher) patch.publisher = cand.publisher;
    if (!item.language && cand.language) patch.language = cand.language;
    if ((!Array.isArray(item.raw_subjects) || item.raw_subjects.length === 0) && Array.isArray(cand.raw_subjects)) {
      patch.raw_subjects = cand.raw_subjects;
    }
    patch.openlibrary = {
      work_key: cand?.source?.key ?? null,
      edition_key: cand?.edition?.key ?? null,
      updated_at: nowIso()
    };

    await handlePatchItem(itemId, patch);

    // Optional suggested type fill (never affects scoring).
    if (
      Array.isArray(cand.raw_subjects) &&
      cand.raw_subjects.length &&
      entry.type_decision == null &&
      !entry.type_confirmed &&
      !entry.type_suggested
    ) {
      const suggested = mapSubjectsToTypeSuggested(cand.raw_subjects);
      if (suggested) await handlePatchEntry(itemId, { type_suggested: suggested });
    }

    state.detailOpenLibraryStatus = "idle";
    state.detailOpenLibraryCandidate = null;
    render();
    setToast("Metadata updated.", { hint: "Saved from Open Library (does not affect ranking)." });
  }

		  async function handleAddItem(form, submitter = null) {
	    const fd = new FormData(form);
	    const title = String(fd.get("title") || "").trim();
	    const author = String(fd.get("author") || "").trim();
	    const submitIntentRaw =
	      submitter instanceof HTMLButtonElement
	        ? submitter.value || submitter.getAttribute("value") || submitter.getAttribute("data-intent") || ""
	        : "";
	    const intent = String(submitIntentRaw || fd.get("add_intent") || "want");
	    if (!title) return;

	    const { item, entry } = await idb.addItem({ title, author });
	    state.items.push(item);
	    state.itemsById.set(item.id, item);
	    state.libraryEntries.push(entry);
	    state.libraryByItemId.set(item.id, entry);

			    form.reset();
			    if (intent === "finished") {
            setLibraryTab("ranking", { touched: false, renderNow: false });
			      state.libraryView = "unplaced";
			      await handleSetStatus(item.id, "finished");
			      return;
			    }
			    render();
			  }

  async function handleSearchOpenLibrary(form) {
    if (!state.searchEnabled) return;

    const fd = new FormData(form);
    const q = String(fd.get("q") || "").trim();
    const lang = String(fd.get("lang") || "en").trim().toLowerCase();
    const allowed = new Set(["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "any"]);
	    state.searchLanguage = allowed.has(lang) ? lang : "en";
	    state.searchQuery = q;
	    state.searchEditionPreview = null;
	    state.searchConfidence = null;

	    if (!q) {
	      state.searchStatus = "idle";
	      state.searchResults = [];
	      state.searchError = null;
	      state.searchConfidence = null;
	      render();
	      return;
	    }

    state.searchStatus = "loading";
    state.searchError = null;
    state.searchEditionPreview = null;
    render();

	    const reqId = ++state.searchRequestId;
	    try {
	      const language = state.searchLanguage || "en";

	      let results = [];
	      if (language && language !== "any" && language !== "en") {
	        results = await searchOpenLibrary(q, { limit: 10, language, requireLanguage: true, resolveEditions: true });
	        if (!results.length) {
	          results = await searchOpenLibrary(q, { limit: 10, language, requireLanguage: false, resolveEditions: true });
	        }
	      } else if (language && language !== "any") {
	        results = await searchOpenLibrary(q, { limit: 10, language, requireLanguage: false, resolveEditions: false });
	      } else {
	        results = await searchOpenLibrary(q, { limit: 10, language: "any", requireLanguage: false, resolveEditions: false });
	      }

	      if (!results.length && language && language !== "any") {
	        results = await searchOpenLibrary(q, { limit: 10, language: "any", requireLanguage: false, resolveEditions: false });
	      }
		      if (reqId !== state.searchRequestId) return; // stale response
	        results = rerankOpenLibraryResults(results, { queryText: q });
	        state.searchConfidence = isConfidentBestMatch(results, { queryText: q });
		      state.searchResults = results.map((r) => ({
		        ...r,
		        type_suggested: mapSubjectsToTypeSuggested(r.raw_subjects)
		      }));
	      state.searchStatus = "done";
	      state.searchError = null;
	      render();
	    } catch (e) {
      if (reqId !== state.searchRequestId) return;
	      state.searchStatus = "error";
	      state.searchResults = [];
	      state.searchError = String(e?.message ?? e);
	      state.searchConfidence = null;
	      setToast("Search failed.", { hint: navigator.onLine ? state.searchError : "You’re offline." });
	      render();
	    }
	  }

  function normalizeKey(title, author) {
    return `${String(title || "").trim().toLowerCase()}|${String(author || "").trim().toLowerCase()}`;
  }

		  async function handleAddFromSearch(idx, targetStatus = "want") {
	    const r = state.searchResults[idx];
	    if (!r) return;
	    const intent = targetStatus === "finished" ? "finished" : "want";

	    const sourceKey = r?.source?.provider === "openlibrary" ? r.source.key : null;
	    if (sourceKey) {
	      const existing = state.items.find(
	        (it) => it?.source?.provider === "openlibrary" && it?.source?.key === sourceKey
	      );
	      if (existing) {
	        const entry = state.libraryByItemId.get(existing.id);
		        if (entry?.archived_at) {
		          await handleRestore(existing.id);
		          if (intent === "finished" && entry?.status !== "finished") {
		            state.libraryView = "unplaced";
		            await handleSetStatus(existing.id, "finished");
		          }
		          return;
		        }
		        if (intent === "finished" && entry?.status !== "finished") {
		          state.libraryView = "unplaced";
		          await handleSetStatus(existing.id, "finished");
		          setToast("Marked finished.", { hint: "Ready to place when you are." });
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
		          if (intent === "finished" && entry?.status !== "finished") {
		            state.libraryView = "unplaced";
		            await handleSetStatus(existing.id, "finished");
		          }
		          return;
		        }
		        if (intent === "finished" && entry?.status !== "finished") {
		          state.libraryView = "unplaced";
		          await handleSetStatus(existing.id, "finished");
		          setToast("Marked finished.", { hint: "Ready to place when you are." });
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
      publisher: r.publisher ?? null,
      language: r.language ?? null,
      raw_subjects: r.raw_subjects ?? [],
      type_suggested: mapSubjectsToTypeSuggested(r.raw_subjects)
    });

	    state.items.push(item);
	    state.itemsById.set(item.id, item);
	    state.libraryEntries.push(entry);
	    state.libraryByItemId.set(item.id, entry);
	    render();
	    setToast("Added.", { hint: "Ratings are relative to your library." });

			    if (intent === "finished") {
            setLibraryTab("ranking", { touched: false, renderNow: false });
			      state.libraryView = "unplaced";
			      await handleSetStatus(item.id, "finished");
			    }
			  }

  function cancelSearchEditionPreview() {
    state.searchEditionPreview = null;
  }

  async function handleSearchOpenExisting(itemId) {
    const id = String(itemId || "").trim();
    if (!id) return;
    state.detailItemId = id;
    state.detailOpenLibraryStatus = "idle";
    state.detailOpenLibraryCandidate = null;
    setSurface("detail");
    render();
  }

  async function handleSearchStartEditionPreview(resultIdx, existingItemId) {
    if (typeof resolveOpenLibraryEditionForWork !== "function") {
      setToast("Update edition requires refresh.", { hint: "Hard refresh the page and try again." });
      return;
    }
    const i = Number(resultIdx);
    if (!Number.isFinite(i) || i < 0) return;
    const r = state.searchResults[i];
    if (!r) return;

    const existingId = String(existingItemId || "").trim();
    if (!existingId) return;

    const workKey = r?.source?.provider === "openlibrary" ? r?.source?.key : null;
    if (!workKey) {
      setToast("Can’t update edition.", { hint: "No Open Library work key." });
      return;
    }

    state.searchEditionPreview = {
      resultIdx: i,
      existingItemId: existingId,
      status: "loading",
      candidate: null,
      error: null
    };
    render();

    try {
      const language = state.searchLanguage || "en";
      const queryText = state.searchQuery || "";
      const cand = await resolveOpenLibraryEditionForWork(workKey, { language, queryText });
      if (!cand) {
        cancelSearchEditionPreview();
        render();
        setToast("No edition match found.", { hint: "Try a more specific query." });
        return;
      }
      if (!state.searchEditionPreview || state.searchEditionPreview.resultIdx !== i) return;
      state.searchEditionPreview = {
        ...state.searchEditionPreview,
        status: "preview",
        candidate: cand,
        error: null
      };
      render();
    } catch (e) {
      if (!state.searchEditionPreview || state.searchEditionPreview.resultIdx !== i) return;
      state.searchEditionPreview = {
        ...state.searchEditionPreview,
        status: "error",
        candidate: null,
        error: String(e?.message ?? e)
      };
      render();
    }
  }

  async function handleSearchApplyEdition() {
    const p = state.searchEditionPreview;
    if (!p || p.status !== "preview" || !p.candidate) return;
    const r = state.searchResults[p.resultIdx];
    if (!r) return;

    const itemId = p.existingItemId;
    const item = state.itemsById.get(itemId);
    if (!item) return;

    const workKey = r?.source?.provider === "openlibrary" ? r?.source?.key : null;
    const patch = {};

    const alreadySameEdition =
      (item?.openlibrary?.edition_key &&
        p.candidate.edition_key &&
        item.openlibrary.edition_key === p.candidate.edition_key) ||
      (item?.openlibrary?.edition_key &&
        item?.isbn &&
        p.candidate.isbn &&
        String(item.isbn) === String(p.candidate.isbn));
    if (alreadySameEdition) {
      cancelSearchEditionPreview();
      render();
      setToast("Edition already applied.", { hint: "Relative to your library." });
      return;
    }

    // If the item was manual-first, attach its work identity for future dedupe.
    if (workKey && (!item.source || !item.source.provider)) {
      patch.source = { provider: "openlibrary", key: workKey };
    }

    // Explicit user action: apply edition metadata (overwrites).
    if (p.candidate.cover_url) patch.cover_url = p.candidate.cover_url;
    if (p.candidate.first_publish_year != null) patch.first_publish_year = p.candidate.first_publish_year;
    if (p.candidate.isbn) patch.isbn = p.candidate.isbn;
    if (p.candidate.publisher) patch.publisher = p.candidate.publisher;
    const lang =
      Array.isArray(p.candidate.languages) && p.candidate.languages.length ? p.candidate.languages[0] : null;
    if (lang) patch.language = lang;

    patch.openlibrary = {
      work_key: workKey,
      edition_key: p.candidate.edition_key ?? null,
      updated_at: nowIso()
    };

    await handlePatchItem(itemId, patch);
    cancelSearchEditionPreview();
    render();
    setToast("Edition updated.", { hint: "Does not affect ranking." });
  }

		  async function handleSetStatus(itemId, status) {
	    const prev = state.libraryByItemId.get(itemId);
	    const entry = await idb.setLibraryStatus(itemId, status);
	    state.libraryByItemId.set(itemId, entry);
	    const idx = state.libraryEntries.findIndex((e) => e.item_id === itemId);
	    if (idx >= 0) state.libraryEntries[idx] = entry;
	    else state.libraryEntries.push(entry);

		    const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;
		    if (entry.status === "finished" && !entry.archived_at && decidedComparisonsCount > 0) {
		      state.libraryView = "unplaced";
		      setLibraryTab("ranking", { renderNow: false, preserveView: true });
		    }
		    if (entry.status === "want" || entry.status === "reading") {
		      state.libraryView = "want";
		      setLibraryTab("want", { renderNow: false, preserveView: true });
		    }

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
	      started_at: nowIso(),
      completed_at: null
	    };
    state.currentPairKey = null;
    state.currentPairShownAt = null;
    logEvent("compare_session_started", {
      mode,
      steps_total: stepsTotal,
      target_item_id: targetItemId ?? null,
      is_initial: !!state.session.is_initial
    });
	    setSurface("compare");
	    render();
	  }

  function maybeLogSessionCompleted() {
    const s = state.session;
    if (!s || s.completed_at) return;
    const sessionComparisons = state.comparisons.filter((c) => c.session_id === s.session_id);
    const stepsDone =
      s.mode === "after_finish" || s.mode === "recheck"
        ? sessionComparisons.filter((c) => c.winner_item_id != null).length
        : sessionComparisons.length;
    if (stepsDone < (s.steps_total ?? 0)) return;

    s.completed_at = nowIso();
    const startedMs = Date.parse(s.started_at);
    const durationMs = Number.isFinite(startedMs) ? Date.now() - startedMs : null;
    logEvent("compare_session_completed", {
      mode: s.mode,
      comparisons_count: stepsDone,
      duration_ms: durationMs
    });
  }

  async function handleCompare({ winner, input = "unknown" }) {
    if (!state.session || !state.currentPair) return;
    if (state.comparePending) return;
    const { a, b } = state.currentPair;
    const winnerId = winner === "a" ? a : winner === "b" ? b : null;

    const actionAt = Date.now();
    const timeToDecideMs =
      typeof state.currentPairShownAt === "number" ? Math.max(0, actionAt - state.currentPairShownAt) : null;

    state.compareEnterAt = 0;
    state.comparePending = { action: winnerId ? "win" : "skip", winner: winner ?? null, at: Date.now() };
    render();
    try {
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
      logEvent("comparison_made", {
        mode: state.session.mode,
        a_id: a,
        b_id: b,
        winner: winner ?? null,
        winner_item_id: winnerId ?? null,
        input,
        time_to_decide_ms: timeToDecideMs
      });
      maybeLogSessionCompleted();
    } finally {
      const tapToNextMs = Math.max(0, Date.now() - actionAt);
      if (state.session) {
        logEvent("compare_tap_to_next", { mode: state.session.mode, input, tap_to_next_ms: tapToNextMs });
      }
      state.comparePending = null;
      state.compareEnterAt = Date.now();
      render();
    }
  }

  async function handleUndo({ input = "unknown" } = {}) {
    if (state.comparePending) return;
    state.compareEnterAt = 0;
    state.comparePending = { action: "undo", winner: null, at: Date.now() };
    render();
    try {
      const deleted = await idb.deleteLastComparison();
      if (!deleted) return;
      state.comparisons = state.comparisons.filter((c) => c.id !== deleted.id);
      // Undo should not bootstrap ratings either; just recompute from truth.
      await recomputeAndPersistWithBootstrap([]);
      logEvent("comparison_undo", { mode: state.session?.mode ?? null, input });
    } finally {
      state.comparePending = null;
      state.compareEnterAt = Date.now();
      render();
    }
  }

  async function handleExport() {
    const data = await idb.exportAllData({ curveVersion: CURVE_VERSION });
    const ts = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
    downloadJson(`checkcheck-export-${ts}.json`, data);
  }

  async function handleExportTrace() {
    const data = await idb.exportEvents({ app: { curve_version: CURVE_VERSION } });
    const ts = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
    downloadJson(`checkcheck-trace-${ts}.json`, data);
  }

  async function handleClearTrace() {
    if (!confirm("Clear trace?")) return;
    await idb.clearEvents();
    setToast("Trace cleared.");
  }

  async function handleImport(file) {
    const text = await file.text();
    const parsed = parseImportFileText({ text, fileName: file?.name ?? "" });

    if (parsed.kind === "checkcheck_json") {
      state.importFlow = { kind: "checkcheck_json", fileName: parsed.fileName, exportObj: parsed.exportObj };
      render();
      return;
    }

    if (parsed.kind === "csv_export") {
      state.importFlow = {
        kind: "csv_export",
        provider: parsed.provider,
        fileName: parsed.fileName,
        books: parsed.books
      };
      render();
      return;
    }

    throw new Error(parsed?.error || "Unsupported import file.");
  }

  function providerLabel(provider) {
    if (provider === "goodreads") return "Goodreads";
    if (provider === "storygraph") return "StoryGraph";
    return "CSV export";
  }

  async function bulkAddCompat({ items = [], libraryEntries = [] } = {}) {
    if (typeof idb.bulkAddItemsAndEntries === "function") {
      await idb.bulkAddItemsAndEntries({ items, libraryEntries });
      return;
    }

    // Back-compat: older clients may have cached an idb module without bulkAddItemsAndEntries.
    // Use the same DB/stores by name, in a single transaction.
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("checkcheck");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["items", "library_entries"], "readwrite");
        const itemsStore = tx.objectStore("items");
        const entriesStore = tx.objectStore("library_entries");
        for (const it of Array.isArray(items) ? items : []) itemsStore.put(it);
        for (const e of Array.isArray(libraryEntries) ? libraryEntries : []) entriesStore.put(e);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  function buildExistingIndexes() {
    const bySource = new Map(); // `${provider}|||${key}` -> item_id
    const byTitleAuthor = new Map(); // normalized -> item_id
    for (const it of state.items) {
      const p = it?.source?.provider;
      const k = it?.source?.key;
      if (p && k) bySource.set(`${String(p)}|||${String(k)}`, it.id);
      const norm = normalizeTitleAuthorKeyForDedupe({ title: it?.title ?? "", author: it?.author ?? "" });
      if (norm) byTitleAuthor.set(norm, it.id);
    }
    return { bySource, byTitleAuthor };
  }

  async function applyCsvImport(flow) {
    const provider = flow?.provider;
    const books = Array.isArray(flow?.books) ? flow.books : [];
    if (!provider || books.length === 0) return { added: 0, legacyUpdated: 0, skipped: 0 };

    const { bySource, byTitleAuthor } = buildExistingIndexes();

    const now = nowIso();
    const itemsToPut = [];
    const entriesToPut = [];
    const itemsToUpdateLegacyOnly = [];

    let skipped = 0;
    let legacyUpdated = 0;

    for (const b of books) {
      const title = String(b?.title ?? "").trim();
      if (!title) continue;
      const author = String(b?.author ?? "").trim();

      const sourceProvider = b?.source?.provider ? String(b.source.provider) : provider;
      const sourceKey = b?.source?.key != null && String(b.source.key).trim() ? String(b.source.key).trim() : null;
      const sourceId = sourceKey ? `${sourceProvider}|||${sourceKey}` : null;
      const norm = normalizeTitleAuthorKeyForDedupe({ title, author });

      const existingId = sourceId ? bySource.get(sourceId) : byTitleAuthor.get(norm);

      if (existingId) {
        skipped += 1;
        const existingItem = state.itemsById.get(existingId);
        const nextLegacy = {
          ...(existingItem?.legacy ?? {}),
          [provider]: existingItem?.legacy?.[provider] ?? {
            rating: b?.legacy?.rating ?? null,
            review: b?.legacy?.review ?? null,
            imported_at: now
          }
        };
        const didAddLegacy = existingItem?.legacy?.[provider] == null && (b?.legacy?.rating != null || b?.legacy?.review);
        if (didAddLegacy) {
          legacyUpdated += 1;
          itemsToUpdateLegacyOnly.push({ ...(existingItem ?? {}), legacy: nextLegacy });
        }
        continue;
      }

      const item = {
        id: crypto.randomUUID(),
        title,
        author,
        source: { provider: sourceProvider, key: sourceKey },
        isbn: b?.isbn ?? null,
        cover_url: null,
        first_publish_year: null,
        raw_subjects: [],
        legacy:
          b?.legacy?.rating != null || b?.legacy?.review
            ? {
                [provider]: {
                  rating: b?.legacy?.rating ?? null,
                  review: b?.legacy?.review ?? null,
                  imported_at: now
                }
              }
            : {},
        created_at: now
      };

      const status = b?.status === "finished" || b?.status === "reading" || b?.status === "want" ? b.status : "want";
      const entry = {
        item_id: item.id,
        status,
        finished_at: status === "finished" ? (b?.finished_at ?? now) : null,
        type_suggested: null,
        type_confirmed: null,
        type_decision: null,
        tags: [],
        archived_at: null,
        created_at: now,
        updated_at: now
      };

      itemsToPut.push(item);
      entriesToPut.push(entry);
      if (sourceId) bySource.set(sourceId, item.id);
      if (norm) byTitleAuthor.set(norm, item.id);
    }

    await bulkAddCompat({ items: [...itemsToPut, ...itemsToUpdateLegacyOnly], libraryEntries: entriesToPut });

    return { added: itemsToPut.length, legacyUpdated, skipped };
  }

  async function applyImportFlow() {
    const flow = state.importFlow;
    if (!flow) return;

    if (flow.kind === "checkcheck_json") {
      if (!confirm("Replace local data with this import?")) return;
      await idb.importExportBlob(flow.exportObj);
      state.importFlow = null;
      await load();
      setToast("Import complete.", { hint: "Ratings are relative to your library." });
      return;
    }

    if (flow.kind === "csv_export") {
      const res = await applyCsvImport(flow);
      state.importFlow = null;
      await load();

      setSurface("library");
      state.libraryView = state.finishedIds.length ? "unplaced" : "want";

      const hint =
        res.skipped > 0
          ? `Added ${res.added}. Skipped ${res.skipped} already in your library.`
          : `Added ${res.added}.`;
      setToast(`${providerLabel(flow.provider)} import complete.`, { hint });

      if (state.finishedIds.length >= 5 && state.decidedComparisonsCount === 0) {
        state.postImportMicCheckPrompt = { at: Date.now() };
      }
      render();
      return;
    }
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
	      handleAddItem(form, ev.submitter ?? null).catch((e) => alert(String(e)));
	    }
	    if (action === "search:openlibrary") {
	      ev.preventDefault();
	      handleSearchOpenLibrary(form).catch((e) => alert(String(e)));
	    }
	    if (action === "tag:add") {
      ev.preventDefault();
      handleTagAdd(form).catch((e) => alert(String(e)));
    }
  });

  root.addEventListener("change", (ev) => {
    const el = ev.target;
    if (!(el instanceof HTMLSelectElement)) return;
    const action = el.getAttribute("data-action");
    if (action === "type:select") {
      handleTypeSelect(el.value).catch((e) => alert(String(e)));
    }
    if (action === "lang:set") {
      const v = String(el.value || "").trim().toLowerCase();
      const allowed = new Set(["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "any"]);
      state.searchLanguage = allowed.has(v) ? v : "en";
      render();
    }
  });

	  root.addEventListener("click", (ev) => {
	    const el = ev.target instanceof Element ? ev.target.closest("[data-action]") : null;
	    if (!el) return;
	    const action = el.getAttribute("data-action");
	    if (!action) return;
	    if (state.comparePending && (action === "compare:win" || action === "compare:skip" || action === "compare:undo")) {
      logEvent("compare_pending_lock_blocked", {
        action: action === "compare:win" ? "win" : action === "compare:skip" ? "skip" : "undo"
      });
      return;
    }

		    if (action === "nav:library") return setSurface("library"), render();
		    if (action === "tab:select") {
		      const tab = el.getAttribute("data-tab");
		      if (tab === "add" || tab === "want" || tab === "ranking" || tab === "discover") {
		        setLibraryTab(tab);
		      }
		      return;
		    }
		    if (action === "export") return void handleExport().catch((e) => alert(String(e)));
	    if (action === "trace:export") return void handleExportTrace().catch((e) => alert(String(e)));
	    if (action === "trace:clear") return void handleClearTrace().catch((e) => alert(String(e)));

			    if (action === "library:view") {
			      const view = el.getAttribute("data-view");
			      if (view !== "want" && view !== "unplaced" && view !== "finished") return;
			      state.libraryView = view;
			      if (view === "want") setLibraryTab("want", { touched: true, renderNow: false, preserveView: true });
			      else setLibraryTab("ranking", { touched: true, renderNow: false, preserveView: true });
			      render();
			      return;
			    }

	    if (action === "import:open") {
	      const input = document.createElement("input");
	      input.type = "file";
	      input.accept = ".json,.csv,application/json,text/csv";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) handleImport(file).catch((e) => alert(String(e)));
      };
      input.click();
      return;
    }

    if (action === "import:cancel") {
      state.importFlow = null;
      render();
      return;
    }

    if (action === "import:apply") return void applyImportFlow().catch((e) => alert(String(e)));

    if (action === "postimport:miccheck") {
      state.postImportMicCheckPrompt = null;
      render();
      return startSession({ stepsTotal: 10, mode: "mic_check" });
    }

    if (action === "postimport:later") {
      state.postImportMicCheckPrompt = null;
      render();
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
		      if (!canStartCompare) {
		        setToast("Finish 5 books to unlock placement.", { hint: "We need a few finished books before comparisons." });
		        return;
		      }
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
      const d = state.derivedById.get(itemId);
      const isRated = d?.stars_display != null;
      const mode = isRated ? "recheck" : "after_finish";
	      return startSession({ stepsTotal: 3, mode, targetItemId: itemId });
	    }

		    if (action === "after_finish:back_to_finished") {
		      setSurface("library");
		      state.libraryView = "unplaced";
		      render();
		      return;
		    }

    if (action === "recheck:back_to_detail") {
      const targetId = state.session?.target_item_id;
      if (!targetId) return;
      state.detailItemId = targetId;
      setSurface("detail");
      render();
      return;
    }

    if (action === "compare:win") {
      const winner = el.getAttribute("data-winner");
      if (winner !== "a" && winner !== "b") return;
      const input = el.classList.contains("compareCard") ? "card" : "button";
      state.lastCompareInput = { input, action: "win", winner, at: Date.now() };
      logEvent("compare_input", { input, winner, action: "win" });
      return void handleCompare({ winner, input }).catch((e) => alert(String(e)));
    }
    if (action === "compare:skip") {
      const input = el.classList.contains("compareCard") ? "card" : "button";
      state.lastCompareInput = { input, action: "skip", winner: null, at: Date.now() };
      logEvent("compare_input", { input, winner: "skip", action: "skip" });
      return void handleCompare({ winner: null, input }).catch((e) => alert(String(e)));
    }
    if (action === "compare:undo") {
      const input = el.classList.contains("compareCard") ? "card" : "button";
      state.lastCompareInput = { input, action: "undo", winner: null, at: Date.now() };
      logEvent("compare_input", { input, winner: "undo", action: "undo" });
      return void handleUndo({ input }).catch((e) => alert(String(e)));
    }

	    if (action === "open:detail") {
	      const itemId = el.getAttribute("data-item-id");
	      if (!itemId) return;
	      state.detailItemId = itemId;
	      state.detailOpenLibraryStatus = "idle";
	      state.detailOpenLibraryCandidate = null;
	      state.detailOpenLibraryCandidates = null;
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

	    if (action === "meta:update_openlibrary") return void startOpenLibraryUpdate();
	    if (action === "meta:cancel_openlibrary") return void cancelOpenLibraryUpdate();
	    if (action === "meta:apply_openlibrary") return void applyOpenLibraryUpdate().catch((e) => alert(String(e)));
	    if (action === "meta:pick_openlibrary") {
	      const idx = el.getAttribute("data-cand-idx");
	      pickOpenLibraryCandidate(idx);
	      return;
	    }

    if (action === "finishprompt:dismiss") {
      state.finishPromptItemId = null;
      state.finishPromptToken = null;
      render();
      return;
    }

    if (action === "quick:finish") {
      const itemId = el.getAttribute("data-item-id");
      if (!itemId) return;
      const entry = state.libraryByItemId.get(itemId);
      if (!entry || entry.archived_at || entry.status === "finished") return;
      return void handleSetStatus(itemId, "finished").catch((e) => alert(String(e)));
    }

	    if (action === "search:add") {
	      const idx = Number(el.getAttribute("data-result-idx") || "-1");
	      if (!Number.isFinite(idx) || idx < 0) return;
	      const targetStatus = el.getAttribute("data-target-status") || "want";
	      return void handleAddFromSearch(idx, targetStatus).catch((e) => alert(String(e)));
	    }

    if (action === "search:open_existing") {
      const itemId = el.getAttribute("data-item-id");
      return void handleSearchOpenExisting(itemId).catch((e) => alert(String(e)));
    }

    if (action === "search:update_edition") {
      const idx = el.getAttribute("data-result-idx");
      const itemId = el.getAttribute("data-item-id");
      return void handleSearchStartEditionPreview(idx, itemId).catch((e) => alert(String(e)));
    }

    if (action === "search:cancel_edition") {
      cancelSearchEditionPreview();
      render();
      return;
    }

    if (action === "search:apply_edition") {
      return void handleSearchApplyEdition().catch((e) => alert(String(e)));
    }

	    if (action === "search:clear") {
	      state.searchQuery = "";
	      state.searchResults = [];
	      state.searchStatus = "idle";
	      state.searchError = null;
	      state.searchRequestId++;
	      state.searchEditionPreview = null;
	      state.searchConfidence = null;
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

    if (action === "type:useSuggested") {
      return void handleTypeUseSuggested().catch((e) => alert(String(e)));
    }
    if (action === "type:clear") {
      return void handleTypeClear().catch((e) => alert(String(e)));
    }
    if (action === "tag:remove") {
      const idx = el.getAttribute("data-tag-idx");
      return void handleTagRemove(idx).catch((e) => alert(String(e)));
    }
  });

  await load();
}
