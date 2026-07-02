# Match-3 Obstacles Implementation Plan (Plan 5 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. TDD per task; per-task review; commits as `Charles DeFarias <cddefari@gmail.com>` on branch `feat/match3-obstacles`; controller pushes/merges. Gates per task: `npx tsc --noEmit`, `npm test`, `npm run build` (render tasks).

**Goal:** Two obstacle classes — **boxes** (in-cell blockers with hp, damaged by adjacent clears and booster hits, acting as gravity floors) and **ice plates** (under-piece layer, cleared when the piece above clears) — plus obstacle-clearing goals, simulator support, ten new calibrated levels (kitchen 011-020, 15-25 move budgets per decision #22), and full rendering.

**Fixed mechanics:**
- Box: `{ kind: 'blocker'; hp: 1 | 2 }` in `Board.cells`. Not matchable (findRuns already skips non-normal), not swappable (new SwapCheck reason `'blocked'`), does NOT fall and blocks pieces from falling past it (gravity compacts per column SEGMENT between blockers). Takes 1 damage when: any orthogonally-adjacent cell is cleared in a wave, OR the box's own cell is in a booster/combo target set. Max 1 damage per wave (dedupe). hp→0 removes the box in that wave's clear (cell becomes null).
- Ice: `Board.ice: boolean[]` (parallel to cells). A cell with ice behaves normally; when that cell's piece is cleared in a wave, the ice breaks instead of persisting (piece clears AND ice clears — single-layer plates, Royal Match style). Ice under a box: allowed; breaks when the box is destroyed. Refill/gravity untouched by ice (it's terrain).
- Refill fills ALL nulls including cells under boxes (pieces fade in — renderer treats refill as fade-in, which it already effectively does via drop-from-top; cells under boxes get a scale-pop instead: renderer detail).
- Goals: existing collect + new `{ type: 'clearBoxes'; count }` and `{ type: 'clearIce'; count }`. TurnResult gains `clearedBoxes: number; clearedIce: number`.
- New ResolveEvents: `{ type: 'damage'; cells: Coord[] }` (boxes losing hp but surviving), boxes destroyed appear in the wave's normal `clear` cells; `{ type: 'iceClear'; cells: Coord[] }`.
- Level schema: `board` gains optional `layout?: string[]` (ASCII rows, width×height): `.` = normal spawn, `b` = box hp1, `B` = box hp2, `i` = ice under spawned piece. parseLevel validates dimensions/chars; createBoard consumes it (boxes placed, ice set, remaining cells filled no-starting-match as today).

### Task 0: Types + board + level schema (TDD)
- types.ts: extend Piece union with `{ kind: 'blocker'; hp: number }`; Board gains `ice: boolean[]`.
- board.ts: createBoard signature gains optional `layout?: string[]`; when absent, ice all-false, no boxes (back-compat — all existing tests must pass unchanged except Board shape additions; update `boardFrom` test helpers per Task note below). cloneBoard copies ice.
- level.ts: parse/validate layout (row count = height, row length = width, charset `.bBi`), goals accept the two new types (palette check only applies to collect).
- Update every `boardFrom` helper (matches/groups/swap/gravity/moves/boosters/resolve test files) to set `ice: new Array(cells.length).fill(false)`; extend it: uppercase `X` = box hp1 for future tests (add now).
- Tests: creation with layout places boxes/ice exactly; back-compat default; parseLevel layout validation errors.

### Task 1: Swap + moves with blockers (TDD)
- swap.ts: canSwap returns `{ valid: false, reason: 'blocked' }` when either piece is a blocker (before the special bypass). SwapCheck + resolve TurnResult + game MoveOutcome reason unions gain `'blocked'`.
- moves.ts: findValidMoves naturally excludes blocked swaps via canSwap (verify by test: box-adjacent swaps absent). shuffleBoard must NOT move blockers and must NOT move ice (shuffle only permutes kind==='normal' pieces — specials stay put too? current code shuffles all occupied cells INCLUDING specials; keep specials shuffling but exclude blockers: coords filter becomes `p !== null && p.kind !== 'blocker'`).
- Tests: blocked reason both directions; findValidMoves excludes; shuffle leaves boxes+ice in place, deadlock detection with boxes present.

### Task 2: Segmented gravity (TDD)
- gravity.ts applyGravity: per column, compact pieces downward WITHIN each maximal run of non-blocker cells (segments split by blockers). Blockers never move. Implementation: walk y from bottom; when hitting a blocker, reset writeY to blocker_y - 1. Refill unchanged (fills all nulls).
- Tests: piece above a box stays above it; segment below a box compacts independently; existing gravity tests unchanged (no blockers = one segment).

