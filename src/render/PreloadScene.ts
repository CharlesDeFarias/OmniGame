import Phaser from 'phaser';
import { goto } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { makeTextures } from './theme';
import { SFX_KEYS } from './audio';

/**
 * Asset preloader (RM-look milestone): loads every mapped PNG from the CC0
 * art packs (public/assets/packs, see MANIFEST.md there), shows a minimal
 * gold-on-blue progress bar, then bakes the procedural textures and hands
 * off to the hub. Runs exactly once — nothing ever restarts 'preload'.
 *
 * Paths are relative ('assets/...') so the browser resolves them against the
 * page URL; under the /OmniGame/ Pages base they land on /OmniGame/assets/...
 * with no extra config.
 *
 * This scene draws with plain Graphics only (no textures): it runs BEFORE any
 * texture exists, procedural or loaded.
 */

const PACKS = 'assets/packs';
const GEMS = `${PACKS}/gem-match-3-sylly/gems`;
const CANDY = `${PACKS}/candy-match-3-melle`;
const GUI = `${PACKS}/free-game-gui-pzuh/ui`;
const HEART = `${PACKS}/heart-cdgramos/ui`;
const KFX = `${PACKS}/kenney-particle-fx/fx`;

/**
 * Loaded-image texture keys ('img-*') -> pack file. Key names are NEW: the
 * procedural generators keep their old keys as a live fallback layer, and the
 * mapping functions (packs.ts / theme.ts) decide which family to hand out.
 *
 * Piece-color mapping judgments (Sylly gem set has no orange):
 * - 'yellow'  -> gem_yellow.png (reads gold/amber -- still the warm one).
 * - 'purple'  -> gem_purple.png (pink/magenta triangle).
 * - 'orange'  -> gem_black.png (silver/black octagon; the only unused file,
 *   hue-distinct from all five others; 'orange' only appears in 6-color levels).
 * Candy theme 'yellow' -> fx/candy_wrapped_h.png (gold wrapped candy: the
 * MELLE set ships only 5 plain candies).
 */
