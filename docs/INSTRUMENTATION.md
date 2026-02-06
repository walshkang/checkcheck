# Instrumentation (Phase 1)

Purpose: tune delight (curve + hysteresis) using real traces.

## Where it lives (repo)
- Stored locally in IndexedDB (`checkcheck` DB, `events` store).
- Export via the footer action “Export trace” (downloads JSON).
- Clear via “Clear trace” (for fresh runs).

## Events (local-first is fine)
- comparison_made { session_id, a_id, b_id, winner|skip, time_to_decide_ms }
- comparison_undo { session_id }
- compare_session_started { mode: mic_check|after_finish|recheck }
- compare_session_completed { mode, comparisons_count, duration_ms }
- compare_input { session_id, input: card|button, winner: a|b|skip|undo }
- compare_pending_lock_blocked { session_id, action: win|skip|undo }
- item_added { method: manual|search }
- item_status_changed { from, to }
- reseed_used { type: reset_display|reset_scores|reset_comparisons }

## Metrics to watch
- Time per comparison (median, p90)
- Time from tap → next pair shown (median, p90)
- Undo rate
- Skip rate
- Session completion rate
- Star jitter incidents (stars_display changed more than once per item per X comparisons)
