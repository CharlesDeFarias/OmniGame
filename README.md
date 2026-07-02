# OmniGame

A personal omnibus of ad-free, non-exploitative casual games. First up: a Royal Match-style match-3 built for one very important player, with a configurable public layer underneath (theme packs, text tiers, difficulty profiles).

## Play

**https://charlesdefarias.github.io/OmniGame/** — on an Android phone: open the link in Chrome, tap the menu (⋮), then "Add to Home screen". It installs like an app and works offline after the first load.

## Status

**Playable match-3 PWA is live** (link above) — kitchen chapter, 10 simulator-calibrated levels, full booster set, procedural art and sound, installable and offline-capable. 111 tests across the deterministic logic core, headless simulator, and presentation helpers. Next: plan 4 — meta-progression (apartment furnishing, stars, profiles, stats screen).

## Development

```
npm install
npm run typecheck   # strict TS, no emit
npm test            # vitest suite
```

## Architecture

Logic cores are pure TypeScript with zero renderer imports; presentation will be a thin, swappable Phaser layer. All randomness flows through a seeded RNG — same seed, same game. Levels are JSON data (`levels/`), validated at load, calibrated by simulator. Design docs and decision log live in `docs/`.