export const ART_FILES: ReadonlyArray<readonly [string, string]> = [
  // --- Match-3 pieces: gem theme (kitchen/gym/vanity) ---
  ['img-gem-red', `${GEMS}/gem_red.png`],
  ['img-gem-blue', `${GEMS}/gem_blue.png`],
  ['img-gem-green', `${GEMS}/gem_green.png`],
  ['img-gem-yellow', `${GEMS}/gem_yellow.png`],
  ['img-gem-purple', `${GEMS}/gem_purple.png`],
  ['img-gem-orange', `${GEMS}/gem_black.png`],
  // --- Match-3 pieces: candy theme (dance) ---
  ['img-candy-red', `${CANDY}/gems/candy_red.png`],
  ['img-candy-blue', `${CANDY}/gems/candy_blue.png`],
  ['img-candy-green', `${CANDY}/gems/candy_green.png`],
  ['img-candy-yellow', `${CANDY}/fx/candy_wrapped_h.png`],
  ['img-candy-purple', `${CANDY}/gems/candy_purple.png`],
  ['img-candy-orange', `${CANDY}/gems/candy_orange.png`],
  // --- Specials: red striped pair = rockets, bomb = tnt, lollipop = lightball.
  // Propeller keeps its procedural texture (no candy equivalent; judgment call).
  ['img-sp-rocketH', `${CANDY}/gems/striped/candy_red_striped_h.png`],
  ['img-sp-rocketV', `${CANDY}/gems/striped/candy_red_striped_v.png`],
  ['img-sp-tnt', `${CANDY}/fx/bomb.png`],
  ['img-sp-lightball', `${CANDY}/gems/candy_lollipop.png`],
  // Remaining striped colors: loaded for future per-color striped specials.
  ['img-striped-blue-h', `${CANDY}/gems/striped/candy_blue_striped_h.png`],
  ['img-striped-blue-v', `${CANDY}/gems/striped/candy_blue_striped_v.png`],
  ['img-striped-green-h', `${CANDY}/gems/striped/candy_green_striped_h.png`],
  ['img-striped-green-v', `${CANDY}/gems/striped/candy_green_striped_v.png`],
  ['img-striped-orange-h', `${CANDY}/gems/striped/candy_orange_striped_h.png`],
  ['img-striped-orange-v', `${CANDY}/gems/striped/candy_orange_striped_v.png`],
  ['img-striped-purple-h', `${CANDY}/gems/striped/candy_purple_striped_h.png`],
  ['img-striped-purple-v', `${CANDY}/gems/striped/candy_purple_striped_v.png`],
  // --- Board obstacles ---
  ['img-ob-box2', `${CANDY}/tiles/tile_crate.png`],
  ['img-ob-box1', `${CANDY}/tiles/tile_crate_cracked.png`],
  ['img-ob-box-choco', `${CANDY}/tiles/tile_crate_choco.png`],
  ['img-ob-ice', `${CANDY}/tiles/tile_ice.png`],
  ['img-ob-frosting', `${CANDY}/tiles/tile_frosting.png`],
  ['img-ob-chocolate', `${CANDY}/tiles/tile_chocolate.png`],
  ['img-collect-gift', `${CANDY}/tiles/tile_gift.png`],
  ['img-collect-candygold', `${CANDY}/fx/candy_wrapped_v.png`],
  // --- Backgrounds ---
  ['img-bg-map', `${CANDY}/map/bg_candyland.png`],
  // --- GUI (pzUH) ---
  ['img-ui-play', `${GUI}/btn_play_blue.png`],
  ['img-ui-retry', `${GUI}/btn_restart_blue.png`],
  ['img-ui-home', `${GUI}/btn_home_blue.png`],
  ['img-ui-lock', `${GUI}/btn_lock.png`],
  ['img-ui-pause', `${GUI}/btn_pause_blue.png`],
  ['img-ui-settings', `${GUI}/btn_gear_blue.png`],
  ['img-ui-sound-on', `${GUI}/btn_sound_blue.png`],
  ['img-ui-sound-off', `${GUI}/btn_sound_grey.png`],
  ['img-ui-ok', `${GUI}/btn_check_green.png`],
  ['img-ui-close', `${GUI}/btn_x_red.png`],
  ['img-ui-next', `${GUI}/btn_arrow_blue.png`],
  ['img-ui-btn-pill-blue', `${GUI}/btn_pill_blue.png`],
  ['img-ui-btn-pill-green', `${GUI}/btn_pill_green.png`],
  ['img-ui-btn-pill-red', `${GUI}/btn_pill_red.png`],
  ['img-ui-btn-pill-grey', `${GUI}/btn_pill_grey.png`],
  ['img-ui-btn-sq-blue', `${GUI}/btn_sq_blue.png`],
  ['img-ui-btn-sq-green', `${GUI}/btn_sq_green.png`],
  ['img-ui-btn-sq-red', `${GUI}/btn_sq_red.png`],
  ['img-ui-btn-sq-grey', `${GUI}/btn_sq_grey.png`],
  ['img-ui-panel-cream', `${GUI}/panel_plain.png`],
  ['img-ui-panel-banner', `${GUI}/panel_banner.png`],
  ['img-ui-banner', `${GUI}/banner_ribbon.png`],
  ['img-ui-star', `${GUI}/star_gold_lg.png`],
  ['img-ui-star-md', `${GUI}/star_gold_md.png`],
  ['img-ui-star-sm', `${GUI}/star_gold_sm.png`],
  ['img-ui-coin', `${GUI}/icon_coin_dollar.png`],
  ['img-ui-counter-coins', `${GUI}/counter_coins.png`],
  ['img-ui-progress', `${GUI}/progress_bar.png`],
  ['img-ui-progress-stars', `${GUI}/progress_stars.png`],
  // --- Hearts ---
  ['img-ui-heart', `${HEART}/heart_red.png`],
  // --- Particles (Kenney, white, tint at runtime) ---
  ['img-fx-sparkle-1', `${KFX}/star_04.png`],
  ['img-fx-sparkle-2', `${KFX}/star_06.png`],
  ['img-fx-sparkle-3', `${KFX}/star_07.png`],
  ['img-fx-starburst-soft', `${KFX}/star_05.png`],
  ['img-fx-starburst-hard', `${KFX}/star_08.png`],
  ['img-fx-glint', `${KFX}/flare_01.png`],
  ['img-fx-glow', `${KFX}/circle_05.png`],
  ['img-fx-swirl', `${KFX}/twirl_02.png`],
];

/**
 * Never-strand safety net: if a pack PNG fails to load (partial deploy, flaky
 * network), the loaded key is aliased to the equivalent procedural canvas so
 * every render call site still finds a texture. Only keys the scenes actually
 * reference need entries.
 */
const FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ['img-gem-red', 'gem-red'], ['img-gem-blue', 'gem-blue'], ['img-gem-green', 'gem-green'],
  ['img-gem-yellow', 'gem-yellow'], ['img-gem-purple', 'gem-purple'], ['img-gem-orange', 'gem-orange'],
  ['img-candy-red', 'gem-red'], ['img-candy-blue', 'gem-blue'], ['img-candy-green', 'gem-green'],
  ['img-candy-yellow', 'gem-yellow'], ['img-candy-purple', 'gem-purple'], ['img-candy-orange', 'gem-orange'],
  ['img-sp-rocketH', 'sp-rocketH'], ['img-sp-rocketV', 'sp-rocketV'],
  ['img-sp-tnt', 'sp-tnt'], ['img-sp-lightball', 'sp-lightball'],
  ['img-ob-box1', 'ob-box1'], ['img-ob-box2', 'ob-box2'], ['img-ob-ice', 'ob-ice'],
  ['img-ui-play', 'ui-play'], ['img-ui-retry', 'ui-retry'], ['img-ui-home', 'ui-home'],
  ['img-ui-lock', 'ui-lock'], ['img-ui-star', 'ui-star'], ['img-ui-coin', 'ui-coin'],
  ['img-ui-heart', 'ui-heart'], ['img-ui-panel-cream', 'ui-panel'],
  ['img-ui-panel-banner', 'ui-panel'], ['img-ui-banner', 'ui-panel'],
  // Map-scene keys (saga map, RM-look): panels stand in for buttons/bg,
  // procedural play/star cover the arrow and tiny stars.
  ['img-bg-map', 'ui-panel'], ['img-ui-btn-sq-grey', 'ui-panel'],
  ['img-ui-btn-sq-blue', 'ui-panel'], ['img-ui-btn-sq-green', 'ui-panel'],
  ['img-ui-btn-pill-green', 'ui-panel'], ['img-ui-next', 'ui-play'],
  ['img-ui-star-sm', 'ui-star'],
  // Booster-choreography fx (RM-feel pass): pip/glow stand-ins keep the
  // choreography running when the Kenney fx pack fails to arrive.
  ['img-fx-sparkle-1', 'ui-pip'], ['img-fx-glint', 'ui-pip'],
  ['img-fx-glow', 'ui-glow'],
];

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    // Minimal chrome: gold fill on a royal-blue track, gold hairline frame. The
    // index.html splash has already lifted (game READY), so this is the only
    // thing on screen for the sub-second the packs take on a warm cache.
    const w = 440;
    const h = 26;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT * 0.55;
    const track = this.add.graphics();
    track.fillStyle(PALETTE.bgPlum);
    track.fillRoundedRect(x, y, w, h, h / 2);
    track.lineStyle(3, PALETTE.gold, 0.9);
    track.strokeRoundedRect(x, y, w, h, h / 2);
    const fill = this.add.graphics();
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => {
      const fw = Math.max(h - 8, (w - 8) * v);
      fill.clear();
      fill.fillStyle(PALETTE.gold);
      fill.fillRoundedRect(x + 4, y + 4, fw, h - 8, (h - 8) / 2);
    });
    // A missing file must never strand the boot: log and keep going (the
    // FALLBACKS table patches the hole with procedural art in create()).
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[preload] failed to load ${file.key} (${file.url}); procedural fallback will cover it`);
    });
    for (const [key, url] of ART_FILES) this.load.image(key, url);
    // Sound effects (RM-feel milestone): CC0 oggs, see assets/audio/MANIFEST.md.
    // Same never-strand rule as the art: a failed file just logs (handler
    // above) and sfx() in audio.ts falls back to the procedural blips.
    for (const key of SFX_KEYS) this.load.audio(key, `assets/audio/${key}.ogg`);
  }

  create(): void {
    // Procedural layer stays: everything not yet replaced by pack art, plus
    // the fallback source for any pack file that failed to arrive.
    makeTextures(this, 96);
    for (const [img, proc] of FALLBACKS) {
      if (this.textures.exists(img) || !this.textures.exists(proc)) continue;
      const src = this.textures.get(proc).getSourceImage();
      if (src instanceof HTMLCanvasElement) this.textures.addCanvas(img, src);
    }
    goto(this, 'hub');
  }
}
