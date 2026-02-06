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
- Default ON.
- Hide via query param `?search=0` (or `?search=false` / `?search=off`).
- Search remains best-effort; manual add always works.

## UI Shape (Repo-Native)
- Library surface includes a second form: `data-action="search:openlibrary"`.
- Search results render below the search form with per-result Want/Finished buttons: `data-action="search:add"` + `data-target-status="want|finished"`.
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
- `publisher: string|null` (best-effort; edition hint only)
- `language: string|null` (best-effort; e.g. "eng")
- `raw_subjects: string[]` (preserved for Phase 1 type suggestion; never surfaced directly)
- `openlibrary: { work_key: string|null, edition_key: string|null, updated_at: string|null }` (provenance only; never affects scoring)

### Identity note (Phase 1)
- **One item per work** (the user’s “book” is the work they read).
- Edition/translation is treated as **context metadata** (shown only in Detail + Search results; never affects scoring).

## Want enrichment (Phase 1)
Search-derived metadata may optionally power a **suggested type** (non-authoritative) and user tags.

- Suggested type is stored on `library_entries.type_suggested` as a **single** string (or null).
- Raw Open Library subjects are preserved on `items.raw_subjects` for future taxonomy expansion.
- See `docs/WANT_METADATA_PHASE1.md` for mapping rules, copy guardrails, and cover surface rules.

## Dedupe Policy (Soft, MVP)
Goal: prevent duplicates while still letting users correct edition/translation metadata.

- **Work match (block add):**
  - If the search result matches an existing work (Open Library `work_key`, or a normalized `title|author` fallback), do **not** add a second item.
  - Instead, search results should offer:
    - **Open** (go to Detail)
    - **Update edition** (preview → apply edition metadata to the existing item)
- **Exact duplicate (block):**
  - If `openlibrary.edition_key` is already applied, or ISBN matches, treat as already applied and no-op (toast OK).

Never merge or rewrite items automatically without explicit user action (“Update edition”).

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
- With current Playwright config (`baseURL` includes `/public`), you can use `page.goto("/")` (panel shown by default).
- Add one spec covering:
- Search panel appears when flag is on (default) and is absent when `?search=0`.
- Search request is made; results render under `data-kind="search-result"`.
- Clicking Want/Finished creates a library row under `data-kind="library-item"`.
- Export JSON contains optional fields on the added item; wipe; import restores those fields.

## Definition of Done
- With search enabled (default), user can:
- Search Open Library and see results.
- Add a result and see it in the library immediately.
- If a result matches an existing work, user can update edition metadata via a preview-and-apply flow (no duplicates).
- Refresh: item persists (IndexedDB).
- Export/import round-trip preserves optional item fields (`source`, `isbn`, `cover_url`, `first_publish_year`).
- With `?search=0`:
- Search UI is absent.
- Manual add, mic check, scoring, export/import continue working unchanged.

## Risks / Contingencies
- Open Library CORS or availability issues: search is best-effort; degrade gracefully. If persistent, defer search until a server proxy exists.
- Dedupe ambiguity (work vs edition): intentionally deferred; soft checks only.
