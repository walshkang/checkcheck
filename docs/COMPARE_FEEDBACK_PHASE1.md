# Compare Feedback (Phase 1)

Last updated: 2026-02-06

Goal: make Compare feel premium and *instrument-like* (calm, fast, trustworthy) by adding restrained progress feedback and tactile confirmation—without turning outcomes into a game.

Scope: Compare surface only (Mic check, Placement, Re-check).

## Constraints (hard)
- Motion stays calm (press + crossfade only). No bounce, no celebration.
- Respect `prefers-reduced-motion`.
- Pending-lock remains strict: while saving/recomputing, **all** Compare actions are locked (A/B/Skip/Undo).
- Do not use a routine “Saved” toast in Compare (toast is `aria-live`; avoid churn and screen reader noise).
- Do not imply sync/queue semantics (“We’ll sync later”). Be honest and local-first.
- Do not add a new primary surface (Compare / Detail / Library remain the only primaries).

## Baseline (already shipped)
- Card tap-to-choose + calm enter animation + reduced-motion disables transitions.
- Pending state locks out interleavings.
- Blocked taps while pending are logged (`compare_pending_lock_blocked`).

## Spec

### 1) Inline “Saving…” progress state
**Purpose:** acknowledge “blocked while pending” and long saves without breaking flow.

Placement:
- Compare header row, adjacent to the progress chip (`x / stepsTotal`).
- Reserve space so it never causes layout shift.

Behavior:
- Show “Saving…” if `comparePending` lasts longer than **~200ms** (threshold avoids flicker).
- If the user attempts an action while pending (pending-lock blocks), show “Saving…” immediately.
- Hide when pending clears.

Accessibility:
- Not `aria-live` (avoid repetitive announcements).
- Keep it purely visual; the interaction confirmation remains “next pair appears”.

### 2) “Feedback” control (discoverable, not a new surface)
**UI:** a small `Feedback` button next to the progress chip.

Interaction:
- Opens a tiny popover/mini-panel anchored to the button.
- Contains a single control for Phase 1:
  - `Tactile click` toggle: **On/Off** (default **On**).
- Closes on outside tap/click and Escape.
- Must not block Compare actions beyond the existing pending-lock.

Persistence:
- Store the toggle in IndexedDB `ui_state` (local-only), so it persists across refreshes/exports.

### 3) Haptics (default ON; immediate; undo distinct)
**Purpose:** make decisions feel “committed” without visual noise.

Rules:
- Fire haptics **immediately** on accepted actions (win/skip/undo), after pending state is set and before any awaits.
- Never fire on blocked taps while pending.
- Never fire on save error.
- Best-effort only: enable only when supported (e.g., `navigator.vibrate`).

Patterns (tunable):
- Win / Skip: single short “tick” pulse.
- Undo: distinct “double-tick” (two short pulses with a short gap).

### 4) Save failure (honest + calm)
On save/recompute failure in Compare:
- Keep the same pair visible (no advance).
- Present in-flow error with Retry:
  - “Couldn’t save that. Try again?”
- If offline is detectable, allow the generic offline message:
  - “You’re offline. Some things may not work until you’re back.”
- Avoid any copy that implies background syncing/queuing.

## Instrumentation (Phase 1)
Existing:
- `compare_pending_lock_blocked` already measures frustration / premature taps.
- `compare_tap_to_next` already tracks latency.

Optional:
- Add a `compare_feedback_toggle` event (value: on|off) to correlate with undo/skip rate and session completion time.

## Verification checklist
- No layout shift when “Saving…” appears/disappears.
- “Saving…” does not flicker (threshold works).
- Pending-lock blocks interleavings; blocked taps do not record comparisons and do not vibrate.
- Haptics:
  - Default On; persists across refresh.
  - Off means off.
  - Undo is distinct from win/skip.
- Reduced-motion stays calm (no new animations introduced).
- Tap → next pair p90 does not regress meaningfully.
