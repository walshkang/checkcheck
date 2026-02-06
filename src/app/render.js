import { formatTopPct } from "./ui_format.js";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let nextStarClipId = 0;
function allocStarClipId() {
  nextStarClipId += 1;
  return `starclip-${nextStarClipId}`;
}

function renderStars(starsDisplay, { sizePx = null, step = 0.25 } = {}) {
  if (starsDisplay == null) return "";
  const clamped = Math.max(0, Math.min(5, Number(starsDisplay)));
  const q = Math.max(0, Math.min(5, Math.round(clamped / step) * step));
  const label = `${q % 1 === 0 ? String(q) : q.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} out of 5 stars`;
  const size = sizePx != null ? `--stars-size:${Number(sizePx)}px;` : "";
  const style = size ? ` style="${escapeHtml(size)}"` : "";
  const fills = Array.from({ length: 5 }, (_, i) => Math.max(0, Math.min(1, q - i)));
  const starPath =
    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";
  const stars = fills
    .map((f) => {
      const clipId = allocStarClipId();
      const w = (24 * f).toFixed(2);
      return `
        <svg class="starSvg" viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <clipPath id="${clipId}">
              <rect x="0" y="0" width="${w}" height="24"></rect>
            </clipPath>
          </defs>
          <path class="starOutline" d="${starPath}"></path>
          <g clip-path="url(#${clipId})">
            <path class="starFill" d="${starPath}"></path>
          </g>
        </svg>
      `;
    })
    .join("");
  return `
    <span class="stars" role="img" aria-label="${escapeHtml(label)}"${style}>${stars}</span>
  `;
}

function itemTitle(item) {
  return escapeHtml(item?.title ?? "");
}

function itemAuthor(item) {
  return escapeHtml(item?.author ?? "");
}

function toneFromPercentile(p) {
  const x = Number(p);
  if (!Number.isFinite(x)) return "tone-mid";
  if (x >= 0.66) return "tone-good";
  if (x >= 0.33) return "tone-mid";
  return "tone-bad";
}

export function renderApp(state) {
  const { surface } = state;
  const navLibraryCurrent = surface === "library" ? ' aria-current="page"' : "";

  return `
    <div class="topbar">
      <div class="brand">
        <h1>checkcheck</h1>
        <div class="tagline">Mic-check your taste.</div>
      </div>
      <div class="nav">
        <button class="pill" data-action="nav:library"${navLibraryCurrent}>Library</button>
      </div>
    </div>
    ${state.toast ? renderToast(state.toast) : ""}
    ${surface === "library" ? renderLibrary(state) : ""}
    ${surface === "compare" ? renderCompare(state) : ""}
    ${surface === "detail" ? renderDetail(state) : ""}
    ${renderFooter(state)}
  `;
}

function renderToast(toast) {
  return `
    <div class="toast" role="status" aria-live="polite">
      <div class="msg">${escapeHtml(toast.msg)}</div>
      ${toast.hint ? `<div class="hint">${escapeHtml(toast.hint)}</div>` : ""}
    </div>
  `;
}

function renderFooter(state) {
  const finishedCount = state.finishedIds.length;
  const comps = state.comparisons.length;
  return `
    <div class="footer">
      <div>
        <span class="chip">Finished: ${finishedCount}</span>
        <span class="chip">Comparisons: ${comps}</span>
      </div>
      <div class="row" style="gap:12px;">
        <button class="link" data-action="export">Export JSON</button>
        <button class="link" data-action="trace:export">Export trace</button>
        <button class="link" data-action="import:open">Import…</button>
        <button class="link" data-action="trace:clear">Clear trace</button>
        <button class="link" data-action="dev:resetDerived">Reset display</button>
        <button class="link" data-action="dev:wipeAll">Clear local data</button>
      </div>
    </div>
		  `;
	}

function providerLabel(provider) {
  if (provider === "goodreads") return "Goodreads";
  if (provider === "storygraph") return "StoryGraph";
  return "CSV export";
}

function renderImportFlow(state) {
  const flow = state.importFlow;
  if (!flow) return "";

  if (flow.kind === "checkcheck_json") {
    return `
      <div class="banner" data-kind="import-flow">
        <div class="title">Import checkcheck JSON</div>
        <div class="sub">This replaces local data on this device.</div>
        <div style="height:10px;"></div>
        <div class="row" style="justify-content:flex-start; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" type="button" data-action="import:apply">Replace local data</button>
          <button class="btn" type="button" data-action="import:cancel">Cancel</button>
        </div>
      </div>
      <div style="height:12px;"></div>
    `;
  }

  if (flow.kind === "csv_export") {
    const books = Array.isArray(flow.books) ? flow.books : [];
    const counts = { want: 0, reading: 0, finished: 0 };
    for (const b of books) counts[b?.status] = (counts[b?.status] ?? 0) + 1;
    const total = books.length;
    return `
      <div class="banner" data-kind="import-flow">
        <div class="title">Import ${providerLabel(flow.provider)} CSV</div>
        <div class="sub">${total} books · Want ${counts.want ?? 0} · Reading ${counts.reading ?? 0} · Finished ${
          counts.finished ?? 0
        }</div>
        <div style="height:10px;"></div>
        <div class="row" style="justify-content:flex-start; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" type="button" data-action="import:apply" ${total ? "" : "disabled"}>Import</button>
          <button class="btn" type="button" data-action="import:cancel">Cancel</button>
        </div>
        <div style="height:8px;"></div>
        <div class="muted">Legacy ratings/reviews are saved but never used for checkcheck ranking.</div>
      </div>
      <div style="height:12px;"></div>
    `;
  }

  return "";
}

