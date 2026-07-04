# Tower-conquest seed calibration — t01-t03 (2026-07-04)

Game #5 headless core seed (`src/core/tower/`, `src/sim/tower.ts`). JSON has no comments,
so per-level calibration lives here. Method: `simulateTower(level, 200, policy)` — fixed
seed schedule `level.seed + i * 7919`, fully deterministic (the smoke test in
`src/sim/tower.test.ts` reproduces these exact numbers). Policies: `greedySend` (take the
best winnable capture accounting for in-flight armies, else funnel rear troops to the
frontier), `randomSend` (a random legal half-send on ~1 tick in 4).

## Results (200 runs per cell)

| Level | Flavor | Towers | Policy | Ticks | Greedy win | Greedy avg ticks | Random win | Random avg ticks | Targets |
|-------|--------|--------|--------|-------|-----------|------------------|------------|------------------|---------|
| t01 | 3-tower line, tutorial | 3 | passive | 90 | 1.000 | 79.0 | 1.000 | 82.1 | greedy >= 0.9 ✔, random >= 0.5 ✔ |
| t02 | 5-tower diamond, hold-the-majority | 5 | defensive | 120 | 1.000 | 120.0 | 1.000 | 99.4 | greedy >= 0.9 ✔, random >= 0.2 ✔ |
| t03 | 7-tower spread, expanding enemy | 7 | aggressive | 240 | 1.000 | 45.9 | 0.510 | 240.0 | greedy >= 0.9 ✔, random >= 0.05 ✔ |

## Iteration log

- t01 unchanged from draft. Passive + generous timeout makes it structurally lose-proof:
  the enemy never sends, player towers can never flip (sends always leave >= 1 troop), so
  the timeout comparison can never favor the enemy. Random 1.000 is by construction —
  right feel for the tutorial (Luana-first).
- Draft t02 (2 enemy towers of 5): random 1.000 AND greedy never conquered — any single
  capture rode the generous timeout to a win, difficulty invisible. Third enemy tower
  added (east) so timeout demands real progress → greedy COLLAPSED to 0.000: enemy income
  3/tick vs player 2/tick, and a capture ping-pong — greedy takes a tower with a sliver
  remainder, the defensive counter (landing 1 tick later) flips it straight back.
- Fix: opener force + weaker enemy economy. home 12→24 troops, growth 2; enemy caps
  60→40; east made the designated first target (6 troops, growth 0, uniquely best margin).
  Greedy 0.000 → 1.000. maxTicks 150→120 (snappier; greedy's position locks early).
- t03 unchanged from draft. Greedy genuinely conquers (avg 45.9 ticks); random usually
  survives to timeout and wins the 0.510 that hold >= half the map.

## Calibration notes / levers

- **The generous timeout is the dominant lever.** Loss at maxTicks only if the enemy owns
  MORE towers, so "capture one tower and hold" is a winning line on t01/t02. Greedy's t02
  win is 100% the timeout path (avg ticks = maxTicks): defensive stalemates at the caps
  are intended — the level teaches "own more when the timer ends".
- Lever hierarchy so far: enemy tower COUNT (timeout comparison) > enemy growth income >
  starting garrisons > maxTicks. Growth caps matter more than starting troops in long
  games; merges may exceed maxTroops (only growth is capped), so funneling beats camping.
- Defender's structural disadvantage: a defensive reinforcement launched in reaction to a
  player send lands 1 tick AFTER the strike (both travel 2 ticks, but the AI reacts on the
  next tick). Deliberate generosity — first strike always meets the garrison, not the
  garrison plus reserves. Recalibrate everything if travel time or AI phase order changes.
- Aggressive AI leaks half its strongest tower every 6 ticks; on t03 that self-weakening
  is what keeps the random floor at 0.510 instead of near 0. A meaner cadence (every 4)
  is the first knob if t03 ever needs teeth.
- Random 1.000 on t01/t02 means the floors (0.5/0.2) have huge headroom — flailing play
  still wins the first two levels. The visible ramp only starts at t03. That is the
  Luana-layer intent, but it means t01→t02 difficulty is currently cosmetic.

## Design notes for the renderer review-queue entry

- **Drag UX:** spec says "drag arrows between towers". Open: tap-source-then-tap-target as
  an alternative for motor ease? Should an arrow stay latched (repeat send every N ticks,
  State.io-style) or one drag = one send? Core supports only single sends today — latching
  would be a renderer loop over `order()`. Cancel gesture for a mid-drag change of mind?
- **Army visuals:** in-flight armies are pure data {from, to, troops, ticksRemaining} with
  tower x/y (0-100) provided for interpolation. Dot swarms vs a single blob with a number?
  Luana reads numbers well — recommend blob + big count. 2-tick travel is FAST; renderer
  will want to stretch one tick over ~600-900ms and animate between.
- **Tick pacing:** core is tick-free by design (renderer paces). Pause ticks while a drag
  is in progress? (Recommended for the Luana layer — no time pressure mid-decision.)
- **Timeout generosity framing:** does a visible timer create anxiety? Option: no countdown
  shown, just a "day ends" moment where owning-the-most wins (matches the influencer skin:
  "most fans when the day ends"). Needs Charles's call.
- **Event → animation:** 'sent' (launch), 'arrived' reinforced/captured/defended/
  neutralized (merge sparkle / flip fanfare / bounce-off / grey-out), 'gameOver'.
  Neutralized-at-0 towers may read as odd — consider a distinct "empty tower" look.
- **Instant win edge:** the game ends the moment all towers are player-owned, even with an
  enemy army still in flight. Renderer should let that army fizzle cosmetically.
- **Ownership legibility:** three owners need instantly distinguishable colors + shapes
  (not color-only) under the studio-glam palette; towers are the only board furniture, so
  troop counts can be large type.
