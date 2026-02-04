# Book Search MVP (Open Library, Local-First)

Last updated: 2026-02-04

## Goal
- Add an optional “Search & add” flow (Open Library) that stays inside the Library surface.
- Preserve the invariant: only explicitly added items exist in the library and participate in scoring.
- Keep the app usable offline: manual add always works; search may fail gracefully.

## Non-goals (MVP)
- No Wikidata enrichment.
- No server, no auth, no sync.
- No perfect dedupe or edition modeling.
- No persistence of search queries/results.

## Feature Flag
- Default OFF.
- Enable via query param `?search=1`.
- The presence of the search panel must not change behavior when the flag is off.

## UI Shape (Repo-Native)
- Library surface includes a second form: `data-action="search:openlibrary"`.
- Search results render below the search form with per-result “Add” buttons: `data-action="search:add"`.
- Clear button: `data-action="search:clear"`.

## DOM Discriminators (Avoid Selector Ambiguity)
- Library rows must be `data-kind="library-item"` and continue using `.list-item`.
- Search results must be `data-kind="search-result"` and must not use `.list-item`.
- Search results must never include `data-action="open:detail"` (guardrail).

## Data Model (Local-First)
- Truth stores remain:
- `items`
- `library_entries`
- `comparisons`
- Derived/UI cache remains:
- `ui_state`

## Item Fields (Backward-Compatible Extension)
- `idb.addItem({ title, author })` must continue to work unchanged.
- `idb.addItem` may accept additional optional fields for search-added items and store them on the `items` record:
- `source: { provider: "openlibrary", key: string|null }`
- `isbn: string|null`
- `cover_url: string|null`
- `first_publish_year: number|null`

## Dedupe Policy (Soft, MVP)
- Prefer Open Library identity when present:
- If `source.provider === "openlibrary"` and `source.key` matches an existing item, do not add a duplicate; show a toast “Already in your library.”
- Fallback heuristic (only if no `source.key`): normalized `title|author` check.
- Never merge or rewrite existing items automatically.

## Open Library Adapter
- Implement as a small client module (no framework dependencies).
- Request with `fields` + `limit` to keep responses small.
- Normalize to a stable internal result shape (title/author/year/cover).
- Failure modes:
- Network error or non-2xx response sets `searchStatus="error"` and displays a short message; manual add remains functional.

## Copy Constraints
- Do not imply sync (“We’ll sync when you’re back”) in search error/offline states.
- Use the existing toast pattern for “Search failed.” and “Added.” messaging.

## E2E Tests (Playwright)
- Do not hit real Open Library in CI; mock `fetch` with Playwright routing.
- With current Playwright config (`baseURL` includes `/public`), use `page.goto("/?search=1")` to enable the panel.
- Add one spec covering:
- Search panel appears only when flag is on.
- Search request is made; results render under `data-kind="search-result"`.
- Clicking “Add” creates a library row under `data-kind="library-item"`.
- Export JSON contains optional fields on the added item; wipe; import restores those fields.

## Definition of Done
- With `?search=1`, user can:
- Search Open Library and see results.
- Add a result and see it in the library immediately.
- Refresh: item persists (IndexedDB).
- Export/import round-trip preserves optional item fields (`source`, `isbn`, `cover_url`, `first_publish_year`).
- Without `?search=1`:
- Search UI is absent.
- Manual add, mic check, scoring, export/import continue working unchanged.

## Risks / Contingencies
- Open Library CORS or availability issues: search is best-effort; degrade gracefully. If persistent, defer search until a server proxy exists.
- Dedupe ambiguity (work vs edition): intentionally deferred; soft checks only.