function renderPostImportMicCheckPrompt(state) {
  if (!state.postImportMicCheckPrompt) return "";
  return `
    <div class="banner" data-kind="postimport-miccheck">
      <div class="title">Start a mic check?</div>
      <div class="sub">Ten quick picks to rank your shelf. Or review later — your finished books stay unranked until comparisons.</div>
      <div style="height:10px;"></div>
      <div class="row" style="justify-content:flex-start; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" type="button" data-action="postimport:miccheck">Start mic check</button>
        <button class="btn" type="button" data-action="postimport:later">I’ll review later</button>
      </div>
    </div>
    <div style="height:12px;"></div>
  `;
}

function renderLibrary(state) {
  const empty = state.items.length === 0;
  const addLabel = empty ? "Add your first book" : "Add book";
  const searchPanel = renderSearchPanel(state);
  const importFlow = renderImportFlow(state);
  const postImportPrompt = renderPostImportMicCheckPrompt(state);
  const archivedCount = state.archivedIds?.length ?? 0;
  const decidedComparisonsCount =
    typeof state.decidedComparisonsCount === "number"
      ? state.decidedComparisonsCount
      : state.comparisons.filter((c) => c.winner_item_id != null).length;
  const finishedCount = state.finishedIds?.length ?? 0;
  const onboardingActive = decidedComparisonsCount === 0;
  const onboardingBanner = onboardingActive
    ? `
        <div class="banner" data-kind="onboarding-init">
          <div class="title">${finishedCount >= 5 ? "Ready for a mic check?" : "Add 5 finished books to begin"}</div>
          <div class="sub">${
            finishedCount >= 5
              ? "Ten quick picks. Your shelf will snap into place."
              : `Finished ${finishedCount} / 5 · Add books you’ve read as Finished.`
          }</div>
          <div style="height:10px;"></div>
          <button class="btn primary" type="button" data-action="start:miccheck" ${finishedCount >= 5 ? "" : "disabled"}>Start mic check</button>
        </div>
        <div style="height:12px;"></div>
      `
    : "";

  const unplacedIds = Array.isArray(state.unplacedIds) ? state.unplacedIds : [];
  const canStartCompare = state.finishedIds.length >= 5;
  const isInitiated = decidedComparisonsCount > 0;

  const unplacedHeader =
    state.libraryView === "unplaced" && unplacedIds.length > 0
    ? `
        <div data-kind="unplaced-header" class="inlinePrompt" style="margin-bottom:12px;">
          <div class="row" style="justify-content:space-between; align-items:center; gap:10px;">
            <div class="stack" style="gap:2px;">
              <div class="title">Unplaced (${unplacedIds.length})</div>
              <div class="muted">${
                !canStartCompare
                  ? "Finish 5 books to unlock placement."
                  : !isInitiated
                    ? "Unlock placement with one mic check decision."
                    : "Check each finished book in 3 picks."
              }</div>
            </div>
            ${
              !canStartCompare
                ? `<button class="btn" type="button" disabled>Finish 5 books to unlock placement</button>`
                : !isInitiated
                  ? `<button class="btn primary" type="button" data-action="start:miccheck">Unlock placement (Mic check)</button>`
                  : ""
            }
          </div>
        </div>
      `
    : "";

  const manualForm = `
    <form class="stack" data-action="add:item">
      <input class="input" name="title" placeholder="Title" autocomplete="off" required />
      <input class="input" name="author" placeholder="Author (optional)" autocomplete="off" />
      <div class="row" style="justify-content:flex-start; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" type="submit" name="add_intent" value="want" data-intent="want">${addLabel} to Want</button>
        <button class="btn" type="submit" name="add_intent" value="finished" data-intent="finished">Add as Finished</button>
      </div>
    </form>
  `;
  const manualSection = state.searchEnabled
    ? `
        <details data-kind="manual-add" style="margin-top:10px;">
          <summary class="link">Can’t find it? Add manually</summary>
          <div style="height:10px;"></div>
          ${manualForm}
        </details>
      `
    : manualForm;

  const listRows = state.libraryRows.filter((row) => {
    if (row.entry.archived_at) return true;
    if (state.libraryView === "unplaced") return row.entry.status === "finished" && row.derived?.stars_display == null;
    if (state.libraryView === "finished") return row.entry.status === "finished" && row.derived?.stars_display != null;
    return row.entry.status === "want" || row.entry.status === "reading";
  });

	  const listItems = listRows
		    .map((row) => {
		      const { item, entry, derived, rank } = row;
		      const isArchived = !!entry.archived_at;
		      const isFinishedActive = entry.status === "finished" && !isArchived;
		      const isRated = !!derived && derived.stars_display != null;
	      const stars = isRated ? renderStars(derived.stars_display) : "";
	      const rankScore =
	        isRated && derived
		          ? `<div class="rankScore ${toneFromPercentile(derived.percentile)}">${escapeHtml(
		              derived.rank_score_raw.toFixed(2)
		            )} / 5.00</div>`
		          : "";
	      const ratingSlot =
	        state.libraryView === "unplaced" && isFinishedActive && !isRated
	          ? `<span class="chip">Not rated</span>`
	          : stars
	            ? `${stars}${rankScore}`
	            : "";
	      const unplacedCta =
	        state.libraryView === "unplaced" && isFinishedActive && !isArchived
	          ? !canStartCompare
	            ? `<button class="btn" type="button" data-kind="unplaced-cta" disabled>Finish 5 books to unlock placement</button>`
	            : !isInitiated
		              ? `<button class="btn primary" type="button" data-kind="unplaced-cta" data-action="start:miccheck">Unlock placement (Mic check)</button>`
		              : `<button class="btn primary" type="button" data-kind="unplaced-cta" data-action="start:focus" data-item-id="${escapeHtml(
		                  item.id
		                )}">Check</button>`
		          : "";
	      const showTypeChip =
	        !isArchived &&
	        state.libraryView === "want" &&
	        entry.status !== "finished" &&
	        (entry.type_confirmed || entry.type_suggested);
	      const typeChip = showTypeChip
	        ? entry.type_confirmed
	          ? `<span class="chip">${escapeHtml(entry.type_confirmed)}</span>`
	          : `<span class="chip suggested" title="Suggested from metadata">${escapeHtml(entry.type_suggested)}</span>`
	        : "";
	      const quickFinish =
	        !isArchived && state.libraryView === "want" && entry.status !== "finished"
	          ? `<button class="chip icon" type="button" data-action="quick:finish" data-item-id="${escapeHtml(item.id)}" aria-label="Mark finished" title="Mark finished">✓</button>`
	          : "";
	      const scoredCount = state.scoredIds?.length ?? 0;
	      const sub = isArchived
	        ? "Archived — restore to compare."
	        : isFinishedActive
          ? isRated
            ? `${formatTopPct(derived.percentile)} · Based on ${derived.comparisons_count} comparisons`
            : decidedComparisonsCount > 0
              ? "Not rated yet — check it."
              : "Not rated yet — do a mic check."
          : "Add a few finished books, then we’ll do a quick mic check to rank them.";
        const titlePrefix =
          state.libraryView === "finished" && isFinishedActive && isRated
            ? `<span class="rankBadge">#${escapeHtml(rank)}</span>`
            : "";
      const showFinishPrompt =
        state.finishPromptItemId === item.id && isFinishedActive && decidedComparisonsCount > 0;
	      const finishPrompt = showFinishPrompt
	        ? `
	            <div class="inlinePrompt">
	              <div class="muted">Want to tighten this?</div>
	              <div class="row" style="justify-content:flex-start; gap:10px; margin-top:6px;">
	                <button class="btn primary" type="button" data-action="start:focus" data-item-id="${escapeHtml(item.id)}">Check</button>
	                <button class="link" type="button" data-action="finishprompt:dismiss">Dismiss</button>
	              </div>
	            </div>
	          `
	        : "";
      return `
        <li class="list-item" data-kind="library-item" data-action="open:detail" data-item-id="${escapeHtml(item.id)}">
	            <div class="row">
	            <div class="stack" style="gap:4px;">
		              <div class="title">${titlePrefix}${itemTitle(item)}</div>
		              ${itemAuthor(item) ? `<div class="authorLine">${itemAuthor(item)}</div>` : ""}
		              <div class="sub">${escapeHtml(sub)}</div>
		            </div>
			            <div class="stack" style="align-items:flex-end; gap:8px;">
			              ${unplacedCta}
			              ${ratingSlot}
			              ${quickFinish}
			              ${typeChip}
			              ${isArchived ? `<span class="chip">Archived</span>` : ""}
	            </div>
	          </div>
		          ${finishPrompt}
		        </li>
      `;
    })
    .join("");

		  return `
			    <div class="grid">
			      <div class="card">
			        <h2>Add books</h2>
			        ${
			          empty
			            ? `<div class="muted" style="margin-bottom:12px;">Mic check your taste. Add a few books you’ve read. Then we’ll do a quick mic check to rank them.</div>`
			            : ""
			        }
			        ${searchPanel}
			        ${manualSection}
			      </div>
	      <div class="card">
	        <div class="row" style="margin-bottom:10px;">
	          <h2 style="margin:0;">Your shelf</h2>
          ${
            archivedCount > 0
              ? `<button class="link" data-action="toggle:archived">${state.showArchived ? "Hide archived" : "Show archived"} (${archivedCount})</button>`
	              : ""
	          }
	        </div>
		        <div class="row" style="justify-content:flex-start; gap:8px; margin-bottom:12px;">
		          <button class="pill" data-action="library:view" data-view="want"${state.libraryView === "want" ? ' aria-current="page"' : ""}>Want to read</button>
		          <button class="pill" data-action="library:view" data-view="unplaced"${
		            state.libraryView === "unplaced" ? ' aria-current="page"' : ""
		          }>Unplaced${unplacedIds.length ? ` (${unplacedIds.length})` : ""}</button>
		          <button class="pill" data-action="library:view" data-view="finished"${
		            state.libraryView === "finished" ? ' aria-current="page"' : ""
		          }>Finished</button>
		        </div>
		        ${importFlow}
		        ${postImportPrompt}
		        ${onboardingBanner}
		        ${unplacedHeader}
		        ${
		          state.items.length === 0
		            ? `<div class="muted">Add your first book to begin.</div>`
		            : listRows.length === 0
		              ? `<div class="muted">${
		                  state.libraryView === "unplaced"
		                    ? "No unplaced books right now."
		                    : state.libraryView === "finished"
		                      ? unplacedIds.length
		                        ? `No rated books yet. Place books in Unplaced (${unplacedIds.length}).`
		                        : "No finished books yet."
		                      : "No want-to-read books yet."
		                }</div>`
		              : `<ul class="list">${listItems}</ul>`
	        }
	      </div>
	    </div>
	  `;
}

	function renderSearchPanel(state) {
  if (!state.searchEnabled) return "";

  const q = escapeHtml(state.searchQuery || "");
  const status = state.searchStatus || "idle";
  const langMode = typeof state.searchLanguage === "string" ? state.searchLanguage : "en";

  function normalizeKey(title, author) {
    return `${String(title || "").trim().toLowerCase()}|${String(author || "").trim().toLowerCase()}`;
  }

  function findExistingItemIdForResult(r) {
    const workKey = r?.source?.provider === "openlibrary" ? r?.source?.key : null;
    if (workKey) {
      const it = state.items?.find(
        (x) =>
          (x?.source?.provider === "openlibrary" && x?.source?.key === workKey) ||
          (x?.openlibrary?.work_key && x.openlibrary.work_key === workKey)
      );
      if (it?.id) return it.id;
    }
    const key = normalizeKey(r?.title, r?.author);
    if (!key || key === "|") return null;
    const it = state.items?.find((x) => normalizeKey(x?.title, x?.author) === key);
    return it?.id ?? null;
  }

  function languageLabel(code3) {
    const c = String(code3 || "").trim().toLowerCase();
    return (
      {
        eng: "English",
        spa: "Spanish",
        fre: "French",
        fra: "French",
        ger: "German",
        deu: "German",
        ita: "Italian",
        por: "Portuguese",
        jpn: "Japanese",
        kor: "Korean",
        chi: "Chinese",
        zho: "Chinese"
      }[c] ?? (c ? c.toUpperCase() : "")
    );
  }

  const header =
    status === "loading"
      ? `<div class="muted">Searching…</div>`
      : status === "done" && state.searchResults.length === 0
        ? `<div class="muted">No results.</div>`
        : status === "error"
          ? `<div class="muted">Search error.</div>`
          : `<div class="muted">Search Open Library</div>`;

  const closeMatchesHint =
    status === "done" && state.searchResults.length && state.searchConfidence && !state.searchConfidence.ok
      ? `<div class="muted" style="margin-top:6px; font-size:12px;">Showing close matches — double-check title/author.</div>`
      : "";

	const results =
	    state.searchResults?.length
	      ? `<ul class="list" style="margin-top:10px;">
	          ${state.searchResults
		            .map((r, i) => {
                const title = escapeHtml(r.title || "");
                const author = escapeHtml(r.author || "");
                const existingItemId = findExistingItemIdForResult(r);
                const isExisting = !!existingItemId;
                const existingEntry = isExisting ? state.libraryByItemId?.get(existingItemId) ?? null : null;
                const canPromoteFinished =
                  isExisting && (!!existingEntry?.archived_at || (existingEntry?.status && existingEntry.status !== "finished"));
	              const suggested = r.type_suggested
	                ? `<div class="sub">Suggested: ${escapeHtml(r.type_suggested)}</div>`
	                : "";
                const editionBits = [];
                if (r.publisher) editionBits.push(escapeHtml(r.publisher));
                if (r.first_publish_year) editionBits.push(escapeHtml(r.first_publish_year));
                const langLabel = languageLabel(r.language);
                if (langLabel) editionBits.push(escapeHtml(langLabel));
                if (r.isbn) editionBits.push(`ISBN ${escapeHtml(String(r.isbn).slice(0, 13))}`);
                const editionLine = editionBits.length ? `<div class="sub muted">${editionBits.join(" • ")}</div>` : "";
	              const cover = r.cover_url
	                ? `<img src="${escapeHtml(r.cover_url)}" alt="" width="32" height="48" style="border-radius:8px; border:1px solid var(--stroke);" loading="lazy" />`
	                : `<div style="width:32px; height:48px; border-radius:8px; border:1px solid var(--stroke); background: rgba(255,255,255,0.4);"></div>`;

	              const btnWant = `<button class="btn" type="button" data-action="search:add" data-target-status="want" data-result-idx="${i}">Want</button>`;
	              const btnFinished = `<button class="btn" type="button" data-action="search:add" data-target-status="finished" data-result-idx="${i}">Finished</button>`;
                const btnOpen = `<button class="btn" type="button" data-action="search:open_existing" data-item-id="${escapeHtml(
                  existingItemId
                )}">Open</button>`;
                const btnPromoteFinished = `<button class="btn" type="button" data-action="search:add" data-target-status="finished" data-result-idx="${i}">Finished</button>`;
                const btnUpdateEdition = `<button class="btn primary" type="button" data-action="search:update_edition" data-item-id="${escapeHtml(
                  existingItemId
                )}" data-result-idx="${i}">Update edition</button>`;

                const preview = state.searchEditionPreview;
                const isPreviewRow = preview && preview.resultIdx === i && preview.existingItemId === existingItemId;
                let previewBlock = "";
                if (isPreviewRow) {
                  if (preview.status === "loading") {
                    previewBlock = `
                      <div class="inlinePrompt" data-kind="edition-preview" style="margin-top:10px;">
                        <div class="muted">Finding best edition…</div>
                        <div style="height:10px;"></div>
                        <button class="btn" type="button" data-action="search:cancel_edition">Cancel</button>
                      </div>
                    `;
                  } else if (preview.status === "error") {
                    previewBlock = `
                      <div class="inlinePrompt" data-kind="edition-preview" style="margin-top:10px;">
                        <div class="muted">Couldn’t load editions.</div>
                        ${
                          preview.error
                            ? `<div class="muted" style="margin-top:6px; font-size:12px;">${escapeHtml(preview.error)}</div>`
                            : ""
                        }
                        <div style="height:10px;"></div>
                        <button class="btn" type="button" data-action="search:cancel_edition">Close</button>
                      </div>
                    `;
                  } else if (preview.status === "preview" && preview.candidate) {
                    const c = preview.candidate;
                    const bits = [];
                    if (c.publisher) bits.push(escapeHtml(c.publisher));
                    if (c.first_publish_year) bits.push(escapeHtml(c.first_publish_year));
                    const l = Array.isArray(c.languages) && c.languages.length ? languageLabel(c.languages[0]) : "";
                    if (l) bits.push(escapeHtml(l));
                    if (c.isbn) bits.push(`ISBN ${escapeHtml(String(c.isbn).slice(0, 13))}`);
                    const line = bits.length ? bits.join(" • ") : "Edition details";
                    const img = c.cover_url
                      ? `<img src="${escapeHtml(c.cover_url)}" alt="" width="32" height="48" style="border-radius:8px; border:1px solid var(--stroke);" loading="lazy" />`
                      : `<div style="width:32px; height:48px; border-radius:8px; border:1px solid var(--stroke); background: rgba(255,255,255,0.4);"></div>`;
                    const authorLine = author || `<span class="muted">Unknown author</span>`;
                    previewBlock = `
                      <div class="inlinePrompt" data-kind="edition-preview" style="margin-top:10px;">
                        <div class="muted">Apply this edition to your existing book?</div>
                        <div class="row" style="align-items:center; gap:10px; margin-top:8px;">
                          ${img}
                          <div class="stack" style="gap:2px; flex:1;">
                            <div class="title">${title}</div>
                            <div class="sub">${authorLine}</div>
                            <div class="sub muted">${line}</div>
                          </div>
                        </div>
                        <div class="row" style="justify-content:flex-start; gap:10px; margin-top:10px; flex-wrap:wrap;">
                          <button class="btn primary" type="button" data-action="search:apply_edition">Apply</button>
                          <button class="btn" type="button" data-action="search:cancel_edition">Cancel</button>
                        </div>
                        <div class="muted" style="margin-top:8px;">Does not affect checkcheck ranking.</div>
                      </div>
                    `;
                  }
                }

	              return `
	                <li class="search-item" data-kind="search-result">
	                  <div class="row" style="align-items:center;">
	                    ${cover}
		                    <div class="stack" style="gap:2px; margin-left:10px; flex:1;">
		                      <div class="title">${title}</div>
		                      <div class="sub">${author || `<span class="muted">Unknown author</span>`}</div>
                          ${editionLine}
		                      ${suggested}
		                    </div>
		                    <div class="row" style="gap:8px; justify-content:flex-end; flex-wrap:wrap;">
		                      ${isExisting ? (canPromoteFinished ? btnPromoteFinished : btnOpen) : btnWant}
		                      ${isExisting ? btnUpdateEdition : btnFinished}
		                    </div>
		                  </div>
                      ${previewBlock}
		                </li>
		              `;
		            })
	            .join("")}
	        </ul>`
      : "";

  const errorHint =
    status === "error" && state.searchError
      ? `<div class="muted" style="margin-top:8px; font-size:12px;">${escapeHtml(state.searchError)}</div>`
      : "";

  return `
    <div style="height:12px;"></div>
    ${header}
    ${closeMatchesHint}
    <form class="row" style="gap:8px; margin-top:8px; flex-wrap:wrap;" data-action="search:openlibrary">
      <select class="input" name="lang" style="min-width: 180px;">
        <option value="en" ${langMode === "en" ? "selected" : ""}>English</option>
        <option value="es" ${langMode === "es" ? "selected" : ""}>Spanish</option>
        <option value="fr" ${langMode === "fr" ? "selected" : ""}>French</option>
        <option value="de" ${langMode === "de" ? "selected" : ""}>German</option>
        <option value="it" ${langMode === "it" ? "selected" : ""}>Italian</option>
        <option value="pt" ${langMode === "pt" ? "selected" : ""}>Portuguese</option>
        <option value="ja" ${langMode === "ja" ? "selected" : ""}>Japanese</option>
        <option value="ko" ${langMode === "ko" ? "selected" : ""}>Korean</option>
        <option value="zh" ${langMode === "zh" ? "selected" : ""}>Chinese</option>
        <option value="any" ${langMode === "any" ? "selected" : ""}>Any language</option>
      </select>
      <input class="input" name="q" placeholder="Search title or author" autocomplete="off" value="${q}" style="flex: 1; min-width: 220px;" />
      <button class="btn" type="submit" ${status === "loading" ? "disabled" : ""}>Search</button>
      <button class="btn" type="button" data-action="search:clear">Clear</button>
    </form>
    ${errorHint}
    ${results}
  `;
}

function renderCompare(state) {
  const { session } = state;
  const sessionComparisons = session ? state.comparisons.filter((c) => c.session_id === session.session_id) : [];
  const stepsDone =
    session?.mode === "after_finish" || session?.mode === "recheck"
      ? sessionComparisons.filter((c) => c.winner_item_id != null).length
      : sessionComparisons.length;
  const stepsTotal = session?.steps_total ?? 10;
  const stepsLeft = Math.max(0, stepsTotal - stepsDone);
  const isPending = !!state.comparePending;
  const pendingWinner = state.comparePending?.winner ?? null;
  const enter =
    state.compareEnterAt && Date.now() - state.compareEnterAt < 600 ? " enter" : "";

  if (!session) {
    return `
      <div class="card signalContainer" data-kind="miccheck-landing">
        <h2>Compare</h2>
        <div class="muted">Start a mic check from your Library.</div>
        <div style="height:12px;"></div>
        <button class="btn" data-action="nav:library">Back to Library</button>
      </div>
    `;
  }

  if (stepsLeft === 0 && session.mode === "after_finish") {
    return `
      <div class="card signalContainer" data-kind="placed">
        <div class="kicker">Placement</div>
        <h2>Placed.</h2>
        <div class="muted">Want to place another finished book?</div>
        <div style="height:12px;"></div>
        <div class="btns">
          <button class="btn primary" data-action="after_finish:back_to_finished">Back to Unplaced</button>
          <button class="btn" data-action="nav:library">Back to library</button>
        </div>
      </div>
    `;
  }

  if (stepsLeft === 0 && session.mode === "recheck") {
    return `
      <div class="card signalContainer" data-kind="rechecked">
        <div class="kicker">Re-check</div>
        <h2>Re-checked.</h2>
        <div class="muted">Your shelf updates from comparisons.</div>
        <div style="height:12px;"></div>
        <div class="btns">
          <button class="btn primary" data-action="recheck:back_to_detail">Back to book</button>
          <button class="btn" data-action="nav:library">Back to library</button>
        </div>
      </div>
    `;
  }

  if (stepsLeft === 0) {
    return `
      <div class="card signalContainer" data-kind="signal-found">
        <div class="kicker">Mic check</div>
        <h2>Signal found.</h2>
        <div class="muted">Your rankings are forming. Want to tighten the middle?</div>
        <div style="height:12px;"></div>
        <div class="btns">
          <button class="btn primary signalCTA" data-action="start:more" data-steps="5">Do 5 more</button>
          <button class="btn" data-action="nav:library">Back to library</button>
        </div>
      </div>
    `;
  }

  const pair = state.currentPair;
  if (!pair) {
    const title =
      session.mode === "after_finish" ? "Place this book" : session.mode === "recheck" ? "Re-check" : "Mic check";
    return `
      <div class="card">
        <h2>${title}</h2>
        <div class="muted">Add at least 5 finished books to compare.</div>
        <div style="height:12px;"></div>
        <button class="btn" data-action="nav:library">Back to library</button>
      </div>
    `;
  }

  const itemA = state.itemsById.get(pair.a);
  const itemB = state.itemsById.get(pair.b);

  const derivedA = state.derivedById.get(pair.a);
  const derivedB = state.derivedById.get(pair.b);

  const showStars = !(session.mode === "mic_check" && session.is_initial);
  const starsA = showStars ? renderStars(derivedA?.stars_display ?? null) : "";
  const starsB = showStars ? renderStars(derivedB?.stars_display ?? null) : "";

  const targetId = session.target_item_id ?? null;
  const isTargetA = !!targetId && pair.a === targetId;
  const isTargetB = !!targetId && pair.b === targetId;
  const targetBadgeA = isTargetA ? `<div class="targetPill" data-kind="compare-target">This book</div>` : "";
  const targetBadgeB = isTargetB ? `<div class="targetPill" data-kind="compare-target">This book</div>` : "";

  const cardClassA =
    "compareCard" +
    (isTargetA ? " isTarget" : "") +
    (isPending && pendingWinner === "a" ? " isChosen" : "") +
    (isPending && pendingWinner && pendingWinner !== "a" ? " isDimmed" : "") +
    (isPending && !pendingWinner ? " isDimmed" : "");
  const cardClassB =
    "compareCard" +
    (isTargetB ? " isTarget" : "") +
    (isPending && pendingWinner === "b" ? " isChosen" : "") +
    (isPending && pendingWinner && pendingWinner !== "b" ? " isDimmed" : "") +
    (isPending && !pendingWinner ? " isDimmed" : "");

  const kicker = session.mode === "after_finish" ? "Placement" : session.mode === "recheck" ? "Re-check" : "Mic check";

  return `
		    <div class="card">
		      <div class="row">
	        <div class="stack" style="gap:4px;">
	          <div class="kicker">${kicker}</div>
	          <div class="muted">Which did you like more?</div>
	        </div>
	        <div class="chip">${stepsDone + 1} / ${stepsTotal}</div>
	      </div>
      <div style="height:12px;"></div>
	        <div class="compareCards${enter}">
	          <div class="${cardClassA}" data-action="compare:win" data-winner="a" role="button" aria-label="Choose A${
              isTargetA ? " (this book)" : ""
            }">
              ${targetBadgeA}
	            <div class="title">${itemTitle(itemA)}</div>
	            ${itemAuthor(itemA) ? `<div class="authorLine">${itemAuthor(itemA)}</div>` : ""}
	            <div class="sub">Relative to your library.</div>
	          ${starsA ? `<div style="height:10px;"></div>${starsA}` : ""}
	          </div>
	          <div class="${cardClassB}" data-action="compare:win" data-winner="b" role="button" aria-label="Choose B${
              isTargetB ? " (this book)" : ""
            }">
              ${targetBadgeB}
	            <div class="title">${itemTitle(itemB)}</div>
	            ${itemAuthor(itemB) ? `<div class="authorLine">${itemAuthor(itemB)}</div>` : ""}
	            <div class="sub">Relative to your library.</div>
	          ${starsB ? `<div style="height:10px;"></div>${starsB}` : ""}
	          </div>
	        </div>
	      <div style="height:12px;"></div>
	      <div class="compareActions">
	        <div class="row compareSecondary" style="justify-content:flex-start; flex-wrap:wrap;">
	          <button class="btn small" data-action="compare:win" data-winner="a" ${isPending ? "disabled" : ""}>A wins</button>
	          <button class="btn small" data-action="compare:win" data-winner="b" ${isPending ? "disabled" : ""}>B wins</button>
	        </div>
	        <div style="height:10px;"></div>
	        <div class="row" style="justify-content:flex-start; flex-wrap:wrap;">
	          <button class="btn" data-action="compare:skip" ${isPending ? "disabled" : ""}>Skip</button>
	          <button class="btn danger" data-action="compare:undo" ${isPending ? "disabled" : ""}>Undo</button>
	        </div>
	      </div>
    </div>
  `;
}

function renderDetail(state) {
  const itemId = state.detailItemId;
  const item = itemId ? state.itemsById.get(itemId) : null;
  const entry = itemId ? state.libraryByItemId.get(itemId) : null;
  if (!item || !entry) return "";

  const derived = state.derivedById.get(itemId);
  const isFinished = entry.status === "finished";
	  const isArchived = !!entry.archived_at;
	  const isActiveFinished = isFinished && !isArchived;
	  const isRated = !!derived && derived.stars_display != null;
	  const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;

	  const stars = isRated ? renderStars(derived.stars_display, { sizePx: 16 }) : "";
	  const rank = isRated ? state.rankById.get(itemId) : null;
	  const scoredCount = state.scoredIds?.length ?? 0;

  const stacked = isArchived
    ? "Archived."
    : isRated
    ? `Rank #${rank} of ${scoredCount} · ${formatTopPct(derived.percentile)}`
    : isActiveFinished
      ? "Not rated yet."
      : "Finish a book to rate it.";

  const rankScoreLine =
    isRated && derived
      ? `<div class="rankScore ${toneFromPercentile(derived.percentile)}">${escapeHtml(
          derived.rank_score_raw.toFixed(2)
        )} / 5.00</div>`
      : "";

  const cover = item.cover_url
    ? `<img src="${escapeHtml(item.cover_url)}" alt="" width="40" height="60" style="border-radius:10px; border:1px solid var(--stroke);" loading="lazy" />`
    : "";

  const TYPE_OPTIONS = ["Fiction", "Short Stories", "Nonfiction", "Essay", "Memoir", "Poetry"];
  const showSuggested = !isArchived && !entry.type_confirmed && entry.type_decision == null && entry.type_suggested;
  const typeSuggestedRow = showSuggested
    ? `<div class="sub">Suggested: ${escapeHtml(entry.type_suggested)}</div>`
    : "";
  const selectedType = entry.type_confirmed || "";
  const typeSelectDisabled = isArchived ? "disabled" : "";
  const clearDisabled = isArchived ? "disabled" : "";
  const useSuggestedBtn =
    showSuggested && entry.type_suggested
      ? `<button class="btn" type="button" data-action="type:useSuggested" ${isArchived ? "disabled" : ""}>Use suggested</button>`
      : "";

  const typeSection = `
    <div data-kind="detail-type">
      <div class="title">Type</div>
      ${typeSuggestedRow}
      <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:8px;">
        <select class="input" data-action="type:select" ${typeSelectDisabled} style="min-width: 200px;">
          <option value="" ${selectedType ? "" : "selected"} disabled>Set type…</option>
          ${TYPE_OPTIONS.map((t) => `<option value="${escapeHtml(t)}" ${selectedType === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
        </select>
        ${useSuggestedBtn}
        <button class="btn" type="button" data-action="type:clear" ${clearDisabled}>Clear</button>
      </div>
    </div>
  `;

  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const tagsSection = `
    <div style="height:12px;"></div>
    <div data-kind="detail-tags">
      <div class="title">Tags</div>
      <div class="sub">Add tags to remember why you saved this</div>
      <form class="row" style="gap:8px; flex-wrap:wrap; margin-top:8px;" data-action="tag:add">
        <input class="input" name="tag" placeholder="Add tag" autocomplete="off" ${isArchived ? "disabled" : ""} style="min-width: 220px; flex: 1;" />
        <button class="btn" type="submit" ${isArchived ? "disabled" : ""}>Add</button>
      </form>
      ${
        tags.length
          ? `<div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
              ${tags
                .map((t, i) => `<button class="chip" type="button" data-action="tag:remove" data-tag-idx="${i}" ${isArchived ? "disabled" : ""}>${escapeHtml(t)} ×</button>`)
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;

  const canUpdateMeta = !isArchived;
  const metaStatus = state.detailOpenLibraryStatus || "idle";
  const cand = state.detailOpenLibraryCandidate;
  const cands = Array.isArray(state.detailOpenLibraryCandidates) ? state.detailOpenLibraryCandidates : [];
  const languageCode = typeof state.searchLanguage === "string" ? state.searchLanguage : "en";
  const languageLabel =
    {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      any: "Any language"
    }[languageCode] ?? "English";

  function languageLabel3(code3) {
    const c = String(code3 || "").trim().toLowerCase();
    return (
      {
        eng: "English",
        spa: "Spanish",
        fre: "French",
        fra: "French",
        ger: "German",
        deu: "German",
        ita: "Italian",
        por: "Portuguese",
        jpn: "Japanese",
        kor: "Korean",
        chi: "Chinese",
        zho: "Chinese"
      }[c] ?? (c ? c.toUpperCase() : "")
    );
  }

  const editionBits = [];
  if (item.publisher) editionBits.push(escapeHtml(item.publisher));
  if (item.first_publish_year) editionBits.push(escapeHtml(item.first_publish_year));
  const itemLang = languageLabel3(item.language);
  if (itemLang) editionBits.push(escapeHtml(itemLang));
  if (item.isbn) editionBits.push(`ISBN ${escapeHtml(String(item.isbn).slice(0, 13))}`);
  const editionInfo = editionBits.length
    ? `<div class="sub muted" style="margin-top:4px;">Edition: ${editionBits.join(" • ")}</div>`
    : "";
  const metaBtnLabel =
    metaStatus === "loading" ? "Updating…" : metaStatus === "preview" ? "Update metadata (Open Library)" : "Update metadata (Open Library)";
  const metaBtnDisabled = !canUpdateMeta || metaStatus === "loading";
  const metaCandidatePick =
    metaStatus === "pick" && cands.length
      ? `
        <div class="inlinePrompt" data-kind="openlibrary-pick" style="margin-top:12px;">
          <div class="muted">Pick a close match</div>
          <div class="muted" style="margin-top:6px; font-size:12px;">We couldn’t pick a single best match with high confidence.</div>
          <div style="height:10px;"></div>
          <div class="stack" style="gap:8px;">
            ${cands
              .map((r, i) => {
                const title = escapeHtml(r.title || "");
                const author = escapeHtml(r.author || "");
                const img = r.cover_url
                  ? `<img src="${escapeHtml(r.cover_url)}" alt="" width="32" height="48" style="border-radius:8px; border:1px solid var(--stroke);" loading="lazy" />`
                  : `<div style="width:32px; height:48px; border-radius:8px; border:1px solid var(--stroke); background: rgba(255,255,255,0.4);"></div>`;
                const bits = [];
                if (r.publisher) bits.push(escapeHtml(r.publisher));
                if (r.first_publish_year) bits.push(escapeHtml(r.first_publish_year));
                const l = languageLabel3(r.language);
                if (l) bits.push(escapeHtml(l));
                if (r.isbn) bits.push(`ISBN ${escapeHtml(String(r.isbn).slice(0, 13))}`);
                const line = bits.length ? bits.join(" • ") : "";
                return `
                  <div class="row" style="align-items:center; gap:10px;">
                    ${img}
                    <div class="stack" style="gap:2px; flex:1;">
                      <div class="title">${title}</div>
                      <div class="sub">${author || `<span class="muted">Unknown author</span>`}</div>
                      ${line ? `<div class="sub muted">${line}</div>` : ""}
                    </div>
                    <button class="btn primary" type="button" data-action="meta:pick_openlibrary" data-cand-idx="${i}">Preview</button>
                  </div>
                `;
              })
              .join("")}
          </div>
          <div style="height:10px;"></div>
          <button class="btn" type="button" data-action="meta:cancel_openlibrary">Cancel</button>
        </div>
      `
      : "";
  const metaCandidatePreview =
    metaStatus === "preview" && cand
      ? `
        <div class="inlinePrompt" data-kind="openlibrary-preview" style="margin-top:12px;">
          <div class="muted">Preview</div>
          <div class="row" style="align-items:center; gap:10px; margin-top:8px;">
            ${
              cand.cover_url
                ? `<img src="${escapeHtml(cand.cover_url)}" alt="" width="32" height="48" style="border-radius:8px; border:1px solid var(--stroke);" loading="lazy" />`
                : `<div style="width:32px; height:48px; border-radius:8px; border:1px solid var(--stroke); background: rgba(255,255,255,0.4);"></div>`
            }
            <div class="stack" style="gap:2px; flex:1;">
              <div class="title">${escapeHtml(cand.title || "")}</div>
              <div class="sub">${escapeHtml(cand.author || "")}${
                cand.first_publish_year ? ` · <span class="muted">${escapeHtml(cand.first_publish_year)}</span>` : ""
              }</div>
            </div>
          </div>
          <div class="row" style="justify-content:flex-start; gap:10px; margin-top:10px; flex-wrap:wrap;">
            <button class="btn primary" type="button" data-action="meta:apply_openlibrary">Apply</button>
            <button class="btn" type="button" data-action="meta:cancel_openlibrary">Cancel</button>
          </div>
          <div class="muted" style="margin-top:8px;">Does not affect checkcheck ranking.</div>
        </div>
      `
      : "";

  const metaSection = `
    <div style="height:12px;"></div>
    <div data-kind="detail-meta">
      <div class="title">Metadata</div>
      <div class="sub">Covers are for recognition only · Language: ${escapeHtml(languageLabel)}</div>
      ${editionInfo}
      <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:8px; align-items:center;">
        <select class="input" data-action="lang:set" style="min-width: 180px;">
          <option value="en" ${languageCode === "en" ? "selected" : ""}>English</option>
          <option value="es" ${languageCode === "es" ? "selected" : ""}>Spanish</option>
          <option value="fr" ${languageCode === "fr" ? "selected" : ""}>French</option>
          <option value="de" ${languageCode === "de" ? "selected" : ""}>German</option>
          <option value="it" ${languageCode === "it" ? "selected" : ""}>Italian</option>
          <option value="pt" ${languageCode === "pt" ? "selected" : ""}>Portuguese</option>
          <option value="ja" ${languageCode === "ja" ? "selected" : ""}>Japanese</option>
          <option value="ko" ${languageCode === "ko" ? "selected" : ""}>Korean</option>
          <option value="zh" ${languageCode === "zh" ? "selected" : ""}>Chinese</option>
          <option value="any" ${languageCode === "any" ? "selected" : ""}>Any language</option>
        </select>
        <button class="btn" type="button" data-action="meta:update_openlibrary" ${metaBtnDisabled ? "disabled" : ""}>${escapeHtml(
          metaBtnLabel
        )}</button>
      </div>
      ${metaCandidatePick}
      ${metaCandidatePreview}
    </div>
  `;

  return `
    <div class="card">
      <div class="row">
        <div class="row" style="align-items:center; gap:12px;">
          ${cover}
          <div class="stack" style="gap:4px;">
            <div class="kicker">Detail</div>
            <h2 style="margin:0;">${itemTitle(item)}</h2>
            ${itemAuthor(item) ? `<div class="authorLine">${itemAuthor(item)}</div>` : ""}
            <div class="muted">Relative to your library.</div>
          </div>
        </div>
        <button class="btn" data-action="nav:library">Back</button>
      </div>
	      <div style="height:12px;"></div>
	      ${
	        stars
	          ? `<div class="stack" style="gap:6px;">
	              ${stars}
	              ${rankScoreLine}
	              <div class="chip">${escapeHtml(stacked)}</div>
	            </div>`
	          : `<div class="chip">${escapeHtml(stacked)}</div>`
	      }
      ${
        isFinished && !isRated
          ? `<div style="height:10px;"></div><div class="chip">Not rated • Based on ${derived?.comparisons_count ?? 0} comparisons</div>`
          : ""
      }
      <div style="height:12px;"></div>
      <div class="row" style="flex-wrap:wrap;">
        ${isArchived ? `<span class="chip">Archived</span>` : ""}
        <div class="row" style="gap:8px;">
          <button class="btn" data-action="status:set" data-status="want" ${
            isArchived || entry.status === "want" ? "disabled" : ""
          }>Want</button>
          <button class="btn" data-action="status:set" data-status="finished" ${
            isArchived || entry.status === "finished" ? "disabled" : ""
          }>Finished</button>
        </div>
      </div>
      <div style="height:12px;"></div>
      ${typeSection}
      ${tagsSection}
      ${metaSection}
      <div style="height:12px;"></div>
      <div class="btns">
        ${
          isArchived
            ? `<button class="btn primary" data-action="item:restore">Restore</button>`
            : `<button class="btn danger" data-action="item:archive">Remove from library</button>`
	        }
	        <button class="btn primary" data-action="start:focus" data-item-id="${escapeHtml(itemId)}" ${
	          isActiveFinished && decidedComparisonsCount > 0 ? "" : "disabled"
	        }>${isRated ? "Re-check" : "Check"}</button>
	      </div>
	    </div>
	  `;
}
