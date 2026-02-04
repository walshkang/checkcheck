# Want Metadata (Phase 1): Suggested Type + Tags

Last updated: 2026-02-04

This doc defines how **Open Library–derived metadata** is used when adding books to the **Want to read** list.

Core invariant:
> Comparisons create judgment. Metadata provides context.

## Principles (Non-negotiable)
- External metadata is **suggestive**, never authoritative.
- Metadata must **not** affect scoring, rankings, or comparisons.
- Tags are **always user-created** (no auto-tagging).
- User action always outranks machine inference.
- Want = pre-judgment. Finished = post-experience.

## Data model (local-first)

### `items` (immutable-ish metadata)
Store the raw facts we ingested so we can re-map later without losing provenance.

- `source: { provider: "openlibrary", key: string|null }`
- `isbn: string|null`
- `cover_url: string|null`
- `first_publish_year: number|null`
- `raw_subjects: string[]` (preserved; never surfaced directly)

### `library_entries` (user-owned context)
- `status: "want" | "reading" | "finished"`
- `type_suggested: string|null` (Phase 1: single value)
- `type_confirmed: string|null`
- `type_decision: "confirmed" | "cleared" | null` (durable; prevents re-suggesting/re-promoting)
- `tags: string[]` (user-created only)

## Suggested type UX

### Search results
- Show literal copy: `Suggested: Fiction` (only when `type_suggested` exists).
- Do not show more than one type in Phase 1.

### Want list
- May show a type chip when `type_suggested` exists.
- Suggested chips should be visually lighter than confirmed chips.
- Do not show tags by default in the list.

### Detail (confirmation moment)
- Detail may show cover images for recognition (including when `status === "finished"`).
- Type:
  - If `type_decision` is null and `type_suggested` exists, show: `Suggested: …`
  - User can accept/change (sets `type_confirmed`, `type_decision="confirmed"`)
  - User can clear (sets `type_confirmed=null`, `type_decision="cleared"`)
  - Once decided, the “Suggested” label disappears permanently for that item.
- Tags:
  - User can add/remove tags.
  - Normalize tags (trim, collapse whitespace), dedupe case-insensitively.

## Finished transition rule
When an item is marked **Finished**:
- If `type_confirmed` exists: keep it.
- Else if `type_decision !== "cleared"` and `type_suggested` exists: promote `type_suggested → type_confirmed`.
- Else: leave type unset.

## Covers: allowed surfaces (Phase 1)
Allowed:
- Search results
- Detail header (recognition), regardless of status

Not allowed:
- Finished list (operational browsing / ranking-heavy)
- Compare

## Copy guardrails
Use:
- `Suggested: Fiction`
- `Add tags to remember why you saved this`

Avoid:
- “Genre”
- “Category”
- “Auto-detected”
- “We think this is…”

## Open Library → Type mapping (Phase 1 authority)
Only these mappings are allowed. If it doesn’t map cleanly, do not infer a type.

| Open Library Subject / Keyword | Mapped Type   |
| ------------------------------ | ------------- |
| Fiction                        | Fiction       |
| Literary fiction               | Fiction       |
| Speculative fiction            | Fiction       |
| Science fiction                | Fiction       |
| Fantasy                        | Fiction       |
| Novel                          | Fiction       |
| Short stories                  | Short Stories |
| Collected stories              | Short Stories |
| Nonfiction                     | Nonfiction    |
| Essays                         | Essay         |
| Essay                          | Essay         |
| Criticism                      | Essay         |
| Biography                      | Memoir        |
| Autobiography                  | Memoir        |
| Memoir                         | Memoir        |
| Poetry                         | Poetry        |
| Poems                          | Poetry        |
| Verse                          | Poetry        |

Explicitly ignored (dropped):
- Time periods (e.g., “20th century”)
- Nationality (“American literature”)
- Demographics (“Women authors”)
- Academic fields (“Psychology”, “History”)
- Awards, popularity, audience level

