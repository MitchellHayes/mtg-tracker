# Turn Workflow

This documents the turn workflow introduced on the `feat/turn-workflow` branch: a guided
start-of-turn checklist, an end-of-turn confirmation flow, and backend automations that
fire on life changes and turn passes. Use this to verify the behavior against actual
Magic rules — a [Rules verification notes](#rules-verification-notes) section at the end
records how each rules question was resolved.

## Overview of a turn

```
Active player taps "Pass Turn" (toolbar, or Game Menu → Pass Turn)
        │
        ▼
End-of-Turn modal (reflects the active player, even if triggered from the menu
while viewing someone else's controller)
  - Resolve day/night based on spells cast this turn
  - Monarch draw reminder (if the active player is the Monarch)
  - Optional "take an extra turn" toggle
  - Confirm → POST /day_night (if changed) → POST /next_turn {extra_turn?}
        │
        ▼
Backend next_turn
  - Advances current_turn_id in true turn order from the current player
    (or repeats the current player if extra_turn)
  - Resets speed_increased_this_turn = False for all players
  - Resets turn_started_at
        │
        ▼  (WebSocket broadcast)
Start-of-Turn modal (new active player, only if they have anything to resolve;
derived from turn_started_at so it survives reloads)
  - Initiative → venture reminder (upkeep)
  - Rad counters → mill + life loss + rad removal helper (precombat main)
  - Speed → current speed status
        │
        ▼
Normal play. During the turn, the backend auto-applies:
  - Speed +1 the first time an opponent loses life (once per turn)
  - Monarch/Initiative transfer when someone is eliminated (to the active
    player, or to the next player in turn order if the active player died)
And the UI prompts for manual mechanics it can't detect:
  - Combat damage to the Monarch/Initiative holder → pass-token prompt
  - Taking the Initiative → venture reminder
```

## Start-of-Turn checklist (`StartOfTurnModal`)

Shown on a player's controller while `current_turn_id` is their ID and they're not
eliminated. The trigger is derived from state (`isMyTurn` + `turn_started_at` in
[PlayerController.jsx](frontend/src/PlayerController.jsx)), not a live turn transition,
so it survives a page reload or a phone waking mid-turn. Once dismissed it's remembered
in `localStorage` (keyed by `turn_started_at`) so it won't reappear for that turn; old
keys for the player are pruned on dismissal. It only appears if at least one item
applies; otherwise the turn starts silently.

Each item must be **checked** or explicitly **skipped** before the "Got it" button
enables. Skipping is an escape hatch for when the table resolved something manually.

Items are listed in the order they resolve during the turn (upkeep before precombat
main phase):

| Item | Shown when | Behavior |
|---|---|---|
| Initiative | player holds the Initiative | Reminder to venture into the Undercity at the beginning of upkeep. No state change. |
| Rad counters | `rad > 0` | Instructs: at the beginning of your first main phase, mill `rad` cards; lose 1 life **and remove one rad counter** per nonland milled. The item is locked until the player either enters the nonland count (stepper, capped at `rad`) or taps "All lands milled". On confirm, `-nonlandMilled` life is applied via the normal life-update API (so backend elimination/speed rules run) and `-nonlandMilled` rad counters are removed via the counter API. Skipping clears both pending changes. |
| Speed | `speed > 0` | Status display: `Speed N / 4`, or "Max Speed!" at 4. Notes that speed increases automatically the first time an opponent loses life on your turn. No state change. |

Notes:

- The modal is client-side only; the backend doesn't know a checklist exists. If the
  player closes/reloads the page mid-checklist, it won't reappear (it triggers on the
  turn-change transition, not on state).

## End-of-Turn flow (`EndOfTurnModal`)

Opened by **Pass Turn** — from the active player's toolbar (shown even when they're
eliminated, so an active player who dies can still advance play) **or** from the Game
Menu's Pass Turn, which routes through this same modal rather than advancing the turn
directly. The modal reflects the **active player** (`current_turn_id`), which may differ
from the controller you're viewing when opened from the menu; the header reads "End of
{name}'s Turn" in that case.

