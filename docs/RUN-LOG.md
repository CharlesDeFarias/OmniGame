- All pre-run questions answered; decisions #47-50 recorded. Starting plan 7 (design pass).
- Plan 7 design pass MERGED: studio-glam palette, glossy pieces, gold-framed UI, ring-light motifs, juice pass (bouncy falls, camera shake, flash rings), app renamed 'Luana Studio' with new icon. 254 tests, review approved. Deploying.
- Plan 8 MERGED: cooking game (10 real recipes: toast->mini-pizza; gather/act/assemble steps; never-fail; stars by mistakes) + HubScene front door with game cards. Cooking earns shared coins/xp. 280 tests, adversarially reviewed (engine probed with input storms + duplicate-layer cases). Deploying.
- Manager panel MERGED (assign real-world practice tasks by icon from the hub's hidden parent panel; rewards on completion). Review harness caught + fixed a LIVE regression: the stats corner had been instant-closing since July 2. 289 tests. Deploying.
- Adaptive v2 MERGED: rubber-band now injects obstacles at high tiers (sim-verified), never touches obstacle-goal levels, easing side unchanged. 299 tests. This closes decision #24 in full.
- Gate-runner core seed MERGED (game #3 staged headless: engine, validation, sim policies, 3 calibrated levels). 329 tests. Renderer awaits your design answers (review queue #20).
- Playlist infra MERGED: add music files in the hub parent panel (local IndexedDB), dance breaks play them with procedural fallback. 335 tests.
- RUN COMPLETE. Shipped this run: plan 7 design pass (studio-glam + 'Luana Studio' identity), plan 8 cooking game + hub, manager panel (+ fixed a live stats-corner regression), adaptive difficulty v2 (obstacle injection), gate-runner core seed (game #3 staged), her-playlist music infra. 254 -> 335 tests. All deployed, CI green. Everything left in the backlog needs Charles's input (see REVIEW-QUEUE.md, esp. items 10, 17, 20; plus: art references for the illustrated pass, groceries/shopping taste, gate-runner renderer answers).

## Run 2 (2026-07-04)
- Questions answered, decisions #51-54 recorded. Order: gate-runner renderer -> grocery runs -> serving mode+recipes -> tower core seed -> config split.
- Gate-runner MERGED and playable: hub card, 3 levels, swipe lanes, revival moment, stars+coins. Core recalibrated for the feel package (all doc numbers reviewer-reproduced). 353 tests. Deploying.
- Grocery runs + serving mode + 5 recipes MERGED (pantry star-protection, 3-customer serving rounds, 15 recipes total). 372 tests. Deploying.
- Tower-conquest core seed MERGED (game #5 staged headless, calibrated, 402 tests). Renderer awaits design answers.
- Profile config split MERGED: one-file personal layer (src/config/profile.ts) + PUBLIC-BUILD.md guide. 404 tests.
- RUN 2 COMPLETE. Shipped: gate-runner PLAYABLE (feel package #51), grocery runs (#52), serving mode + recipes 11-15, tower-conquest core seed (game #5 staged), profile config split (#54). 335 -> 404 tests. All merged, CI green, deploys rolling. Awaiting Charles: review queue now 29 items (key: #22 play the runner, #23 economy feel, #26 serving, tower renderer Qs in its calibration doc).
- Plan 9 legit-look pass MERGED: Fredoka typography, gradient/shadow texture v2, ambient backgrounds, fade transitions, button press feel, hub logo + splash. 404 tests. Deploying.
- Plan 10 RM-read milestone MERGED: CC0 pro art everywhere (pieces/boosters/obstacles/GUI), saga map home screen, RM HUD anatomy, asset preloader with fallbacks, PWA precache fixed. 409 tests. Deploying.
- Plan 10.5 RM parity MERGED: royal-blue palette, RM HUD anatomy v2, booster bar, pre-level booster picker + win-streak freebies, goal-seeking propellers. RM-PARITY.md tracks every modeled element. 429 tests. Deploying.

## Run 3 — overnight RM feel deep pass (2026-07-04)
- Decision #58 recorded. Queue: SFX acquisition -> booster choreography -> signature mechanics -> font/buttons/pause -> in-level boosters -> map dressing. Boundary: behavior/mechanics/CC0 only.
- SFX + font MERGED: 16 real CC0 sounds wired with procedural fallback; Lilita One for big numbers. (Run continued 2026-07-09 from HANDOFF.md on a fresh clone.)
- Block 1 MERGED: booster choreography. Rockets streak and shake the camera, TNT sparks a fuse then booms with a shockwave, the color ball zaps its targets one by one, propellers fly a real arc, ball+ball flashes the whole board. Cascades tick upward in pitch, pops rotate 3 sounds, pieces thud on landing. Core now annotates WHICH booster fired (zero RNG change — calibration proven intact). 435 tests.
- Block 2 MERGED: the two RM signature moments. Collected pieces fly to their goal icon and tick the counter on landing; winning with moves left converts them to bonus rockets that fire one by one (+3 coins each, cap 8). 443 tests.
- Block 3 MERGED: the bottom booster bar is ALIVE. Hammer (80c) smashes any one piece, row-arrow (100c) clears a row, shuffle is free. Tap to arm (gold ring), tap the board to fire. No move consumed. Review caught a charge-ordering bug — a failed restart no longer eats coins. 454 tests.
- Block 4 MERGED: gear button opens a proper pause sheet — big green resume, replay, back to map, sound toggle, and a new haptics (vibration) toggle. Review caught a drag-onto-gear input leak.
- Block 5 MERGED: map dressing v2 — glossy round level buttons, the current one bounces, bigger chapter banner, drifting haze + twinkles, and page dots so 2-page chapters read as pages (queue #33). Review caught a Phaser API misuse (yoyoEase doesn't exist) that would have silently dropped the bounce.
- RUN 3 COMPLETE: merged to main + deployed. 429 -> 454 tests. Queue items 37-44 await Charles (booster feel, finale economy, assist prices, pause-replay generosity, page dots). Next big look lever: a paid match-3 GUI pack (itch.io / GraphicRiver, $10-25, Charles's purchase).

## Run 5 — full-Kenney look + sibling canon (2026-07-10, Charles live-iterating)
- Asset-planning research (docs/research/) led to decision #60: ONE Kenney CC0 family app-wide. Board pieces are now shape-characters with faces (triple-coded: color+shape+face), all GUI is UI Pack v2 blue, glyph buttons composited at preload, four old art packs deleted. Decision #61: sibling-duo canon — Luana the rising influencer, brother the mayor/manager, visible in the manager panel + map cameo.
- Charles iterated live, 3 rounds: pieces resized to fit cells; popups moved to a light cream sheet with unstroked dark ink (the stroke was the mud); power-ups redrawn (cartoon rocket, dynamite bundle, six-color ball); board rebuilt as solid navy grid cells with real grid lines inside a warm Adventure-pack frame; hub cards on family panels; textTier 'minimal' turned ON (hub cards say Puzzle/Cooking, pills say Play); both siblings wear rectangular glasses, the mayor has a beard.
- Adversarial review caught the dimensional-coupling class: star pops at 1/3 size, every coin squashed (15 sites), win stars/buttons shrunk 2x — all converted to explicit display sizes.
- MERGED to main + deployed. Next (Charles's picks, research-backed): cooking rebuilt as a Burger-Party-style order-stack diner (design reference only — GPL code untouched; old recipe flow preserved for future reuse; economy stays), runner replaced with a jetpack-style game (Ourcade MIT template as design/stack reference).

## Run 7 — match-3 MVP pass (2026-07-11, Charles's refocus)
- TYPOGRAPHY ROOT CAUSE: Lilita One (the chunky display font) never rendered since run 3 — a duplicate CSS @font-face registered a second, forever-unloaded face, and canvas text silently fell back to Fredoka. Found by a new boot diagnostic, fixed by removing the CSS declaration, verified by canvas measurement. Every big number in the game changes appearance with this fix.
- Ghost-letter popups killed at the class level: stats overlay, parent panel, playlist rows (review caught the third) were drawing cream/white text on the cream panel; all light-panel text now uses dark unstroked ink (TS.onLight).
- Match-3-path polish: real flat ribbon banner for the win screen + chapter banner; map backdrop is a sharp horizon strip under a drawn sky (was a fuzzy 1.8x crop).
- MVP-CHECKLIST.md defines done: Charles's 2-minute smoke protocol on the deployed build, then Luana plays levels 1-5 — the gate. Everything else (diner/jetpack polish, town backgrounds, queue #49 persistence) explicitly waits.

## Run 6 — mini-game rebuilds (2026-07-10, decision #62)
- DINER MERGED as the cooking game: customers walk in with picture-stack orders, tap ingredients to build bottom-to-top, wrong taps bounce off harmlessly (pantry shield eats the first one), serve for coins + tips, 5-customer shifts, stars by mistakes. Same coin payout as the old flow; the 15-recipe system is preserved unrouted. Review caught bell-mash mistakes + a ramp that could open on the tallest dish — both fixed with tests.
- JETPACK MERGED as the runner: hold anywhere to fly, release to fall; 3 fixed-length runs; coins thread the safe gaps; hits cost hearts with blink-invincibility; hearts-out ends the run early with everything kept (never a fail screen). Old gate-runner preserved unrouted.
- Queue items 47-48 collect Charles's playtest questions (loop feel, physics speed, star migration).

## Run 4 — calibration + debt pass (2026-07-10)
- Kitchen level 10 recalibrated (queue #35 RESOLVED): the random-policy floor was really 13.9% at high sample counts (below the 15% design floor). One yellow tile less (12+11+11) puts it back at 15.8% with the finale difficulty unchanged (greedy ~71%). Levels 4 and 5 re-sampled at n=2000: both safely in band, untouched.
- Wardrobe 'owned' marker is now the real check icon instead of a text glyph (last near-zero-text violation from plan 7). Two other carry-forwards (stats-list overflow, dead goalHud field) verified already fixed.
