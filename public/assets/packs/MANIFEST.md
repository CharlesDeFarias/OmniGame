# Art packs manifest — RM-look milestone

All assets below are **CC0 1.0** (public domain dedication). Downloaded 2026-07-04.
Only the files we intend to use were copied from each source pack (originals kept in scratch, not in repo).
Total added size: ~2.1 MB across 72 files. No Royal Match / Dream Games material anywhere — genre conventions only, via original CC0 art.

## Sources

| Pack dir | Source pack | Author | Source URL | License |
|---|---|---|---|---|
| `gem-match-3-sylly/` | Gem Match 3 Set | Sylly | https://opengameart.org/content/gem-match-3-set | CC0 1.0 |
| `candy-match-3-melle/` | Candy Match 3 | MELLE (submitted by Luca Pixel) | https://opengameart.org/content/candy-match-3 | CC0 1.0 |
| `free-game-gui-pzuh/` | Free Game GUI | pzUH | https://opengameart.org/content/free-game-gui | CC0 1.0 |
| `heart-cdgramos/` | Heart 1 | cdgramos (submitted by soulwolf) | https://opengameart.org/content/heart-1 | CC0 1.0 |
| `kenney-particle-fx/` | Particle Pack | Kenney (kenney.nl) | https://kenney.nl/assets/particle-pack | CC0 1.0 |

Notes:
- OpenGameArt license verified on each art page (CC0 badge only; no dual/other licensing on the chosen entries).
- Kenney assets are CC0 site-wide; the particle-pack page carries the CC0 line.
- GUI sheets (`Button.png` 3999x3037, `Window.png` 4000x5000) and the candy sheet (700x700) were sliced here; individual elements were trimmed to alpha bounds and (for large panels) downscaled. Particle sprites downscaled 512 -> 256.

## Texture-key mapping

### Match-3 pieces — gem theme (`gem-match-3-sylly/gems/`)
Six glossy rimmed gems; shape AND color differ between confusable color pairs (CVD-friendly).

| File | Intended texture key | Piece |
|---|---|---|
| gem_blue.png | `piece.blue` | blue diamond (Type1) |
| gem_green.png | `piece.green` | green octagon (Type2) |
| gem_purple.png | `piece.purple` | purple/pink triangle (Type3) |
| gem_red.png | `piece.red` | red rounded square (Type4) |
| gem_yellow.png | `piece.yellow` | yellow diamond (Type1) |
| gem_black.png | `piece.extra` | black octagon (Type2) — 6th color if a level needs it |

### Match-3 pieces — candy theme (`candy-match-3-melle/gems/`)
Alternate piece theme (Candy-Crush-style, glossy). Each piece distinct in shape and color.

| File | Intended texture key |
|---|---|
| candy_orange.png | `piece.orange` (candy theme) |
| candy_blue.png | `piece.blue` |
| candy_red.png | `piece.red` (berry cluster) |
| candy_green.png | `piece.green` |
| candy_purple.png | `piece.purple` |
| candy_lollipop.png | `booster.colorbomb` (rainbow wheel) |
| striped/candy_<color>_striped_h.png | `booster.striped_h.<color>` (row clear) |
| striped/candy_<color>_striped_v.png | `booster.striped_v.<color>` (column clear) |

### Board obstacles (`candy-match-3-melle/tiles/`)

| File | Intended texture key | Use |
|---|---|---|
| tile_crate.png | `obstacle.box.hp2` | cracker = wooden-crate equivalent, full HP |
| tile_crate_cracked.png | `obstacle.box.hp1` | cracked state (matches core box hp<=2) |
| tile_crate_choco.png | `obstacle.box.variant` | decorated variant / reward crate |
| tile_ice.png | `obstacle.ice` | translucent glossy square |
| tile_frosting.png | `obstacle.ice.cap` | icing drip overlay (sits on top of a tile) |
| tile_chocolate.png | `obstacle.chocolate` | spreading-blocker candidate |
| tile_gift.png | `collectible.gift` | wrapped-gift collect target |

### Specials / FX pieces (`candy-match-3-melle/fx/`)

| File | Intended texture key |
|---|---|
| bomb.png | `booster.bomb` |
| candy_wrapped_h.png / candy_wrapped_v.png | `collectible.candy_gold` (collect targets / rewards) |

### Map / backgrounds (`candy-match-3-melle/map/`)

| File | Intended texture key | Use |
|---|---|---|
| bg_candyland.png | `bg.map` | saga-map / menu background (1024x768, winding path vista) |
| bg_candyland_blur.png | `bg.play` | in-level backdrop (blurred variant, board stays readable) |

### GUI (`free-game-gui-pzuh/ui/`)
Glossy cartoon set: cream panels + red ribbon banners + gold stars (closest CC0 match to the premium casual look).

| File | Intended texture key |
|---|---|
| btn_pill_blue/green/red/grey.png | `ui.btn.primary/confirm/danger/disabled` (pill; grey = disabled) |
| btn_sq_blue/green/red/grey.png | `ui.btn.sq.*` (blank square bases for custom glyphs) |
| btn_play_blue.png | `ui.btn.play` |
| btn_home_blue.png | `ui.btn.home` |
| btn_pause_blue.png | `ui.btn.pause` |
| btn_restart_blue.png | `ui.btn.replay` |
| btn_gear_blue.png | `ui.btn.settings` |
| btn_sound_blue.png / btn_sound_grey.png | `ui.btn.sound.on/off` (mute toggle) |
| btn_check_green.png | `ui.btn.ok` |
| btn_x_red.png | `ui.btn.close` |
| btn_lock.png | `ui.level.locked` (locked level node / chapter lock) |
| btn_arrow_blue.png | `ui.btn.next` |
| panel_plain.png | `ui.panel` (9-slice-able rounded cream panel) |
| panel_banner.png | `ui.panel.titled` (panel with red ribbon header) |
| banner_ribbon.png | `ui.banner` (standalone ribbon for titles) |
| star_gold_lg/md/sm.png | `ui.star.1/2/3` (win-screen stars) |
| progress_stars.png | `ui.progress.stars` (star-progress bar w/ counter) |
| progress_bar.png | `ui.progress` (generic bar) |
| counter_coins.png | `ui.counter.coins` (coin counter plate) |
| icon_coin_dollar.png | `ui.icon.coin` |

### Hearts (`heart-cdgramos/ui/`)

| File | Intended texture key |
|---|---|
| heart_red.png | `ui.icon.heart` (hearts currency, 125px glossy) |

### Particles (`kenney-particle-fx/fx/`)
White sprites, tint at runtime.

| File | Intended texture key |
|---|---|
| star_04.png / star_06.png / star_07.png | `fx.sparkle.1/2/3` (match-clear sparkles) |
| star_05.png / star_08.png | `fx.starburst.soft/hard` (combo bursts) |
| flare_01.png | `fx.glint` (gem shine sweep) |
| circle_05.png | `fx.glow` (soft glow under pieces/boosters) |
| twirl_02.png | `fx.swirl` (special-piece charge) |
