# Signal Visual Language

**Purpose**
Establish a consistent visual system rooted in the mic illustration that communicates *judgment, calibration, and clarity*—without turning into decoration or noise.

---

## 1) Core Thesis

> *We help you listen to your own signal.*

The mic is not a logo flourish. It is a **tool metaphor**. Visuals derived from it should reinforce moments where uncertainty becomes clarity.

---

## 2) Visual Principles (Non‑Negotiables)

### A. Tool, Not Mascot

* The mic represents **calibration**, not personality.
* No faces, characters, or anthropomorphism.

### B. Singular & Calm

* One illustration per surface.
* Centered or clearly bounded.
* No stacking, tiling, or repetition.

### C. Imperfect on Purpose

* Hand‑drawn feel is intentional.
* Avoid razor‑straight geometry or hyper‑polish.

---

## 3) Iconography Rules

**Style**

* Single‑object icons
* Thick, rounded strokes
* Soft corners
* Minimal internal detail

**Construction**

* Rounded joins and caps
* Slight path variance allowed
* No sharp 90° corners unless structurally required

**Usage**

* Icons should feel like they were drawn with the *same pen* as the mic.

---

## 4) Color Semantics (Meaning > Palette)

### Warm Yellow

**Meaning:** signal, decision, confidence

* Use when a decision is made or confirmed
* Primary CTAs that commit action
* “Signal found” moments

### Muted Teal

**Meaning:** tool, container, safe interaction

* Frames interaction surfaces
* Banners, cards, nav affordances

### Off‑White / Paper

**Meaning:** thinking space

* Default background
* Breathing room for judgment

**Rule:** Do not introduce new “importance colors” unless they map to these meanings.

---

## 5) Illustration Usage Pattern

Illustrations appear only at **conceptual moments**, not operational ones.

**Good Uses**

* Mic check landing
* Empty states (no comparisons yet)
* “Signal found”
* First‑time onboarding

**Bad Uses**

* Inside lists
* Near form fields
* Repeated per item
* Dense flows

---

## 6) Motion & Interaction (If Any)

* Subtle only (fade, gentle slide)
* No bounce, no celebration confetti
* The confidence comes from *resolution*, not excitement
* Respect `prefers-reduced-motion`

---

## 7) Guardrails (What Not To Do)

* Don’t plaster the style everywhere
* Don’t animate aggressively
* Don’t mix with sharp, glossy, high‑contrast UI
* Don’t turn the mic into chrome or decoration

If overused, the signal loses meaning.

---

# Surface Mapping

## Library

**Role:** Status + inventory + flow control

* ❌ No mic illustration
* ❌ No persistent mic CTA
* ✅ Plain UI
* ✅ Inline after‑finish prompt (text‑first)

Rationale: Library is operational, not conceptual.

---

## After‑Finish Prompt (3‑Step Tighten)

**Role:** Local refinement

* ❌ No illustration
* ❌ No yellow dominance
* ✅ Simple text: “Check”

Rationale: This is micro‑adjustment, not calibration.

---

## Mic Check Landing

**Role:** Calibration sprint

* ✅ Mic illustration (primary)
* ✅ Teal container + yellow accent
* ✅ Copy teaching “10 quick picks”

This is the *home* of the visual language.

---

## Mic Check In‑Progress

**Role:** Judgment in motion

* ❌ No illustration
* ✅ Minimal UI
* ✅ Progress indicator (x / 10)
* ✅ Calm interaction feedback (press + crossfade)

Rationale: Focus beats metaphor mid‑task.

---

## Signal Found

**Role:** Resolution

* ✅ Yellow accent
* ✅ Optional small icon/illustration
* ✅ Extra breathing room

This is the emotional payoff.

---

## Empty / Onboarding States

**Role:** Orientation

* ✅ Single illustration allowed
* ✅ Calm copy
* ❌ No instructions overload

---

## Nav

**Role:** Wayfinding

* ❌ No illustration
* ✅ Simple mic icon allowed
* Label remains: “Mic check”

---

## Decision Checklist (Use Before Adding Illustration)

