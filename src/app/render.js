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
  const navCompareCurrent = surface === "compare" ? ' aria-current="page"' : "";

  return `
    <div class="topbar">
      <div class="brand">
        <h1>checkcheck</h1>
        <div class="tagline">Mic-check your taste.</div>
      </div>
      <div class="nav">
        <button class="pill" data-action="nav:library"${navLibraryCurrent}>Library</button>
        <button class="pill" data-action="nav:compare"${navCompareCurrent}>Mic check</button>
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
        <button class="link" data-action="import:open">Import JSON</button>
        <button class="link" data-action="dev:resetDerived">Reset display</button>
        <button class="link" data-action="dev:wipeAll">Clear local data</button>
      </div>
    </div>
  `;
}

function renderLibrary(state) {
  const empty = state.items.length === 0;
  const addLabel = empty ? "Add your first book" : "Add book";
  const searchPanel = renderSearchPanel(state);
  const archivedCount = state.archivedIds?.length ?? 0;
  const decidedComparisonsCount = state.comparisons.filter((c) => c.winner_item_id != null).length;
  const showInitiationBanner = state.libraryView === "finished" && state.finishedIds.length >= 5 && decidedComparisonsCount === 0;
  const initiationBanner = showInitiationBanner
    ? `
        <div class="banner" data-kind="initiation-miccheck">
          <div class="title">Ready for a mic check?</div>
          <div class="sub">Ten quick picks. Your shelf will snap into place.</div>
          <div style="height:10px;"></div>
          <button class="btn primary" type="button" data-action="start:miccheck">Start mic check</button>
        </div>
        <div style="height:12px;"></div>
      `
    : "";

  const listRows = state.libraryRows.filter((row) => {
    if (row.entry.archived_at) return true;
    if (state.libraryView === "finished") return row.entry.status === "finished";
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
	        state.libraryView === "finished" && isFinishedActive && !isRated
	          ? `<span class="chip">Not rated</span>`
	          : stars
	            ? `${stars}${rankScore}`
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
            ? `Rank #${rank} of ${scoredCount} · ${formatTopPct(derived.percentile)} · Based on ${derived.comparisons_count} comparisons`
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
                <button class="btn primary" type="button" data-action="start:focus" data-item-id="${escapeHtml(item.id)}">Do 3 more comparisons</button>
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
	        <h2>Library</h2>
	        ${
	          empty
	            ? `<div class="muted" style="margin-bottom:12px;">Mic check your taste. Add a few books you’ve read. Then we’ll do a quick mic check to rank them.</div>`
	            : ""
	        }
	        <form class="stack" data-action="add:item">
	          <input class="input" name="title" placeholder="Title" autocomplete="off" required />
	          <input class="input" name="author" placeholder="Author (optional)" autocomplete="off" />
	          <label class="row" style="justify-content:flex-start; gap:8px; color:var(--muted); font-size:13px;">
	            <input type="checkbox" name="already_finished" />
	            Already finished
	          </label>
	          <button class="btn primary" type="submit">${addLabel}</button>
	        </form>
	        ${searchPanel}
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
	          <button class="pill" data-action="library:view" data-view="finished"${
	            state.libraryView === "finished" ? ' aria-current="page"' : ""
	          }>Finished</button>
	        </div>
	        ${initiationBanner}
	        ${
	          state.items.length === 0
	            ? `<div class="muted">Add your first book to begin.</div>`
	            : listRows.length === 0
	              ? `<div class="muted">${
	                  state.libraryView === "finished" ? "No finished books yet." : "No want-to-read books yet."
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
  const langMode = state.searchLangMode === "any" ? "any" : "prefer_en";

  const header =
    status === "loading"
      ? `<div class="muted">Searching…</div>`
      : status === "done" && state.searchResults.length === 0
        ? `<div class="muted">No results.</div>`
        : status === "error"
          ? `<div class="muted">Search error.</div>`
          : `<div class="muted">Search Open Library</div>`;

  const results =
    state.searchResults?.length
      ? `<ul class="list" style="margin-top:10px;">
          ${state.searchResults
	            .map((r, i) => {
	              const title = escapeHtml(r.title || "");
	              const author = escapeHtml(r.author || "");
	              const suggested = r.type_suggested
	                ? `<div class="sub">Suggested: ${escapeHtml(r.type_suggested)}</div>`
	                : "";
	              const year = r.first_publish_year
	                ? ` · <span class="muted">${escapeHtml(r.first_publish_year)}</span>`
	                : "";
	              const cover = r.cover_url
	                ? `<img src="${escapeHtml(r.cover_url)}" alt="" width="32" height="48" style="border-radius:8px; border:1px solid var(--stroke);" loading="lazy" />`
	                : `<div style="width:32px; height:48px; border-radius:8px; border:1px solid var(--stroke); background: rgba(255,255,255,0.4);"></div>`;

              return `
                <li class="search-item" data-kind="search-result">
                  <div class="row" style="align-items:center;">
                    ${cover}
	                    <div class="stack" style="gap:2px; margin-left:10px; flex:1;">
	                      <div class="title">${title}</div>
	                      <div class="sub">${author || `<span class="muted">Unknown author</span>`}${year}</div>
	                      ${suggested}
	                    </div>
	                    <button class="btn" type="button" data-action="search:add" data-result-idx="${i}">Add</button>
	                  </div>
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
    <form class="row" style="gap:8px; margin-top:8px; flex-wrap:wrap;" data-action="search:openlibrary">
      <select class="input" name="lang_mode" style="min-width: 160px;">
        <option value="prefer_en" ${langMode === "prefer_en" ? "selected" : ""}>Prefer English</option>
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
  const stepsDone = session ? state.comparisons.filter((c) => c.session_id === session.session_id).length : 0;
  const stepsTotal = session?.steps_total ?? 10;
  const stepsLeft = Math.max(0, stepsTotal - stepsDone);
  const isPending = !!state.comparePending;
  const pendingWinner = state.comparePending?.winner ?? null;
  const enter =
    state.compareEnterAt && Date.now() - state.compareEnterAt < 600 ? " enter" : "";

  if (!session) {
    const canStart = state.finishedIds.length >= 5;
    return `
      <div class="card signalContainer" data-kind="miccheck-landing">
        <h2>Mic check</h2>
        <div class="muted">${canStart ? "Ten quick picks. Your shelf will snap into place." : "Add at least 5 finished books to begin."}</div>
        <div style="height:12px;"></div>
        <button class="btn primary signalCTA" data-action="start:miccheck" ${canStart ? "" : "disabled"}>Start mic check</button>
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
    return `
      <div class="card">
        <h2>Mic check</h2>
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

  const cardClassA =
    "compareCard" +
    (isPending && pendingWinner === "a" ? " isChosen" : "") +
    (isPending && pendingWinner && pendingWinner !== "a" ? " isDimmed" : "") +
    (isPending && !pendingWinner ? " isDimmed" : "");
  const cardClassB =
    "compareCard" +
    (isPending && pendingWinner === "b" ? " isChosen" : "") +
    (isPending && pendingWinner && pendingWinner !== "b" ? " isDimmed" : "") +
    (isPending && !pendingWinner ? " isDimmed" : "");

  return `
	    <div class="card">
	      <div class="row">
        <div class="stack" style="gap:4px;">
          <div class="kicker">Mic check</div>
          <div class="muted">Which did you like more?</div>
        </div>
        <div class="chip">${stepsDone + 1} / ${stepsTotal}</div>
      </div>
      <div style="height:12px;"></div>
	        <div class="compareCards${enter}">
	          <div class="${cardClassA}" data-action="compare:win" data-winner="a" role="button" aria-label="Choose A">
	            <div class="title">${itemTitle(itemA)}</div>
	            ${itemAuthor(itemA) ? `<div class="authorLine">${itemAuthor(itemA)}</div>` : ""}
	            <div class="sub">Relative to your library.</div>
	          ${starsA ? `<div style="height:10px;"></div>${starsA}` : ""}
	          </div>
	          <div class="${cardClassB}" data-action="compare:win" data-winner="b" role="button" aria-label="Choose B">
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
      <div style="height:12px;"></div>
      <div class="btns">
        ${
          isArchived
            ? `<button class="btn primary" data-action="item:restore">Restore</button>`
            : `<button class="btn danger" data-action="item:archive">Remove from library</button>`
	        }
	        <button class="btn primary" data-action="start:focus" data-item-id="${escapeHtml(itemId)}" ${
	          isActiveFinished && decidedComparisonsCount > 0 ? "" : "disabled"
	        }>Do 3 more comparisons</button>
	        <button class="btn" data-action="nav:compare">Mic check</button>
	      </div>
	    </div>
	  `;
}
