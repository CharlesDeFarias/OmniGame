# Licenses

## Game assets

Game art was originally procedurally generated in this repository (see `scripts/make-icons.ts` and the render layer). As of the RM-look milestone, curated CC0 art packs are bundled under `public/assets/packs/` (see `public/assets/packs/MANIFEST.md` for the per-file texture-key mapping). The only other bundled third-party asset is the Fredoka typeface (below). Any future third-party assets must be CC0 (or an equally permissive license recorded here).

### Art packs (all CC0 1.0; the Kenney family since decision #60, 2026-07-10)

All visual packs are by Kenney (kenney.nl); crediting Kenney is appreciated but not required by CC0. The 2026-07-04 OpenGameArt packs (Sylly gems, MELLE candy, pzUH GUI, cdgramos heart) were retired and removed in the full-Kenney pass — see `docs/ART-BIBLE.md`.

- **UI Pack v2.0** — https://kenney.nl/assets/ui-pack — CC0 1.0 — themed buttons, panels, stars (`packs/kenney2/ui/`).
- **Game Icons** — https://kenney.nl/assets/game-icons — CC0 1.0 — interface glyphs (`packs/kenney2/icons/`).
- **Shape Characters** — https://kenney.nl/assets/shape-characters — CC0 1.0 — match-3 piece bodies + faces (`packs/kenney2/shape/`).
- **Toon Characters** — https://kenney.nl/assets/toon-characters — CC0 1.0 — the sibling avatars (`packs/kenney2/toon/`).
- **Puzzle Pack 2** — https://kenney.nl/assets/puzzle-pack-2 — CC0 1.0 — coin icon (`packs/kenney2/misc/coin.png`).
- **Starter Kit Match-3 (assets)** — https://github.com/KenneyNL/Starter-Kit-Match-3 — assets CC0 1.0 (kit code is MIT and NOT used) — map background (`packs/kenney2/misc/bg-map.png`).
- **Particle Pack** — https://kenney.nl/assets/particle-pack — CC0 1.0 — sparkle/glow/burst particle sprites (`packs/kenney-particle-fx/`).

### Sound effects (all CC0 1.0, downloaded 2026-07-04)

Bundled under `public/assets/audio/` (see `public/assets/audio/MANIFEST.md` for the per-file role mapping). All by Kenney (kenney.nl); crediting Kenney is appreciated but not required by the license.

- **Interface Sounds** — Kenney — https://kenney.nl/assets/interface-sounds — CC0 1.0 — clicks, ticks, drops, confirmations, glass pops.
- **Digital Audio** — Kenney — https://kenney.nl/assets/digital-audio — CC0 1.0 — pops, zaps, power-ups, tone sweeps.
- **Casino Audio** — Kenney — https://kenney.nl/assets/casino-audio — CC0 1.0 — chip clinks, card shuffles.
- **Impact Sounds** — Kenney — https://kenney.nl/assets/impact-sounds — CC0 1.0 — heavy impact booms.

### Fonts

- **Fredoka** — SIL Open Font License 1.1 — Copyright 2021 The Fredoka Project Authors (https://github.com/hafontia-zz/Fredoka) — obtained via Google Fonts (https://fonts.google.com/specimen/Fredoka). A latin-subset, variable-weight (300–700) woff2 build is redistributed in this repository at `public/fonts/fredoka-latin.woff2`. Full license text: https://openfontlicense.org
- **Lilita One** — SIL Open Font License 1.1 — Copyright 2011 The Lilita One Project Authors (Juan Montoreano, juan@remolinos.com.ar) — obtained via Google Fonts (https://fonts.google.com/specimen/Lilita+One). A latin-subset woff2 build (weight 400) is redistributed in this repository at `public/fonts/lilita-latin.woff2`. Full license text: https://openfontlicense.org

## Dependencies

### Runtime

- **phaser** — MIT — https://github.com/phaserjs/phaser/blob/master/LICENSE.md

### Development only (not shipped to players)

- **vite-plugin-pwa** — MIT — https://github.com/vite-pwa/vite-plugin-pwa/blob/main/LICENSE
- **pngjs** — MIT — https://github.com/pngjs/pngjs/blob/master/LICENSE
- **vite** — MIT — https://github.com/vitejs/vite/blob/main/LICENSE
- **vitest** — MIT — https://github.com/vitest-dev/vitest/blob/main/LICENSE
- **typescript** — Apache-2.0 — https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt
- **tsx** — MIT — https://github.com/privatenumber/tsx/blob/master/LICENSE
