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
