# Art packs manifest — the Kenney family (decision #60, 2026-07-10)

All assets below are **CC0 1.0** (public domain dedication) — legally safe to sit in this public repo.
Only the files we use were copied from each source pack (source zips re-downloadable, not committed).
No Royal Match / Dream Games material anywhere — RM is modeled in MECHANICS/layout/palette only (docs/RM-PARITY.md); the art is Kenney's.
The retired OpenGameArt packs (Sylly gems, MELLE candy, pzUH GUI, cdgramos heart) were removed this pass — one family now (docs/ART-BIBLE.md).

## Sources

| Pack dir | Source pack | Author | Source URL | License |
|---|---|---|---|---|
| `kenney2/ui/` | UI Pack v2.0 | Kenney (kenney.nl) | https://kenney.nl/assets/ui-pack | CC0 1.0 |
| `kenney2/icons/` | Game Icons | Kenney | https://kenney.nl/assets/game-icons | CC0 1.0 |
| `kenney2/shape/` | Shape Characters | Kenney | https://kenney.nl/assets/shape-characters | CC0 1.0 |
| `kenney2/toon/` | Toon Characters | Kenney | https://kenney.nl/assets/toon-characters | CC0 1.0 |
| `kenney2/misc/coin.png` | Puzzle Pack 2 | Kenney | https://kenney.nl/assets/puzzle-pack-2 | CC0 1.0 |
| `kenney2/misc/bg-map.png` | Starter Kit Match-3 (background) | Kenney | https://github.com/KenneyNL/Starter-Kit-Match-3 | CC0 1.0 (assets; kit code MIT, unused) |
| `kenney-particle-fx/` | Particle Pack | Kenney | https://kenney.nl/assets/particle-pack | CC0 1.0 |

Kenney assets are CC0 site-wide; each page carries the CC0 line.

## Texture-key mapping

### Match-3 pieces (`kenney2/shape/`, composited at preload)
Body + face are baked into one `img-shape-<color>` canvas per color. Triple-coded identity
(color + body shape + face) — CVD-friendly and readable for Luana.

| Piece color | Body file | Face file |
|---|---|---|
| red | red_body_circle.png | face_a.png |
| blue | blue_body_square.png | face_b.png |
| green | green_body_rhombus.png | face_c.png |
| yellow | yellow_body_squircle.png | face_g.png |
| purple | purple_body_circle.png | face_d.png |
| 'orange' | pink_body_square.png | face_e.png (pink serves orange: the set has no orange body) |

Specials (`img-sp-*`), obstacles (`img-ob-*`), banner, and heart resolve to the PROCEDURAL
flat textures (theme.ts) via PreloadScene FALLBACKS aliases — drawn to match the family.

### GUI (`kenney2/ui/` + `kenney2/icons/`)

| File(s) | Texture key(s) |
|---|---|
| <theme>_button_rectangle_depth_gradient.png (blue/green/red/grey) | `img-ui-btn-pill-<theme>` |
| <theme>_button_square_depth_gradient.png (blue/green/red/grey) | `img-ui-btn-sq-<theme>` |
| blue_button_rectangle_flat.png | `img-ui-panel-blue` (the cream panel is procedural `ui-panel-cream`) |
| blue_arrow_decorative_e.png (2x variant) | `img-ui-next` |
| yellow_star.png | `img-ui-star`, `img-ui-star-sm` |
| grey_star_outline.png | `img-ui-star-slot` |
| blue/green/grey_button_round_depth_gradient.png + a glyph | composited at preload into `img-ui-play/retry/home/settings/sound-on/sound-off/lock/ok` |
| icons/gear,home,audioOn,audioOff,locked,checkmark.png | glyph inputs (`k2-glyph-*`) for the composites |
| misc/coin.png | `img-ui-coin` |
| misc/bg-map.png | `img-bg-map` |
| panel_brown.png (UI Pack Adventure, CC0 — https://kenney.nl/assets/ui-pack-adventure) | `img-board-frame` (match-3 board 9-slice frame) |

### Siblings (`kenney2/toon/`, decision #61)

| File | Texture key |
|---|---|
| character_malePerson_idle.png | `img-toon-bro-idle` (manager panel + map cameo) |
| femalePerson idle/cheer0/cheer1/walk0 + malePerson cheer0/cheer1/walk0 | staged on disk, NOT loaded — reserved for the wardrobe rebuild (queue #46) |

### Particles (`kenney-particle-fx/fx/`)
White sprites, tint at runtime.

| File | Texture key |
|---|---|
| star_04/06/07.png | `img-fx-sparkle-1/2/3` |
| star_05/08.png | `img-fx-starburst-soft/hard` |
| flare_01.png | `img-fx-glint` |
| circle_05.png | `img-fx-glow` |
| twirl_02.png | `img-fx-swirl` |
