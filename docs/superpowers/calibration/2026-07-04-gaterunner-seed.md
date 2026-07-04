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
