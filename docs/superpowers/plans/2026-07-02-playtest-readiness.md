# Playtest-Readiness Pack (Plan 4.5 — mini)

> Presentation-layer only; no gameplay/core changes (obstacles wait for Luana's playtest per ledger). Executed subagent-driven with per-task review.

**Goal:** Everything the first Luana playtest needs: a zero-text pointing-hand tutorial, the hidden parent stats corner (decision #17) fed by the journal, screen wake-lock + mute toggle, and the two cosmetic carry-forwards.

**Branch:** `feat/playtest-readiness` off main. Gates per task: tsc clean, npm test green, build green.

### Task A: Zero-text tutorial hand

- theme.ts: `ui-hand` texture — simple pointer: white filled circle (palm, r*0.5 at lower half) + rounded finger rect extending up-left, dark outline; drawn on transparent bg (no badge circle).
- PlayScene: when the current level is index 0 AND `Object.keys(progress.completed).length === 0` and no move has been made this level: after board sync, compute `findValidMoves(board)[0]` (import from barrel); animate hand sprite (depth 7, alpha 0.95) from cell a to cell b: fade in at a, tween to b over 650ms, fade out, 500ms pause, loop. Kill + destroy on first pointerdown (any). Re-show after 8s of no valid move being made (timer reset on runTurn), still only while zero moves made on level 1. Journal `tutorial_shown` once per level-start when it first appears.
- Cleanup: hand + timer killed in startCurrentLevel and on win/lose overlays.

### Task B: Hidden parent stats corner (TDD for the aggregator)

- NEW `src/services/stats.ts` (pure, TDD): `summarize(entries: JournalEntry[]): Stats` where Stats = { levelsPlayed: number; wins: number; losses: number; winRate: number (0 when no ends); giftWins: number; retries: number; shuffles: number; invalidMoves: number; perLevel: Record<string, { plays: number; wins: number; bestStars: number }> } computed from level_start/level_end (won, stars)/gift/shuffle/invalid_move events; gift counted as giftWins only when the SAME level's next level_end is a win — simplify: count `gift` events, and giftWins = level_end entries with won && stars === 1. Tests: empty journal → zeros; a scripted 6-event journal → exact counts; malformed entries ignored (missing fields skipped defensively).
- Barrel not needed (services imported directly by render).
- PlayScene: invisible hotspot rect (top-left, 90×90, alpha 0.001, depth 20, interactive) — 5 taps within 2.5s opens overlay: dim rect + panel (ui-panel, depth 21+) listing: total plays/wins as icon+number rows (ui-play icon, ui-star icon, ui-retry icon + counts: plays, wins, win% as number, gifts, retries, shuffles), then one row per level id: small text '001'..'010' + bestStars gold stars (tiny). Uses numbers/text — this is the PARENT corner, text tier n/a (Charles reads it, not Luana). Close via tap anywhere on dim. Journal `stats_viewed`.

### Task C: Wake-lock + mute

- PlayScene create(): `void navigator.wakeLock?.request('screen')` guarded try/catch (store sentinel; re-request on document 'visibilitychange' when visible). TS: `navigator.wakeLock` typing exists in DOM lib; if not, declare minimal interface locally.
- audio.ts: Blips gains `setMuted(m: boolean)` / `muted(): boolean`; internal flag checked in tone(). PlayScene: speaker button (new theme textures `ui-sound-on` / `ui-sound-off`: badge circle + speaker triangle+arcs / speaker + slash), top-right within TOP_RESERVE, depth 8, interactive; toggles, persists 'omnigame.muted.v1' in localStorage ('1'/'0'), applied at create.

### Task D: Cosmetic carry-forwards

- Chapter replay: store confetti sprites in an array; the replay button handler destroys any alive ones before startCurrentLevel.
- Clear particles: depth 2 → 1 (with gems, under HUD).

### Final: gates, compact review, merge, deploy check, ledger, mount sync.
