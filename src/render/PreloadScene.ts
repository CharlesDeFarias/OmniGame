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
const K2 = `${PACKS}/kenney2`;
const KFX = `${PACKS}/kenney-particle-fx/fx`;

/**
 * Loaded-image texture keys -> pack file. Decision #60: ONE Kenney CC0 family
 * app-wide (docs/ART-BIBLE.md). Existing 'img-*' key names are preserved so
 * scene code stays untouched; 'k2-*' keys are raw parts consumed by the
 * composite step in create() (round button + glyph -> one img-ui-* texture;
 * shape body + face -> one img-shape-<color> piece).
 *
 * Piece identity is triple-coded (color + body shape + face): red=circle,
 * blue=square, green=rhombus, yellow=squircle, purple=circle(face d),
 * 'orange'=pink square(face e) — the shape set has no orange body, same
 * substitution precedent as the old silver gem.
 *
 * Specials (sp-*), obstacles (ob-*), banner and heart now resolve to the
 * procedural flat textures via the FALLBACKS aliases below — the procedural
 * layer IS the primary art for those (drawn to match the family).
 */
export const ART_FILES: ReadonlyArray<readonly [string, string]> = [
  // --- Match-3 piece parts (composited in create) ---
  ['k2-body-red', `${K2}/shape/red_body_circle.png`],
  ['k2-body-blue', `${K2}/shape/blue_body_square.png`],
  ['k2-body-green', `${K2}/shape/green_body_rhombus.png`],
  ['k2-body-yellow', `${K2}/shape/yellow_body_squircle.png`],
  ['k2-body-purple', `${K2}/shape/purple_body_circle.png`],
  ['k2-body-orange', `${K2}/shape/pink_body_square.png`],
  ['k2-face-red', `${K2}/shape/face_a.png`],
  ['k2-face-blue', `${K2}/shape/face_b.png`],
  ['k2-face-green', `${K2}/shape/face_c.png`],
  ['k2-face-yellow', `${K2}/shape/face_g.png`],
  ['k2-face-purple', `${K2}/shape/face_d.png`],
  ['k2-face-orange', `${K2}/shape/face_e.png`],
  // --- GUI (Kenney UI Pack v2), direct keys ---
  ['img-ui-btn-pill-blue', `${K2}/ui/blue_button_rectangle_depth_gradient.png`],
  ['img-ui-btn-pill-green', `${K2}/ui/green_button_rectangle_depth_gradient.png`],
  ['img-ui-btn-pill-red', `${K2}/ui/red_button_rectangle_depth_gradient.png`],
  ['img-ui-btn-pill-grey', `${K2}/ui/grey_button_rectangle_depth_gradient.png`],
  ['img-ui-btn-sq-blue', `${K2}/ui/blue_button_square_depth_gradient.png`],
  ['img-ui-btn-sq-green', `${K2}/ui/green_button_square_depth_gradient.png`],
  ['img-ui-btn-sq-red', `${K2}/ui/red_button_square_depth_gradient.png`],
  ['img-ui-btn-sq-grey', `${K2}/ui/grey_button_square_depth_gradient.png`],
  ['img-ui-panel-blue', `${K2}/ui/blue_button_rectangle_flat.png`],
  ['img-ui-next', `${K2}/ui/blue_arrow_decorative_e.png`],
  ['img-ui-star', `${K2}/ui/yellow_star.png`],
  ['img-ui-star-sm', `${K2}/ui/yellow_star.png`],
  ['img-ui-star-slot', `${K2}/ui/grey_star_outline.png`],
  ['img-ui-coin', `${K2}/misc/coin.png`],
  // --- Round button bases + glyphs (composited in create) ---
  ['k2-round-blue', `${K2}/ui/blue_button_round_depth_gradient.png`],
  ['k2-round-green', `${K2}/ui/green_button_round_depth_gradient.png`],
  ['k2-round-grey', `${K2}/ui/grey_button_round_depth_gradient.png`],
  ['k2-glyph-play', `${K2}/ui/icon_play_light.png`],
  ['k2-glyph-repeat', `${K2}/ui/icon_repeat_light.png`],
  ['k2-glyph-gear', `${K2}/icons/gear.png`],
  ['k2-glyph-home', `${K2}/icons/home.png`],
  ['k2-glyph-audio-on', `${K2}/icons/audioOn.png`],
  ['k2-glyph-audio-off', `${K2}/icons/audioOff.png`],
  ['k2-glyph-lock', `${K2}/icons/locked.png`],
  ['k2-glyph-check', `${K2}/icons/checkmark.png`],
  // --- Siblings (decision #61) + diner customers (run 6). Remaining toon
  // poses stay staged on disk for the wardrobe rebuild (queue #46).
  ['img-toon-bro-idle', `${K2}/toon/character_malePerson_idle.png`],
  ['img-toon-cust-a', `${K2}/toon/character_femalePerson_idle.png`],
  ['img-toon-cust-b', `${K2}/toon/character_femalePerson_walk0.png`],
  // --- Board frame (UI Pack Adventure): warm brown 9-slice ---
  ['img-board-frame', `${K2}/ui/panel_brown.png`],
  // --- Backgrounds ---
  ['img-bg-map', `${K2}/misc/bg-map.png`],
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
  // Pieces: composited img-shape-* fall back to the procedural gems.
  ['img-shape-red', 'gem-red'], ['img-shape-blue', 'gem-blue'], ['img-shape-green', 'gem-green'],
  ['img-shape-yellow', 'gem-yellow'], ['img-shape-purple', 'gem-purple'], ['img-shape-orange', 'gem-orange'],
  // Specials/obstacles/banner/heart: the procedural flat textures ARE the
  // primary art now (decision #60) — these aliases are the wiring, not a net.
  ['img-sp-rocketH', 'sp-rocketH'], ['img-sp-rocketV', 'sp-rocketV'],
  ['img-sp-tnt', 'sp-tnt'], ['img-sp-lightball', 'sp-lightball'],
  ['img-ob-box1', 'ob-box1'], ['img-ob-box2', 'ob-box2'], ['img-ob-ice', 'ob-ice'],
  ['img-ui-heart', 'ui-heart'],
  ['img-ui-panel-banner', 'ui-panel'], ['img-ui-banner', 'ui-panel'],
  // Composited GUI buttons (round base + glyph): procedural equivalents cover
  // any missing input; the composite step skips when a part failed to load.
  ['img-ui-play', 'ui-play'], ['img-ui-retry', 'ui-retry'], ['img-ui-home', 'ui-home'],
  ['img-ui-lock', 'ui-lock'], ['img-ui-settings', 'ui-gear'],
  ['img-ui-sound-on', 'ui-sound-on'], ['img-ui-sound-off', 'ui-sound-off'],
  ['img-ui-ok', 'ui-check'],
  // Direct-loaded GUI: never-strand stand-ins.
  ['img-ui-star', 'ui-star'], ['img-ui-star-sm', 'ui-star'], ['img-ui-star-slot', 'ui-star'],
  // The cream panel is ALWAYS the light procedural sheet: Kenney's grey flat
  // was too dark for the dark-text overlays (picker/pause/stats readability).
  ['img-ui-panel-cream', 'ui-panel-cream'],
  ['img-ui-coin', 'ui-coin'], ['img-ui-panel-blue', 'ui-panel'],
  ['img-bg-map', 'ui-panel'], ['img-ui-btn-sq-grey', 'ui-panel'],
  ['img-ui-btn-sq-blue', 'ui-panel'], ['img-ui-btn-sq-green', 'ui-panel'],
  ['img-ui-btn-pill-green', 'ui-panel'], ['img-ui-next', 'ui-play'],
  // Booster-choreography fx (RM-feel pass): pip/glow stand-ins keep the
  // choreography running when the Kenney fx pack fails to arrive.
  ['img-fx-sparkle-1', 'ui-pip'], ['img-fx-sparkle-2', 'ui-pip'],
  ['img-fx-sparkle-3', 'ui-pip'], ['img-fx-glint', 'ui-pip'],
  ['img-fx-glow', 'ui-glow'], ['img-fx-starburst-hard', 'ui-ringlight'],
];