An element may use Signal visuals **only if** it represents:

* Calibration
* Decision confidence
* Transition from uncertainty → clarity

If not, keep it plain.

---

**Outcome:**
The mic image becomes a *system of meaning*, not an asset. The UI stays calm, confident, and focused on judgment—not decoration.

---

# Design Review Checklist

Use this checklist in design reviews before approving any new UI or visual change.

## A) Eligibility Check (Gate)

A screen or element may use **Signal Visual Language** only if **at least one** is true:

* ☐ Represents **calibration** (global or local)
* ☐ Represents **decision confidence**
* ☐ Marks a transition from **uncertainty → clarity**

If **none** apply → **No illustration, no signal color, no mic icon**.

---

## B) Surface Appropriateness

* ☐ Is this a *conceptual* moment (not operational)?
* ☐ Is the user pausing to think, decide, or reflect?
* ☐ Would removing the illustration make the task clearer, not harder?

If this surface is list-heavy, repetitive, or fast-action → **fail**.

---

## C) Illustration Rules

If an illustration is present:

* ☐ Only **one** illustration on the screen
* ☐ Centered or clearly bounded
* ☐ No repetition or tiling
* ☐ Not adjacent to form inputs or dense controls

---

## D) Iconography Rules

If an icon is introduced or modified:

* ☐ Single-object
* ☐ Thick, rounded strokes
* ☐ Soft corners
* ☐ Minimal internal detail
* ☐ Matches mic stroke weight and feel

If it looks like a default Figma icon → **revise**.

---

## E) Color Semantics

* ☐ Yellow used only for **decision / confirmation / commitment**
* ☐ Teal used only for **tools / containers / safe interaction**
* ☐ Off-white preserved as thinking space
* ☐ No new "importance" colors introduced

If color is decorative rather than meaningful → **remove**.

---

## F) Motion & Emphasis

If motion exists:

* ☐ Subtle (fade, gentle slide)
* ☐ No bounce, pulse, or celebration
* ☐ Does not compete with judgment

If motion draws attention to itself → **fail**.

---

## G) Final Question (Hard Gate)

> Does this visual help the user *trust their judgment* more?

If the answer is not clearly “yes” → do not use Signal visuals.

---

# Screen Audit (Current Surfaces)

Use this audit to align existing screens with the Signal system.

| Screen / Surface             | Category     | Signal Visuals Allowed? | Notes / Actions                                                                             |
| ---------------------------- | ------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| Library                      | Operational  | ❌ No                    | Keep plain. Remove any mic CTAs or illustrations. Text-only after-finish prompt is correct. |
| Add Book                     | Operational  | ❌ No                    | No signal visuals. Focus on speed and clarity.                                              |
| Finished Transition          | Transitional | ⚠️ Limited              | Text-first prompt only (“Check”). No illustration.                                          |
| After-Finish (3-step)        | Operational  | ❌ No                    | No illustration, no yellow dominance. Focus UI.                                             |
| Mic Check Landing            | Conceptual   | ✅ Yes                   | Primary home of mic illustration + signal color.                                            |
| Mic Check In-Progress        | Operational  | ❌ No                    | Strip visuals. Show progress only.                                                          |
| Signal Found                 | Resolution   | ✅ Yes                   | Yellow accent, breathing room, optional small icon.                                         |
| Empty State (no comparisons) | Conceptual   | ✅ Yes                   | Single illustration allowed. Calm copy.                                                     |
| Onboarding (first-time)      | Conceptual   | ✅ Yes                   | One illustration max. No repetition.                                                        |
| Archive / Restore            | Operational  | ❌ No                    | Plain UI only.                                                                              |
| Search                       | Operational  | ❌ No                    | No signal visuals.                                                                          |
| Nav Bar                      | Wayfinding   | ⚠️ Icon only            | Simple mic icon allowed. No illustration.                                                   |

---

## Audit Rule of Thumb

If a screen answers **“What should I do?”** → keep it plain.
If a screen answers **“What does this mean?”** → Signal visuals may apply.

---

**Use this document as a living checklist during design reviews and PRs.**
