# Turn Workflow — Scope Decision

Captured 2026-07-15. This records a decision about the `feat/turn-workflow` branch and
the reasoning behind it, so it can be picked up later. **Not yet executed** — see the
open questions at the end.

## The question

The branch added a guided turn workflow (start-of-turn checklist, end-of-turn
confirmation modal, backend automations, lightweight prompts). After building it, the
complexity prompted a step back: does this feature make sense, or should the app revert
to the life-counting + token-tracking it already had?

## The decision

**Revert the modals entirely; keep only the backend rules.**

This splits the feature along the project's north star — *trim bloat, keep real
mechanics* (the knobby-compatibility goal):

- The **backend automations** are "keep real mechanics." They add zero taps and just
  make the existing tracking correct. → **Keep.**
- The **modals** (mandatory start-of-turn checklist, end-of-turn confirmation on every
  pass) are the "bloat." They add ceremony to the most common action. → **Remove.**

The signal that pushed this way: several consecutive rounds of unease about the
feature's complexity, documentation, and robustness — a feature that fits doesn't
usually generate that. And the mandatory end-of-turn modal turns a one-tap "Pass Turn"
into a multi-tap confirm every turn, which directly fights a fast tracker's purpose.

## What a turn looks like after the change

1. It becomes your turn — controller shows "YOUR TURN," nothing pops up.
2. You play normally (life, counters, commander damage). The backend silently keeps
   numbers correct: speed auto-increments once per turn on opponent life loss;
   poison/commander-damage lethality applies; Monarch/Initiative transfer on elimination.
3. You tap **Pass Turn** — one tap, advances immediately to the next living player in
   correct order. Same from the Game Menu. No confirmation, no day/night question.
4. Day/Night, Monarch, Initiative stay as manual toggles in the Tokens section.

Net effect: identical interaction to the existing life + token tracker, except the
numbers are now automatically correct. Invisible correctness, zero added ceremony.

## What gets deleted (frontend UI only)

- `StartOfTurnModal` — rad/initiative/speed checklist
- `EndOfTurnModal` — day/night resolution, monarch reminder, extra-turn toggle,
  pass-turn confirmation
- Driving state/effects: `showStartModal`, `showEndModal`, `endModalLoading`, the
  `turn_started_at`/localStorage trigger, `dismissStartModal`, `handleEndTurnConfirm`
- `handlePassTurn` collapses back to a one-tap `nextTurn` call
- GameMenu reverts to advancing the turn directly
- The modal/toast CSS

## What stays (backend rules — untouched)

- Monarch/Initiative transfer on elimination, incl. the next-in-turn-order fallback
- Speed auto-increment on opponent life loss, gated once per turn
- The `next_turn` **turn-order bug fix** (eliminated active player passes to the next
  player, not the lowest ID) — a genuine fix worth keeping
- Commander-damage / poison lethality (unchanged from before)

See [turnWorkflow.md](turnWorkflow.md) for the full mechanics detail and CR citations.

## Open questions (resolve before executing)

1. **Capture prompt + venture toast (the non-blocking nudges).** "Keep only the backend
   rules" reads as removing these too (purest version → zero added frontend UI). Default
   is to remove them, unless they're worth keeping as lightweight reminders.
2. **Backend `extra_turn` support.** With the modal gone, nothing triggers it — it
   becomes dead code. Default is to remove the param and revert `nextTurn.js` to the
   simple no-body call, keeping only the turn-order fix in `next_turn`.

## Also still on the table (from earlier discussion)

- A committed backend test suite (`backend/test_game_state.py`) to lock the kept rules
  against regressions — the highest-leverage robustness step, independent of this revert.
- Optional: `/undo` via bounded state snapshots — the one "more robust" pattern that
  earns its keep in a tap-heavy tracker. Not needed now.
