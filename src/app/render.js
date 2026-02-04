import { formatStars, formatTopPct } from "./ui_format.js";

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function itemLine(item) {
  const title = escapeHtml(item?.title ?? "");
  const author = escapeHtml(item?.author ?? "");
  return author ? `${title} <span class="muted">·</span> <span class="muted">${author}</span>` : title;
}

function statusChip(status) {
  if (status === "finished") return `<span class="chip">Finished</span>`;
  if (status === "reading") return `<span class="chip">Reading</span>`;
  return `<span class="chip">Want</span>`;
}

function statusChipButton(itemId, status) {
  const next = status === "finished" ? "want" : "finished";
  const label = status === "finished" ? "Finished" : status === "reading" ? "Reading" : "Want";
  return `
    <button
      class="chip"
      data-action="quick:status"
      data-item-id="${escapeHtml(itemId)}"
      data-next-status="${escapeHtml(next)}"
      aria-label="Set status"
      type="button"
    >${label}</button>
  `;
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
  const canCompare = state.finishedIds.length >= 2;
  const empty = state.items.length === 0;
  const addLabel = empty ? "Add your first book" : "Add book";

  const listItems = state.libraryRows
    .map((row) => {
      const { item, entry, derived, rank } = row;
      const isFinished = entry.status === "finished";
      const isRated = !!derived && derived.stars_display != null;
      const stars = isRated ? formatStars(derived.stars_display) : "";
      const scoredCount = state.scoredIds?.length ?? 0;
      const sub = isFinished
        ? isRated
          ? `${derived.rank_score_raw.toFixed(2)} / 5.00 · Rank #${rank} of ${scoredCount} · ${formatTopPct(derived.percentile)} · Based on ${derived.comparisons_count} comparisons`
          : "Not rated yet — do a mic check."
        : "Add a few finished books, then we’ll do a quick mic check to rank them.";
      return `
        <li class="list-item" data-action="open:detail" data-item-id="${escapeHtml(item.id)}">
          <div class="row">
            <div class="stack" style="gap:4px;">
              <div class="title">${itemLine(item)}</div>
              <div class="sub">${escapeHtml(sub)}</div>
            </div>
            <div class="stack" style="align-items:flex-end; gap:8px;">
              ${stars ? `<div class="stars">${stars}</div>` : ""}
              ${statusChipButton(item.id, entry.status)}
              ${isFinished && !isRated ? `<span class="chip">Not rated</span>` : ""}
            </div>
          </div>
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
          <button class="btn primary" type="submit">${addLabel}</button>
        </form>
        <div style="height:12px;"></div>
        <div class="row">
          <button class="btn primary" data-action="start:miccheck" ${canCompare ? "" : "disabled"}>
            Start mic check
          </button>
          <div class="muted" style="font-size:13px;">
            ${canCompare ? "Ratings are relative to your library." : "Add at least 2 finished books to start a mic check."}
          </div>
        </div>
      </div>
      <div class="card">
        <h2>Your shelf</h2>
        ${
          state.items.length === 0
            ? `<div class="muted">Add your first book to begin.</div>`
            : `<ul class="list">${listItems}</ul>`
        }
      </div>
    </div>
  `;
}

function renderCompare(state) {
  const { session } = state;
  const stepsDone = session ? state.comparisons.filter((c) => c.session_id === session.session_id).length : 0;
  const stepsTotal = session?.steps_total ?? 10;
  const stepsLeft = Math.max(0, stepsTotal - stepsDone);

  if (!session) {
    const canStart = state.finishedIds.length >= 2;
    return `
      <div class="card">
        <h2>Mic check</h2>
        <div class="muted">${canStart ? "Ten quick picks. Your shelf will snap into place." : "Add at least 2 finished books to begin."}</div>
        <div style="height:12px;"></div>
        <button class="btn primary" data-action="start:miccheck" ${canStart ? "" : "disabled"}>Start mic check</button>
      </div>
    `;
  }

  if (stepsLeft === 0) {
    return `
      <div class="card">
        <div class="kicker">Mic check</div>
        <h2>Signal found.</h2>
        <div class="muted">Your rankings are forming. Want to tighten the middle?</div>
        <div style="height:12px;"></div>
        <div class="btns">
          <button class="btn primary" data-action="start:more" data-steps="5">Do 5 more</button>
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
        <div class="muted">Add at least 2 finished books to compare.</div>
        <div style="height:12px;"></div>
        <button class="btn" data-action="nav:library">Back to library</button>
      </div>
    `;
  }

  const itemA = state.itemsById.get(pair.a);
  const itemB = state.itemsById.get(pair.b);

  const derivedA = state.derivedById.get(pair.a);
  const derivedB = state.derivedById.get(pair.b);

  const starsA = derivedA ? formatStars(derivedA.stars_display) : "";
  const starsB = derivedB ? formatStars(derivedB.stars_display) : "";

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
      <div class="compareCards">
        <div class="compareCard">
          <div class="title">${itemLine(itemA)}</div>
          <div class="sub">Relative to your library.</div>
          ${starsA ? `<div style="height:10px;"></div><div class="stars">${starsA}</div>` : ""}
        </div>
        <div class="compareCard">
          <div class="title">${itemLine(itemB)}</div>
          <div class="sub">Relative to your library.</div>
          ${starsB ? `<div style="height:10px;"></div><div class="stars">${starsB}</div>` : ""}
        </div>
      </div>
      <div style="height:12px;"></div>
      <div class="btns">
        <button class="btn primary" data-action="compare:win" data-winner="a">A wins</button>
        <button class="btn primary" data-action="compare:win" data-winner="b">B wins</button>
        <button class="btn" data-action="compare:skip">Skip</button>
        <button class="btn danger" data-action="compare:undo">Undo</button>
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
  const isRated = !!derived && derived.stars_display != null;

  const stars = isRated ? formatStars(derived.stars_display) : "";
  const rank = isRated ? state.rankById.get(itemId) : null;
  const scoredCount = state.scoredIds?.length ?? 0;

  const stacked = isRated
    ? `${derived.rank_score_raw.toFixed(2)} / 5.00 · Rank #${rank} of ${scoredCount} · ${formatTopPct(derived.percentile)}`
    : isFinished
      ? "Not rated yet."
      : "Finish a book to rate it.";

  return `
    <div class="card">
      <div class="row">
        <div class="stack" style="gap:4px;">
          <div class="kicker">Detail</div>
          <h2 style="margin:0;">${itemLine(item)}</h2>
          <div class="muted">Relative to your library.</div>
        </div>
        <button class="btn" data-action="nav:library">Back</button>
      </div>
      <div style="height:12px;"></div>
      ${
        stars
          ? `<div class="row">
              <div class="stars" style="font-size:16px;">${stars}</div>
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
        ${statusChip(entry.status)}
        <div class="row" style="gap:8px;">
          <button class="btn" data-action="status:set" data-status="want">Want</button>
          <button class="btn" data-action="status:set" data-status="finished">Finished</button>
        </div>
      </div>
      <div style="height:12px;"></div>
      <div class="btns">
        <button class="btn primary" data-action="start:focus" data-item-id="${escapeHtml(itemId)}" ${
          isFinished && state.finishedIds.length >= 2 ? "" : "disabled"
        }>Do 3 more comparisons</button>
        <button class="btn" data-action="nav:compare">Mic check</button>
      </div>
    </div>
  `;
}
