# Copy & Tone Guide — checkcheck

This doc standardizes microcopy so the product keeps a consistent “mic check” vibe while staying clear.

## Brand voice
- **Playful + crisp**, never twee.
- **Fast verbs**: check, tap, pick, rank, replay.
- **Always truthful**: ratings are relative; stars are derived; confidence matters.
- **No guilt**: skipping is normal; “not for me” is valid.

## Core metaphors
- **Mic check** = quick calibration session (10 comparisons).
- **Check-check** = head-to-head choice.
- **Signal** = your true preference emerging as comparisons accumulate.

## Vocabulary (canonical terms)
- Library (your shelf)
- Mic check (10-comparison sprint)
- Compare (A/B screen)
- Rank score (0.00–5.00, used for ordering; shown in details)
- Stars (quarter-stars, shown everywhere)
- Confidence (based on number of comparisons)

Avoid:
- “algorithm” (too heavy early)
- “accuracy” (feels judgmental)
- “objective” (false promise)

## UI labels (recommended)
### Primary navigation / surfaces
- **Library**
- **Mic check**
- **Profile** (later; Phase 1 can omit)

### Library sub-views
- **Want to read**
- **Finished**

### Compare screen
- Buttons:
  - **A wins**
  - **B wins**
  - **Skip**
  - **Undo**
- Header:
  - “Mic check”
- Subheader (optional):
  - “Which did you like more?”

### Library list rows
- Show:
  - Quarter-star icons (0.25 steps)
  - Title / Author
  - Optional tiny chips: “Top 12%” or “Rank #7”
- Avoid showing 2-decimal rank score in list views.

### Item detail
- Title
- Stars + rank score:
  - Quarter-star icons
  - “4.83 / 5.00”
  - “Rank #7 of 120 • Top 6%”
  - “Based on 14 comparisons”
- Explanation snippet:
  - “Relative to your library.”

### Trust tools
- “Check”
- “Re-run mic check”
- “Reset display (keeps comparisons)” (if you offer it)

## Empty states
### New user (no items)
Headline:
- “Mic check your taste.”

Body:
- “Add a few books you’ve read. Then we’ll do a quick mic check to rank them.”

CTA:
- “Add your first book”

### Library has items but no comparisons
Headline:
- “Ready for a mic check?”

Body:
- “Ten quick picks. Your shelf will snap into place.”

CTA:
- “Start mic check”

### Compare session completed
Headline:
- “Signal found.”

Body:
- “Your rankings are forming. Want to tighten the middle?”

CTAs:
- “Do 5 more”
- “Back to library”

## Error states
### Save failed
- “Couldn’t save that. Try again?”

### Offline
- “You’re offline. Some things may not work until you’re back.”

## “Not for me” / low ratings
If you add a “DNF / Not for me” affordance, keep it neutral:
- “Not for me”
- “Didn’t finish”
Avoid:
- “Bad”
- “Trash”
- “Awful”

## Teaching moments (small, optional)
When an item is low-confidence:
- “Still calibrating — do a few more comparisons.”

When a star changes:
- “Mic check update: this moved up.” (subtle toast; optional)

## Consistency tests
- Every screen should have one clear next action.
- Any time a number is shown, explain it with a phrase:
  - “Relative to your library”
  - “Based on N comparisons”
