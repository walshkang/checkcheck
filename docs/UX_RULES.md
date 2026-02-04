# UX Rules (Web-first, Mobile-responsive)

## Surface Model
Phase 1 uses three primary surfaces:

1. **Library**
   - Add items (manual first), status (want/reading/finished)
   - Two sub-views: **Want to read** (saved queue) and **Finished** (rated history)
   - Browse + sort by stacked rating (when available)
2. **Compare (“Mic check”)**
   - A wins / B wins / Skip / Undo
   - Designed for speed: 10 comparisons < 60s
   - Compare is gated until **5 active finished** items exist
   - Initial mic check hides stars during comparisons
3. **Detail**
   - Stacked rating + explanation + history + 'do more comparisons'

## Device Rules
### Desktop
- Library as left rail or main list.
- Detail as right panel.
- Compare as focused modal/page (avoid multi-layer stacks).

### Mobile
- **Only one primary surface open at a time**.
- Compare takes full focus; Detail is a bottom sheet or full page; Library is the home surface.
- Back behavior is predictable: returns to last task state (Compare Session → Library).

## Interaction Principles
- The next action is always obvious:
  - Before calibration: add/finish books until you reach 5 finished.
  - At 5 finished: do the initiation mic check.
  - After calibration: “place this book” (3 quick comparisons) is the default trust tool.
- No scroll traps during Compare.
- Undo is prominent and reliable.
- Skip is guilt-free and never penalizes the user.

## Copy / Semantics
- Ratings are **relative to your library**.
- In list views, show quarter stars; in detail view, show rank score + percentile + confidence.
