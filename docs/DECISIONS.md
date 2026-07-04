# Decision log

One line of context per decision; newest last. Full reasoning lives in the specs.

| # | Date | Decision | Why |
|---|------|----------|-----|
| 1 | 2026-07-01 | MVP = match-3 only, for Luana, on Android phone + tablet | Her favorite genre; forces clean accessible design |
| 2 | 2026-07-01 | Web-first (PWA), wrap as Android app later | Fast iteration, no store friction; Capacitor/TWA later |
| 3 | 2026-07-01 | Phaser 3 over custom PixiJS or Godot | Batteries included; scope favors it. Escape hatch: logic cores stay pure TS, presentation swappable |
| 4 | 2026-07-01 | Fail states: gentle goals, forgiving limits ("losing makes winning fun"); difficulty becomes a setting later | Charles's call over pure no-fail relaxed mode |
| 5 | 2026-07-01 | Local folder + GitHub; GitHub Pages hosting | Backup, history, free hosting for the PWA |
| 6 | 2026-07-01 | Full superpowers discipline (spec → plan → TDD → review) | Long-lived multi-game project; protects pure logic core |
| 7 | 2026-07-01 | Canonical ledger: CLAUDE.md + this decision log | Matches Charles's cross-session handoff workflow |
| 8 | 2026-07-01 | Content packs + profiles system: theme packs, text tiers (none/minimal/full), personal vs generic profiles | Luana's version is a config, not a fork; public version later is another config |
| 9 | 2026-07-01 | MVP theme: classic gems pack; adult-objects pack built underneath | Familiarity for Luana now, theme switching later |
| 10 | 2026-07-01 | Meta-progression: apartment furnishing + life-milestone chapters | Direct Royal Match analog; embodies independence theme |
| 11 | 2026-07-01 | Near-zero text UI; pointing-hand tutorials | Luana reads at ~2nd-grade level; textier tiers configurable later |
| 12 | 2026-07-01 | Deterministic seeded RNG in logic core | Reproducible tests, replayable bugs, enables simulator |
| 13 | 2026-07-01 | Levels as JSON + headless simulator for difficulty calibration | "Losing makes winning fun" needs measured win rates, not guesses |
| 14 | 2026-07-01 | MVP assets: CC0 packs (Kenney etc.), licenses tracked in LICENSES.md | Fastest to playable; clean IP for future commercial use |
| 15 | 2026-07-01 | MVP cut = kitchen chapter + one room; perf target mid-range Android 2022+ | Ship to Luana early; later chapters are content, not code |
| 16 | 2026-07-01 | Motor accessibility: board size as difficulty lever (~7×7 start), drag + tap-tap swap, haptics | Touch-target size may matter more than any other choice for Luana |
| 17 | 2026-07-01 | Private on-device stats screen (hidden parent corner, never uploaded) | See where she struggles; seed difficulty tuning |
| 18 | 2026-07-01 | GitHub = git source of truth; sandbox commits/pushes; local folder is synced copy; CI runs tests on push | Cowork sandbox can't host .git in the mounted folder; CI protects against cross-session regressions |
| 19 | 2026-07-01 | Luana's narrative skin: becoming a famous influencer managed by brother Charles; side games themed around influencer learning/performing | Personal profile layer only; public layer keeps plain adult-life framing |
| 20 | 2026-07-01 | Difficulty bands: greedy-policy win 60-95%, random ≥15%, per level | Measurable definition of "losing makes winning fun" |
| 21 | 2026-07-01 | Kitchen 001-010 use 5-6 colors, 7-10 moves (not draft 4 colors/20-30 moves) | 4-color levels mathematically can't satisfy both bands; simulator-proven |
| 22 | 2026-07-01 | Current short move budgets are provisional — valid only for collect-only goals; re-author when obstacles land | Obstacles are what make 20-30-move levels possible |
| 23 | 2026-07-01 | Deadlock auto-shuffle in core; ShuffleError crash-loud in core, renderer must regenerate level | Never strand the player (plan-3 must-do) |
| 24 | 2026-07-01 | Adaptive difficulty (rubber-band): as Luana progresses, obstacles + failure rate increase unless she improves; below a loss threshold, ease off | Charles's direction; calibration bands + stats journal are the machinery; full DDA deferred to plan 4+ |
| 25 | 2026-07-01 | Deferred: play-time tracking with healthy-alternative nudges (movement breaks etc.) | Charles's direction; design later, don't block MVP |
| 26 | 2026-07-01 | Heavy LOCAL usage tracking in Luana's build (primary; maybe trial builds later): event journal hooks land in plan 3, analysis/adaptation later. Never uploaded | Adapt the game to her actual usage and needs over time |
| 27 | 2026-07-02 | MVP art/sound are procedural (distinct shape per gem color, WebAudio blips) instead of CC0 packs | Zero licensing/network risk; shape+color aids color-blind accessibility; theme-pack system makes swapping later trivial |
| 28 | 2026-07-02 | Phaser pinned to v3 (npm 'latest' resolves to v4) | Plan and knowledge target the battle-tested v3 API |
| 29 | 2026-07-02 | Star rules: 1=won via gift, 2=clean win with <25% budget left, 3=clean win with >=25% left | Simple, legible, rewards efficiency without punishing gift use |
| 30 | 2026-07-02 | Replan: plan 4=polish+stars, plan 5=obstacles+levels, plan 6=meta-layer | Old plan 4 was three plans; polish prioritized after Charles's playtest |
| 31 | 2026-07-02 | Obstacle mechanics: box max-1-damage-per-wave (adjacency + booster targets), blockers seal gravity segments and never shuffle, ice = terrain broken by the clearing piece (or destroyed box) above, refill pops in under sealed columns | Plan-5 fixed ruleset; simulator-verified over 8000 randomized turns |
| 32 | 2026-07-02 | Milestone themes for Luana's layer: dancing practice, exercise, makeup practice — framed as becoming a better influencer | Charles's direction; details being brainstormed for plan 6 |
| 33 | 2026-07-02 | A significant design/feel pass is planned (art direction, animation quality) — noted now, scheduled when appropriate | Charles's direction; current procedural look is a placeholder |
| 34 | 2026-07-02 | Influencer career = primary progression; apartment/adulting = supporting world | Charles's answer over pure-apartment or dashboard-only |
| 35 | 2026-07-02 | Four currencies: coins (spend-only-on-stuff, never gates play), followers (grow-only), hearts (social), influencer level (aggregate, unlocks) | Non-exploitative economy: currency creates choices, not pressure |
| 36 | 2026-07-02 | Furnishing pause points rotate the coin sink to groceries/shopping/FASHION (outfits feed video wardrobe) | She loves fashion games; keeps coins meaningful between rooms |
| 37 | 2026-07-02 | Video milestone = visual choices + tiny minigame; dance breaks ship with procedural beat, her playlist later (local, personal layer) | Combo per Charles; no music licensing on public URL |
| 38 | 2026-07-02 | Plan split: 6 = meta core (currencies/career screen/furnishing/video moment/adaptive difficulty v1), 6.5 = new themed chapters + packs, 7 = design pass | Keeps each plan shippable |
| 39 | 2026-07-02 | Chapter design: dance/gym/vanity unlock at influencer level 3/4/5; 10 levels each; per-chapter rooms, payout multipliers (1.25/1.5/1.75) and +5 coins/win per chapter index (economy-probe Option B) | Keeps room completable ~level 8-9 of each chapter with 15-25% leftover |
| 40 | 2026-07-02 | Wardrobe = the fashion coin sink: 6 outfits (80-220 coins), equipped outfit appears in video moments and dance breaks | Decision #36 realized; groceries/shopping sinks still open |
| 41 | 2026-07-02 | Vanity unlock threshold 1150 xp (was 1300) | Closes a 125-xp grind gap at 2-star reference pace (gym exhausts at ~1175) |
| 42 | 2026-07-02 | Storage keys keep .v1 names while carrying v2 payloads | Migration artifact, intentional — old saves are found under the historical keys |
| 43 | 2026-07-02 | Art direction (plan 7): Royal-Kingdom-inspired polish reskinned to adult/influencer — glossy beveled pieces, gold-framed UI, rich midnight/plum palette, ring-light + studio motifs. Inspiration only: no copied art/characters/trade dress | Charles's direction; executed procedurally now, real illustrated art later |
| 44 | 2026-07-02 | Cooking game: relaxed recipe assembly first (real recipes, step interactions, no timers); serving-rush mode later as difficulty layer | Charles's pick |
| 45 | 2026-07-02 | Autonomous-run protocol: full autonomy, continuous merge+deploy; EVERY judgment call logged in docs/REVIEW-QUEUE.md for Charles's post-hoc confirmation/correction | Charles leaving computer on for a long unattended run |
| 46 | 2026-07-02 | Unattended run order: plan 7 (design pass) -> plan 8 (cooking game + hub) -> if capacity: manager panel, playlist music, economy round-out | Design pass first so the cooking game inherits the new look |
| 47 | 2026-07-02 | Luana personalization: designer's choice defaults (warm pink-gold accents, brown-haired avatar) — logged for correction | Charles delegated |
| 48 | 2026-07-02 | Cooking recipes: simple everyday basics (toast, fruit salad, sandwich, eggs, pasta, pancakes, smoothie tier) | Charles's pick |
| 49 | 2026-07-02 | Her build is named 'Luana Studio' (config-driven appIdentity; public layer keeps a generic name) | Charles picked personal naming; exact name mine to propose |
| 50 | 2026-07-02 | Stretch order after design+cooking: manager panel first | Charles's pick |
| 51 | 2026-07-04 | Gate-runner feel: adjacent-lane-only swipes, walls hard-block, one-time squad revival on wipe (half of start squad), score->coins with soft cap targeting 20-60 coins/run | Charles picked the recommended package (queue #20 resolved) |
| 52 | 2026-07-04 | Grocery runs: coin-purchased picture shopping lists stock the pantry; a stocked recipe gets one free mistake (star protection) | Charles's pick; ties match-3 earnings to cooking |
| 53 | 2026-07-04 | Run 2 queue: gate-runner renderer, serving mode + ~5 recipes, tower-conquest core seed, grocery runs, public-layer config split. Card game deferred | Charles's selection |
| 54 | 2026-07-04 | Public layer this run = config split only (all Luana-specific values behind one profile config; generic build = one-file swap; no public deploy) | Charles's pick |
| 55 | 2026-07-04 | Legit-look pass (plan 9): Fredoka display font (OFL, self-hosted), banded-gradient + baked-shadow texture v2, smooth gradient backgrounds with bokeh ambience, camera fade transitions, press-down button feel, hub logo lockup + branded splash screen | Charles: 'feels very amateur' — typography/gradients/transitions are the official-feel levers |
| 56 | 2026-07-04 | RM-read milestone (plan 10): professional CC0 art packs (gems/candy/GUI/map/fx — sources in MANIFEST.md) replace procedural pieces+UI; saga-style MapScene is the match-3 home; RM HUD anatomy in-level. NO Royal Match assets copied (public repo = DMCA exposure + poisons future plans); the look is genre convention + CC0 art | Charles: procedural look failed twice; target = 'reads like Royal Match'; legal line drawn at ripped assets/characters/trade dress |