/** Composite recipes run in create(): base sprite + centered glyph -> one key. */
const COMPOSITES: ReadonlyArray<readonly [string, string, string]> = [
  ['img-ui-play', 'k2-round-green', 'k2-glyph-play'],
  ['img-ui-retry', 'k2-round-blue', 'k2-glyph-repeat'],
  ['img-ui-home', 'k2-round-blue', 'k2-glyph-home'],
  ['img-ui-settings', 'k2-round-blue', 'k2-glyph-gear'],
  ['img-ui-sound-on', 'k2-round-blue', 'k2-glyph-audio-on'],
  ['img-ui-sound-off', 'k2-round-grey', 'k2-glyph-audio-off'],
  ['img-ui-lock', 'k2-round-grey', 'k2-glyph-lock'],
  ['img-ui-ok', 'k2-round-green', 'k2-glyph-check'],
];

const PIECE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;

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
    // Composite step (decision #60): round button + glyph, shape body + face.
    // A missing input skips the recipe; the FALLBACKS loop then patches the key.
    for (const [key, base, glyph] of COMPOSITES) this.composite(key, base, glyph, 0.5);
    this.decorateBrother();
    // Pieces bake with padding (body 0.8 of canvas) so a full-bleed square
    // body still sits INSIDE its board cell instead of kissing its neighbors.
    for (const color of PIECE_COLORS) this.composite(`img-shape-${color}`, `k2-body-${color}`, `k2-face-${color}`, 0.42, 96, 0.8);
    for (const [img, proc] of FALLBACKS) {
      if (this.textures.exists(img) || !this.textures.exists(proc)) continue;
      const src = this.textures.get(proc).getSourceImage();
      if (src instanceof HTMLCanvasElement) this.textures.addCanvas(img, src);
    }
    goto(this, 'hub');
  }

  /** The mayor wears rectangular glasses + a short beard (decision #61,
   *  Charles's spec): baked onto the toon pose once at preload. Coordinates
   *  are tuned to the 96x128 Kenney toon head; skipped if the pose is absent. */
  private decorateBrother(): void {
    const key = 'img-toon-bro-idle';
    if (!this.textures.exists(key)) return;
    const src = this.textures.get(key).getSourceImage();
    if (!(src instanceof HTMLImageElement) && !(src instanceof HTMLCanvasElement)) return;
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.drawImage(src, 0, 0);
    const w = src.width;
    const h = src.height;
    // Short beard along the jaw, drawn first so the glasses sit above it.
    ctx.fillStyle = '#4a3222';
    ctx.beginPath();
    ctx.moveTo(w * 0.31, h * 0.34);
    ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.69, h * 0.34);
    ctx.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.31, h * 0.34);
    ctx.closePath();
    ctx.fill();
    // Rectangular glasses.
    ctx.strokeStyle = '#2c2c54';
    ctx.lineWidth = Math.max(2, w * 0.03);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const gy = h * 0.225;
    const gh = h * 0.08;
    const gw = w * 0.17;
    for (const gx of [w * 0.29, w * 0.545]) {
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeRect(gx, gy, gw, gh);
    }
    ctx.beginPath();
    ctx.moveTo(w * 0.46, gy + gh * 0.35);
    ctx.lineTo(w * 0.545, gy + gh * 0.35);
    ctx.stroke();
    this.textures.remove(key);
    this.textures.addCanvas(key, canvas);
  }

  /** Bake base + centered glyph into one square canvas texture under `key`. */
  private composite(key: string, baseKey: string, glyphKey: string, glyphRatio: number, size = 96, baseRatio = 0.98): void {
    if (this.textures.exists(key)) return;
    if (!this.textures.exists(baseKey) || !this.textures.exists(glyphKey)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    const draw = (k: string, maxRatio: number): void => {
      const img = this.textures.get(k).getSourceImage();
      if (!(img instanceof HTMLImageElement) && !(img instanceof HTMLCanvasElement)) return;
      const scale = (size * maxRatio) / Math.max(img.width, img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    };
    draw(baseKey, baseRatio);
    draw(glyphKey, glyphRatio);
    this.textures.addCanvas(key, canvas);
  }
}
