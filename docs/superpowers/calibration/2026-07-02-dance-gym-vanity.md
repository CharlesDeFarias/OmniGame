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

## Gym 031-040 (mix colorCount 5/6, B-boxes appear; harder)

| level | board | colors | moves | goals | obstacles | greedy win | avgMoves | gift% | random win | shuffle% |
|---|---|---|---|---|---|---|---|---|---|---|
| 031 | 6x6 | 5 | 16 | ice 20 | 20i | 87.4% | 12.1 | 24.8% | 16.4% | ~1.2% |
| 032 | 6x6 | 5 | 18 | boxes 8 + red 35 | 8b | 86.0% | 17.2 | 41.4% | 15.8% | 1.8-5.0% |
| 033 | 7x7 | 6 | 20 | boxes 6 + green 24 | 6b | 81.4% | 18.2 | 39.8% | 35.8% | 5.4-9.8% |
| 034 | 6x6 | 5 | 20 | boxes 4 + ice 8 + yellow 32 | 4B 8i | 85.8% | 17.8 | 32.2% | 15.8% | 4.0-9.4% |
| 035 | 7x7 | 6 | 21 | ice 14 + purple 24 | 14i | 87.0% | 18.1 | 30.4% | 23.2% | 4.8-7.4% |
| 036 | 6x6 | 5 | 21 | boxes 6 + red 39 | 6B | 82.2% | 20.1 | 42.0% | 17.8% | 11.8-17.4% |
| 037 | 7x7 | 6 | 22 | boxes 4 + ice 8 + blue 22 + purple 22 | 4B 8i | 87.0% | 19.2 | 32.2% | 19.8% | 7.2-14.4% |
| 038 | 6x6 | 5 | 22 | boxes 6 + ice 6 + green 34 | 6b 6i | 86.0% | 18.8 | 27.4% | 19.4% | 3.8-6.6% |
| 039 | 7x7 | 6 | 23 | boxes 6 + ice 4 + red 23 + yellow 23 | 6B 4i | 85.0% | 20.9 | 34.6% | 17.8% | 9.0-15.2% |
| 040 | 7x7 | 6 | 24 | boxes 6 + ice 8 + blue 28 | 6B 8i | 79.8% | 22.0 | 38.2% | 18.8% | 11.6-16.4% |

All 10 inside both bands; shuffle under 20% (036 random peaks ~17.4%). Chapter greedy range 79.8-87.4% vs the ~78-88 target.

## Vanity 041-050 (colorCount 6 common, B-walls, 3-4-goal mixes; hardest)

| level | board | colors | moves | goals | obstacles | greedy win | avgMoves | gift% | random win | shuffle% |
|---|---|---|---|---|---|---|---|---|---|---|
| 041 | 6x6 | 5 | 20 | boxes 4 + purple 37 | 4B | 83.4% | 18.6 | 38.6% | 20.0% | 4.2-6.0% |
| 042 | 7x7 | 6 | 21 | boxes 5 + ice 4 + red 26 | 5b 4i | 78.2% | 20.2 | 46.8% | 24.6% | 8.8-11.6% |
| 043 | 7x7 | 6 | 19 | ice 17 | 17i | 80.4% | 14.8 | 29.2% | 15.6% | 3.6-5.4% |
| 044 | 7x7 | 6 | 23 | boxes 6 + green 28 | 6B | 76.8% | 22.2 | 46.6% | 25.0% | 11.2-17.2% |
| 045 | 6x6 | 5 | 21 | boxes 4 + ice 4 + yellow 34 | 4B 4i | 85.6% | 19.1 | 34.8% | 16.0% | 11.6-16.2% |
| 046 | 7x7 | 6 | 22 | boxes 6 + ice 6 + purple 28 | 6B 6i | 70.0% | 21.7 | 52.4% | 16.2% | 12.0-18.0% |
| 047 | 7x7 | 6 | 23 | boxes 4 + ice 8 + red 25 + blue 25 | 4B 8i | 82.6% | 21.1 | 37.0% | 16.4% | 9.4-15.8% |
| 048 | 6x6 | 5 | 22 | boxes 6 + ice 8 + green 34 | 6B 8i | 86.6% | 19.3 | 31.4% | 16.6% | 12.8-17.8% |
| 049 | 7x7 | 6 | 23 | boxes 6 + ice 6 + yellow 25 + purple 25 | 6B 6i | 83.6% | 20.8 | 33.2% | 15.6% | 8.0-16.2% |
| 050 | 7x7 | 6 | 24 | boxes 6 + ice 8 + red 25 + blue 25 | 6B 8i | 85.2% | 21.4 | 31.8% | 16.2% | 10.6-18.2% |

All 10 inside both bands; shuffle under 20% (050 random peaks ~18.2%). Chapter greedy range 70.0-86.6%: three levels (045/048/050) sit 1-3 points above the soft ~84 ceiling because every tightening lever (collect +1-2, moves -1) dropped random below the hard 0.15 floor first — the floor binds before the soft target at 6-colors/multi-goal. Chapter averages still descend: dance ~89.8 > gym ~84.5 > vanity ~81.2.

## Levers learned (cross-chapter)

The 6th color is the strongest difficulty lever and the most dangerous: it cuts both policies' match rates, so greedy drops ~5-10 points but random often collapses through the 0.15 floor, and on 6x6 boards it sends shuffle rates to 30-49% — colorCount 6 belongs on 7x7 only (vanity-048's 6c/6x6 draft hit 49% shuffle; rebuilt at 5c with heavier obstacles). Open 7x7 boards at 5 colors are the opposite failure: greedy pins at 96-99% and only 6x6 B-boards or the boxes+single-collect profile calibrate (see dance note). Obstacle position matters as much as count: B-walls hugging board edges keep the center connected and cut random-policy shuffle from ~26% to ~15% at equal B counts; 6 B is the safe ceiling on 7x7 (8 edge-B still pushed random shuffle past 20%). Ice placement flips difficulty entirely — central ice clears incidentally (vanity-043's central-diamond draft: greedy 95%), edge/corner ice starves both policies (its full-ring draft: greedy 40%, random 3%); a central/edge mix tunes smoothly. Collect count stays the sharpest random-floor knob (±2 collect moves random win ~3-5 points at 6 colors, more than double its greedy effect), so when both bands squeeze, trade collect load for ice goals or a B — obstacles cost greedy more than random; ice remains the gentlest of all. Multi-goal (3-4 goals) works at 6 colors on 7x7 with kitchen-019/020-style counts (22-26 per color) and is the workhorse of gym/vanity endgames.