### Task 3: Resolve — damage, ice, counts, events (TDD; the hard one)
- clearWave changes in resolve.ts:
  1. Compute `expanded` as today (expandWithSpecials skips blockers for activation — blockers aren't specials; but booster targets MAY include blocker cells: they must NOT be nulled as pieces — instead they take damage).
  2. Partition expanded into `pieceCells` (normal/special) and `boxHits` (blocker cells directly targeted).
  3. Adjacency damage: every blocker orthogonally adjacent to any pieceCell also joins `boxHits` (dedupe, max 1 damage/wave).
  4. Apply: pieceCells → count colors, break ice (cells with ice → ice=false, clearedIce++, iceClear event), null the cells, clear event (pieceCells only). Boxes in boxHits: hp-1; hp>0 → damage event; hp==0 → cell nulled, clearedBoxes++, ice under it breaks too (iceClear + count), and the box cell joins the clear event cells (so the renderer pops it).
  5. Then spawns, gravity, refill as today.
- TurnResult gains clearedBoxes/clearedIce (totals across waves).
- Cascade loop unchanged (findMatchGroups skips blockers already).
- Tests (boardFrom `X`=box, plus direct set() for hp2/ice): adjacent match damages box once even when two adjacent cells clear; booster row through a box damages it; hp2 box survives one wave with damage event, dies next; destroyed box appears in clear cells + clearedBoxes count; ice breaks with piece clear (iceClear event + count, board.ice updated); ice under destroyed box breaks; determinism.

### Task 4: Goals + game wiring (TDD)
- goals.ts: Goal union += ClearBoxesGoal/ClearIceGoal; applyCleared signature extended to `(states, clearedByColor, clearedBoxes: number, clearedIce: number)` (update existing call sites/tests).
- game.ts applyMove passes the new counts. Barrel exports updated (types).
- Tests: box/ice goal progress, capping, completion mixes.

### Task 5: Simulator support (TDD light)
- policies.ts greedyPolicy scoring: add obstacle progress — for clearBoxes goals score += min(need, r.clearedBoxes), ice likewise. randomPolicy unchanged.
- Smoke: simulate a hand-authored boxy test level (inline in test) — greedy wins ≥ some floor; determinism.

### Task 6: Author + calibrate kitchen 011-020
- 15-25 move budgets, giftMoves 5, layouts using b/B/i (start gentle: 011 = few ice only; ramp to B-walls + mixed goals by 020; keep boards 6x6-7x7, colors 5-6).
- Same bands as decision #20 (greedy 0.60-0.95, random ≥ 0.15); run `npm run simulate -- levels/kitchen/0NN.json 500`; iterate; record in docs/superpowers/calibration/2026-07-02-kitchen-011-020.md; extend `src/sim/calibration.smoke.test.ts` ids list to 020 (30 runs, ≥0.4 stays).
- NOTE from plan-2 experience: obstacles gate collection, so longer budgets should now be calibratable at 5 colors; if random ≥0.15 fights greedy ≤0.95 again, use ice-heavy rather than box-heavy layouts (ice doesn't starve random as much).

### Task 7: Renderer (build-gated, no unit tests)
- theme.ts: `ob-box1` (brown crate: fillRoundedRect + darker cross-planks), `ob-box2` (same + metal band 0x7f8c8d), `ob-ice` (pale blue 0xa8d8ea rounded rect alpha ~0.85 with white cracks lines), `goal-box`/`goal-ice` reuse ob textures at HUD size.
- PlayScene:
  - syncBoard renders: ice layer sprites (depth 0.5, above tiles below gems) from board.ice; blockers as box sprites (texture by hp) depth 1; normal flow otherwise. Keep a parallel `iceSprites: Map<string, Sprite>` + boxes live in the main sprites map (texture key from piece kind).
  - textureKeyFor: blocker → `ob-box${hp}`.
  - animateStep: 'damage' → shake box sprite + swap texture to ob-box1 (hp2→1) + white flash pip; 'iceClear' → ice sprite crack-fade (alpha→0 scale 1.1, destroy, remove from iceSprites); 'clear' already pops boxes included in cells (particles white for boxes). Refill under boxes: cells whose spawn column is blocked below the top? Simply: if the refilled cell's row is NOT reachable by the drop column (blocker above it), use scale-pop 0→1 instead of drop-from-top; detect: any blocker in the same column above the cell.
  - Goal HUD: goal icons for clearBoxes/clearIce use goal textures; buildGoalHud switch on goal.type (collect → gem texture as today).
  - Levels list auto-includes 011-020 via glob.
- Gates + grep checks (damage case present, iceClear handled, HUD switch covers all goal types).

### Task 8: Final — full gates, whole-plan review (focus: resolve correctness with obstacles, no perf cliffs on 25-move sims, renderer lifecycle for ice/box sprites across restarts), merge, deploy green, site 200, ledger (decision #31: obstacle mechanics as fixed above; re-authored budgets note), calibration doc committed, mount sync, report.

## Self-review
- Decision #22 honored (longer budgets now possible); #20 bands reused; #16 board sizes ≤7x7; barrel/type ripples enumerated (SwapCheck/TurnResult/MoveOutcome reasons; applyCleared signature; Piece union pervasive — expect wide but mechanical test-helper updates in Task 0).
- Risk register: applyCleared signature change breaks existing tests intentionally (update them in Task 4); Piece union extension may surface exhaustive-switch errors (textureKeyFor, resolve) — fix exhaustively, never with default-case suppression.
