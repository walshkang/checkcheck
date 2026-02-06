# Learning with coding agents (product sense + coding skill)

This repo is a good sandbox for building intuition about AI products because it has:
- A clear primitive action (comparisons) and deterministic derived outputs (scores/stars)
- Tight UX rules + invariants
- Real “agent work”: read files, change code, run tests, debug, iterate

This playbook is adapted from the “Magic school bus” tutorial (Cursor-focused) but written to apply to **any** coding agent.

## why we’re doing this
- Build “AI product sense” by decomposing agentic systems into: **text → tools → results → more text**.
- Learn to ship with agents without losing control: you approve tools, verify outputs, and keep meaning/versioning explicit.

## how we’ll work (lightweight rules)
We’ll use two modes so learning never blocks building.

### build mode (default)
Goal: ship.
- Move in small slices; each slice ends with tests or a repeatable verification checklist.
- Minimal narration; no tutoring pauses unless you ask.
- If there’s friction (confusing, slow, or surprising), end the slice with a quick retro (template below).

### learn mode (on request)
Goal: build intuition.
- One step at a time; one question at a time.
- Before moving on, you explain back the concept + how it showed up in our work.
- We keep artifacts in files: checklists, prompts, decision logs, and small scripts.

### 5-minute retro template (works in either mode)
Drop this into a note (or paste into chat) after a slice:
- What did we change (1–3 bullets)?
- Why did we change it (the user loop / invariant / metric)?
- How did we verify it (test/command/checklist)?
- What surprised us (agent behavior, tools, bugs, UX)?
- One thing to remember next time (a rule of thumb).

## tool approval rubric (so it’s not scary)
When the agent asks to run a tool/command, expect a 10-second safety summary:
- **Intent:** what it’s trying to accomplish
- **Reads/Writes:** what files it might touch (or “read-only”)
- **Risk:** what could go wrong (usually low)
- **Rollback:** how to undo (git, revert, delete generated files)

## curriculum (start at “step 3”)

### Step 3: the mental model (agent, editor, file tree)
Goal: stop treating the agent as magic; treat it as software.
- Exercise: ask the agent “What’s in this repo? Explain it to me as a product manager.”
- Explain-back bar: identify (1) what it *read*, (2) what it *assumed*, (3) what it *couldn’t know* without running tools.

### Step 4: a safe first edit (diffs + undo)
Goal: build comfort with file edits and diffs.
- Exercise: make a tiny doc-only change (copy, checklist, or a heading) and inspect the diff.
- Explain-back bar: point to exactly what changed and why it’s safe.

### Step 5: model selection is a product decision
Goal: feel tradeoffs, not just read benchmarks.
- Exercise: run the same request with two different models (e.g., “improve copy for the Unplaced header” vs “implement the change”).
- Explain-back bar: name which model you’d pick for (a) planning, (b) refactors, (c) tests/debugging, and why.

### Step 6: tool calling is its own skill
Goal: learn the “handyman” loop: LLM requests → harness executes → results returned.
- Exercise: ask “Walk me through each tool call you used and why.”
- Explain-back bar: distinguish “reasoning quality” from “tool reliability” and “tool availability.”

### Step 7: build a minimal “project OS” (knowledge + tasks)
Goal: turn agent output into durable context you can reuse.
- Exercise: create `docs/os/Knowledge/`, `docs/os/Tasks/`, and `docs/os/GOALS.md` (Markdown-only).
- Explain-back bar: articulate the difference between “chat history” and “malleable knowledge.”

### Step 8: kicking the tires of RAG (retrieval)
Goal: blame missing context before blaming the model.
- Exercise: add 2–3 short notes to `docs/os/Knowledge/` and ask the agent a question that requires retrieving them.
- Explain-back bar: explain what the agent retrieved and what it ignored (and whether that was correct).

### Step 9: agent memory via `AGENTS.md`
Goal: feel what “memory” is: instructions prepended to every conversation (and its cost).
- Exercise: add one useful, persistent preference to `AGENTS.md` (keep it short).
- Explain-back bar: justify why it belongs in memory vs retrieval.

### Step 10: context engineering (finite window)
Goal: treat context as a scarce budget.
- Exercise: start a new task and explicitly choose which files are “always-on” vs “pulled in just-in-time.”
- Explain-back bar: state the tradeoff you made (less context vs more precision).

## north star outcomes (phase 1-aligned)
- You can predict when the agent will need tools.
- You can keep meaning stable (curve versions, invariants) while shipping faster.
- You can design “memory vs retrieval vs tools” deliberately for users, because you’ve felt it yourself.
