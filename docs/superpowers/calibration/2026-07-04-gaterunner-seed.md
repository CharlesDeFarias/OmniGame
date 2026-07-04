# Gate-runner seed calibration — r01-r03 (2026-07-04)

Game #3 headless core seed (`src/core/gaterunner/`, `src/sim/gaterunner.ts`). JSON has no
comments, so per-level calibration lives here. Method: `simulateGate(level, 200, policy)` —
fixed seed schedule `level.seed + i * 7919`, fully deterministic (the smoke test in
`src/sim/gaterunner.test.ts` reproduces these exact numbers).

## Results (200 runs per cell)

| Level | Flavor | Cols | Start | Bonus | Greedy win | Greedy avg score | Random win | Random avg score | Random floor |
|-------|--------|------|-------|-------|-----------|------------------|------------|------------------|--------------|
| r01 | gentle intro — mostly add gates, two small foes | 6 | 5 | 10 | 1.00 | 270 | 0.990 | 148 | > 0.60 ✔ |
| r02 | mixed — adds/muls vs mid foes and walls | 10 | 10 | 10 | 1.00 | 2100 | 0.415 | 119 | > 0.30 ✔ |
| r03 | spicy — muls guarded by big foes/walls | 12 | 8 | 15 | 1.00 | 31725 | 0.120 | 176 | >= 0.10 ✔ |

## Iteration log

- Draft r02 (start 8, foes 5-20): random 0.185 — foes shrunk (~30-40%) and start raised to 10 → 0.415.
- Draft r03 (start 6, foes 8-80): random 0.035 — three passes: foes softened to 4-30, start 8,
  two walls swapped for empties (d=2, d=8 breathers) → 0.075 → 0.090 → 0.105 → 0.120 final.
- r01 unchanged from draft (0.990).

## Calibration notes / levers

- **Greedy is trivially safe in this core:** lane choice is unconstrained per column and
  validation guarantees a gate-or-empty lane in every column, so greedy never loses squad
  and wins 100%. "Healthy margin" is structural, not tuned. Real difficulty pressure will
  come from the renderer layer (timing/lane-switch constraints) — see review queue.
- Lever hierarchy (mirrors match3 experience): late-column foe sizes dominate random win
  rate (survivor runs die late); early breather columns (empty lanes) are the gentlest lever;
  mul placement mostly moves score variance, not win rate.
- r03 random floor sits at 0.120 vs the 0.10 assert — deliberate thin-but-deterministic
  margin (fixed seeds; recalibrate if the RNG stream or wall/foe math ever changes).
- Greedy avg score explodes on mul chains (r03 ~31.7k at bonus 15). Score→coin conversion
  needs a curve or cap before this ties into the economy — flagged for the review queue.

## Feel package recalibration (2026-07-04, decision #51)

Engine semantics changed (adjacent-lane clamp, hard walls with deflect + head-on-only
crash damage, one-time revival to max(1, ceil(start/2)), coinsForScore = min(60,
20 + floor(sqrt(score)))). Policies re-run under the adjacency constraint (reachable
lanes only; greedy skips sideways wall lanes). Same method: 200 runs, fixed seed
schedule `level.seed + i * 7919`.

### Results (200 runs per cell) — NO level edits needed

| Level | Greedy win | Greedy avg score | Greedy coins/win | Random win | Random avg score | Targets |
|-------|-----------|------------------|------------------|------------|------------------|---------|
| r01 | 1.000 | 250 | 35.0 | 1.000 | 153 | random >= 0.60 ✔, greedy >= 0.80 ✔, coins 25-60 ✔ |
| r02 | 1.000 | 1100 | 53.0 | 0.750 | 225 | random >= 0.30 ✔, greedy >= 0.80 ✔, coins 25-60 ✔ |
| r03 | 1.000 | 6675 | 60.0 | 0.290 | 299 | random >= 0.10 ✔, greedy >= 0.80 ✔, coins 25-60 ✔ |

### Notes

- **Greedy 1.00 is now empirical, not structural.** Adjacency + hard walls can trap a
  myopic policy in principle, but none of r01-r03 punish it; the sim assert was lowered
  to the calibration floor (>= 0.80) accordingly. Recheck when levels get nastier.
- **Revival is the big softener for random play:** r01 0.990 → 1.000, r02 0.415 → 0.750,
  r03 0.120 → 0.290. Every run gets a second life, so single late-column foes no longer
  end survivor runs. The ramp is still clearly visible (1.00 / 0.75 / 0.29) and r01 being
  effectively lose-proof is the right feel for the gentle intro (Luana-first). Floors are
  now comfortable rather than thin — the old r03 0.120-vs-0.10 fragility note no longer
  applies.
- **Deflect made walls free when dodged into sideways** (bounce, resolve your own lane) —
  walls now shape routing instead of taxing it; only head-on crashes cost ceil(25%).
- **Score explosion tamed twice over:** adjacency limits mul-chaining (r03 greedy avg
  31,725 → 6,675) and coinsForScore caps payout at 60 (= match-3's per-win ceiling), so
  the "needs a curve or cap" flag from the seed pass is RESOLVED. Greedy coin band is
  35 / 53 / 60 — inside the 25-60 economy target; r03 sits exactly on the cap, which is
  intended (spicy level pays ceiling coins, never more).
- Random-play coins/win for reference: 31.6 / 35.2 / 46.4 — losses pay 0 (runGate),
  so real payouts stay economy-safe under any policy.