1. **Day/Night resolution** (only if `day_night` is `"day"` or `"night"`; hidden when
   the game isn't tracking it). The question depends on the current state, per CR 730:
   - **Day:** "Did **{active player}** cast any spells this turn?" (No spells / 1 or more).
     "No spells" → becomes Night.
   - **Night:** "Did **any one player** cast two or more spells this turn?" (No / Yes, 2+).
     "Yes" → becomes Day.
   - Otherwise no change.
   - An answer is required before confirming. The result is previewed
     ("🌙 Becomes Night", "☀ Becomes Day", or "No change").
2. **Reminders** (informational, no state change):
   - "Draw a card — {active player} is the Monarch." — shown only if the active player is the Monarch.
   - "Check for any other end-step triggers." — always shown.
3. **Extra turn toggle:** "Take an extra turn" — when enabled, confirm repeats the
   current player's turn (`POST /next_turn {extra_turn: true}`) instead of advancing,
   and the button reads "Take Extra Turn."
4. **Confirm:** if day/night changed, `POST /day_night` first, then `POST /next_turn`
   (with the extra-turn flag). The button shows "Passing…" and disables while in flight.
   **Cancel** closes the modal without passing the turn.

## Backend automations ([game_state.py](backend/game_state.py))

### Speed auto-increment (`_on_opponent_life_loss`)

Triggered whenever a player loses life via `POST /update` (negative delta) or via
commander damage that reduces life. Rules applied:

- Only fires if the player who lost life is **not** the active player.
- The **active** player's speed increases by 1 if all of:
  - current speed is 1–3 (engines started, not at max), and
  - `speed_increased_this_turn` is `False`.
- Sets `speed_increased_this_turn = True` so it fires at most once per turn.
- A **manual** speed increase via `POST /counter` also sets the flag, so manual and
  automatic increments can't stack in one turn.
- `POST /next_turn` clears the flag for all players.

Poison counter changes never trigger this (poison isn't life loss).

### Elimination side effects (`_on_elimination`)

Checked after life updates, poison updates, and commander damage. When a player's life
reaches 0 or below, the **Monarch** and **Initiative** (if they held them) transfer,
following CR 724.4 / 903.13:

- Eliminated on someone else's turn → the **active player** takes the token.
- Eliminated on their own turn → the **next living player in turn order**
  (`_next_in_turn_order`, wrapping) takes it.
- If no living player remains, the token is cleared.

Elimination itself is unchanged from `main`: poison ≥ 10 or commander damage ≥ 21 from
a single commander sets life to 0.

### `next_turn`

- Advances `current_turn_id` in **true turn (ID) order starting from the current
  player** (`_next_in_turn_order`, wrapping), skipping eliminated players. This means a
  player eliminated on their own turn passes to the player *after* them, not to the
  lowest living ID.
- With `extra_turn=True`, keeps `current_turn_id` unchanged so the current player takes
  another turn (Time Warp effects).
- Resets `speed_increased_this_turn = False` for every player.
- Resets `turn_started_at`.

## Manual-mechanic prompts (frontend)

Some triggers depend on information the backend can't see (was it *combat* damage? did
the player choose to venture?). These surface as lightweight, dismissible UI rather than
automation:

- **Token capture** — when the player holding the **Monarch** and/or **Initiative**
  loses life, a banner appears: "Combat damage from an opponent? Pass the crown /
  initiative to:" with a button per opponent. Tapping one transfers the held token(s)
  via `POST /monarch` / `POST /initiative`. It auto-dismisses after 8s and can be closed
  manually. It fires on any life loss (the backend can't distinguish combat), so it's a
  reminder, not an assertion.
- **Venture on take** — claiming the Initiative shows a transient toast reminding the
  player to venture into the Undercity (you venture when you *take* the Initiative, not
  only at upkeep).

## Rules verification notes

Rules questions raised during review and how each was resolved:

1. **Rad counters removed on mill — FIXED.** CR 724 (Fallout): at the beginning of the
   precombat main phase, mill that many cards, lose 1 life **and remove one rad
   counter** for each nonland card milled. The start-of-turn modal now removes
   `nonlandMilled` rad counters alongside the life loss on confirm ("All lands milled"
   correctly removes none).

2. **Monarch/Initiative transfer when the active player is eliminated — FIXED.**
   CR 724.4 / 903.13: if the monarch leaves the game **during their own turn**, the
   **next player in turn order** becomes the monarch (same pattern for initiative).
   `_on_elimination` now falls back to `_next_in_turn_order` instead of leaving the
   token on the dead player.

3. **Night → day checks any single player's spells — FIXED.** CR 730: day → night
   checks whether the **active player** cast no spells; night → day checks whether
   **any one player** cast two or more. The end-of-turn modal now asks a
   state-specific question instead of a single ambiguous spell count.

4. **Day/Night timing — accepted simplification.** The change officially happens as
   the next turn begins (upkeep check), not during the end step. Applying it at
   pass-turn time is functionally equivalent for this tracker; "spells cast this turn"
   means the turn that just ended, which is what the modal asks about.

5. **"Start of Turn" merges two phases — mitigated.** Initiative venturing is an
   upkeep trigger; rad counters resolve at the beginning of the **precombat main
   phase** (after draw). The checklist now lists items in resolution order
   (initiative → rad → speed) and the rad copy names the phase; it remains one
   combined checklist by design.

6. **Speed trigger is life loss, not damage — copy FIXED.** The Aetherdrift reminder
   text is "It increases once on each of your turns when an opponent loses life." The
   backend already triggered on any life loss (including commander damage); the
   checklist copy now says "the first time an opponent loses life on your turn"
   instead of "when you deal damage to opponents."

7. **Monarch draw reminder only reaches the active player — correct as is.** The
   monarch draws at the beginning of **their own** end step, so showing the reminder
   in the passing player's end-of-turn modal only when *they* are the monarch matches
   the rule; non-active monarchs don't draw on others' turns.
