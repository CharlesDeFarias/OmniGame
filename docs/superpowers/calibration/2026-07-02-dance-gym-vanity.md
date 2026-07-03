# Calibration — dance 021-030, gym 031-040, vanity 041-050

Date: 2026-07-03 · Method: `npm run simulate -- <level> 500` (500 runs/policy, default seedBase; deterministic). Targets (decision #20): greedy win [0.60, 0.95]; random win ≥ 0.15. Budgets 15-25 moves. giftMoves 5 everywhere. Difficulty arc across chapters (plan 6.5): dance ≈ kitchen-011-020, gym harder, vanity hardest.

## Dance 021-030 (colorCount 5, b-boxes + ice; ice-heavy early, boxes mid, B end)

| level | board | colors | moves | goals | obstacles | greedy win | avgMoves | gift% | random win | shuffle% |
|---|---|---|---|---|---|---|---|---|---|---|
| 021 | 6x6 | 5 | 18 | ice 18 | 18i | 88.2% | 12.5 | 19.8% | 17.4% | 1.2-2.0% |
| 022 | 6x6 | 5 | 17 | ice 24 | 24i | 88.6% | 12.8 | 23.4% | 16.0% | 1.2-2.2% |
| 023 | 6x6 | 5 | 17 | boxes 4 + blue 30 | 4b | 90.6% | 15.1 | 32.8% | 29.6% | 2.8-4.6% |
| 024 | 7x7 | 5 | 19 | boxes 7 + green 42 | 7b | 93.4% | 15.5 | 21.0% | 17.4% | 0.4-1.0% |
| 025 | 6x6 | 5 | 20 | boxes 6 + purple 36 | 6b | 89.4% | 18.2 | 35.2% | 23.2% | 3.2-6.2% |
| 026 | 6x6 | 5 | 20 | ice 12 + yellow 32 | 12i | 88.0% | 16.5 | 24.6% | 19.2% | 1.6-3.0% |
| 027 | 6x6 | 5 | 21 | boxes 5 + ice 6 + red 34 | 5b 6i | 87.0% | 18.3 | 29.2% | 20.0% | 6.4-10.4% |
| 028 | 6x6 | 5 | 22 | boxes 4 + blue 38 | 4B | 90.4% | 19.6 | 29.8% | 21.2% | 5.4-7.0% |
| 029 | 6x6 | 5 | 21 | boxes 4 + ice 8 + red 24 + green 24 | 4B 8i | 90.6% | 15.4 | 16.2% | 30.0% | 4.8-8.2% |
| 030 | 6x6 | 5 | 23 | boxes 6 + ice 4 + purple 36 | 6B 4i | 92.8% | 19.2 | 21.6% | 29.0% | 12.0-18.6% |

All 10 inside both bands. Shuffle under the 20% ceiling (030 peaks ~18.6% on random, like kitchen-020).

Authoring note: open 7x7 boards at 5 colors would not calibrate for the chapter-end levels — greedy pins at 96-99% while any collect count high enough to pull it down starves the random floor (two-color collect at 5 colors is especially cheap: 2/5 of all matches count). Kitchen only tamed 7x7 endgames with a 6th color, which dance's spec disallows, so 029/030 were moved to 6x6 B-box boards (kitchen-017/018 profile) and landed immediately. The only 7x7 that works at 5 colors is the kitchen-014 profile: single-color collect + hp1 boxes (024).
