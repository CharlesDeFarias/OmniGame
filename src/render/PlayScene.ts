import Phaser from 'phaser';
import { PROFILE } from '../config/profile';
import { applyAssist, applyMove, findValidMoves, planFinale, startLevel, starsFor, FINALE_COINS_PER_ROCKET, ShuffleError } from '../core/match3/index';
import type { AssistKind, Coord, FinaleRocket, GameState, LevelDef, MoveOutcome, PieceColor, SpecialActivation } from '../core/match3/index';
import { CHAPTERS, chapterById, type ChapterId } from '../meta/chapters';
import { CHAPTER_COIN_BONUS_PER_INDEX } from '../meta/rooms';
import { createAdaptive, type Adaptive } from '../services/adaptive';
import { ASSIST_PRICES } from '../services/boosterShop';
import { createJournal, type Journal } from '../services/journal';
import { createIdbBackend, createMusicStore, type MusicStore } from '../services/music';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { summarize } from '../services/stats';
import { createWallet, type Wallet } from '../services/wallet';
import { createWardrobe, type Wardrobe } from '../services/wardrobe';
import { setPendingBoosters, takePendingBoosters } from './pendingBoosters';
import { createBlips, sfx, type Blips, type SfxKey } from './audio';
import { hapticsEnabled, setHapticsEnabled, vibrate } from './haptics';
import { EASE, planSteps, type Step } from './choreo';
import { buildBackground, fadeIn, goto, pressify } from './chrome';
import { BOTTOM_RESERVE, GAME_HEIGHT, GAME_WIDTH, TOP_RESERVE } from './config';
import { boardLayout, cellToXY, xyToCell, type Layout } from './layout';
import { loadLevels } from './levels';
import { pieceTextureKey, type PackId } from './packs';
import { PALETTE } from './palette';
import { COLOR_HEX, makeAvatarTexture, textureKeyFor } from './theme';
import { TS } from './textStyles';

const key = (c: Coord): string => `${c.x},${c.y}`;

/**
 * RM-anatomy-v2 HUD geometry (RM-parity pass). Board rect: top 331 for both
 * 6x6 and 7x7 boards (width-bound at cell 112.8/96.7 under TOP_RESERVE 220;
 * gold frame pad reaches ~311), bottom <= 1120 (BOTTOM_RESERVE 160).
 * - unified goals+moves panel top-CENTER: 128 tall centred at (360,150), so
 *   y 86..214; width 420/470/520 for 1/2/3 goals -> x 150..570 / 125..595 /
 *   100..620. Moves badge: white circle r54 at (panelLeft+84, 150). Panel
 *   left edge >= 100, so it clears the 90x90 parent hotspot at (45,45), and
 *   bottom 214 clears the board frame top (~311).
 * - coin strip: icon at (512,44), text from x 534 (clears the mute button at
 *   x 624..696, y 24..96).
 * - booster bar: 3 inert slots r52 at (240|360|480, 1215) -> y 1163..1267,
 *   below the board rect.
 */
const HUD_Y = 150;
const HUD_H = 128;
const HUD_W_BASE = 420;
const HUD_W_PER_GOAL = 50;
const BOOSTER_BAR_Y = 1215;

/** Particle tint from a sprite's texture key: '(img-)shape/gem/music-red' -> COLOR_HEX.red; crates -> brown; specials/unknown -> white. */
const tintForTexture = (texKey: string): number => {
  // The 'orange' piece is the PINK square in the Kenney shape set (no orange
  // body; decision #60), so its clear-particles go pink to match.
  if (texKey === 'img-shape-orange') return 0xec7cb5;
  const m = /^(?:img-)?(?:shape|gem|candy|music)-(\w+)$/.exec(texKey);
  if (m !== null) return COLOR_HEX[m[1] as PieceColor] ?? 0xffffff;
  return texKey.includes('ob-box') ? 0x9c6b30 : 0xffffff;
};

export class PlayScene extends Phaser.Scene {
  private levels: LevelDef[] = [];
  private chapter: ChapterId = 'kitchen';
  private state!: GameState;
  private layout!: Layout;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private iceSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private selected: Coord | null = null;
  private marker!: Phaser.GameObjects.Rectangle;
  private busy = false;
  private journal!: Journal;
  private progress!: ProgressData;
  private wallet!: Wallet;
  private wardrobe!: Wardrobe;
  private adaptive!: Adaptive;
  private blips!: Blips;
  private music!: MusicStore;
  private coinIcon!: Phaser.GameObjects.Sprite;
  private coinText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private goalHud: { icon: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text }[] = [];
  private pack: PackId = 'gems';
  private retryCount = 0;
  private activeBoosters: readonly import('../core/match3/index').SpecialKind[] = [];
  private downAt: { cell: Coord; px: number; py: number } | null = null;
  private backdrop: Phaser.GameObjects.GameObject[] = [];
  private hudPanels: Phaser.GameObjects.GameObject[] = [];
  private markerTween: Phaser.Tweens.Tween | null = null;
  private hand: Phaser.GameObjects.Sprite | null = null;
  private handTimer: Phaser.Time.TimerEvent | null = null;
  private movesMadeThisLevel = 0;
  private tutorialLogged = false;
  private secretTaps: number[] = [];
  private statsOverlay: Phaser.GameObjects.GameObject[] = [];
  private confetti: Phaser.GameObjects.Sprite[] = [];
  private wakeHooked = false;
  /** Round-robin index over the match-pop-N sfx variants. */
  private popCycle = 0;
  /** Goal-counter values as currently DISPLAYED (bumped by landing fliers, not state). */
  private goalDisplay: number[] = [];
  /** Fliers still arcing toward each goal icon. */
  private goalInFlight: number[] = [];
  /** Pending flier tweens; awaited at end of turn so win/lose never cuts one off. */
  private flightJobs: Promise<void>[] = [];
  /** Armed in-level assist awaiting a board tap (hammer/rowClear; shuffle fires instantly). */
  private assistArmed: Exclude<AssistKind, 'shuffle'> | null = null;
  private muteBtn!: Phaser.GameObjects.Sprite;
  /** Pause-sheet objects; non-empty = sheet open (blocks board input like the stats overlay). */
  private pauseSheet: Phaser.GameObjects.GameObject[] = [];
  /** Slot visuals per assist kind: base circle (tap target), icon, chip pieces, armed ring. */
  private assistSlots = new Map<AssistKind, {
    base: Phaser.GameObjects.Arc;
    icon: Phaser.GameObjects.Sprite;
    chip: Phaser.GameObjects.GameObject[];
    ring: Phaser.GameObjects.Arc;
    ringTween: Phaser.Tweens.Tween | null;
    wiggleTween: Phaser.Tweens.Tween | null;
  }>();

  constructor() {
    super('play');
  }

  create(): void {
    fadeIn(this);
    // Smooth studio-night gradient + ambient glow + bokeh (plan 9 legit-look).
    buildBackground(this, PALETTE.bgPlum, PALETTE.bgDeep, 0x081527);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.progress = loadProgress(window.localStorage);
    this.wallet = createWallet(window.localStorage);
    this.wardrobe = createWardrobe(window.localStorage);
    this.adaptive = createAdaptive(window.localStorage);
    this.blips = createBlips();
    this.music = createMusicStore(createIdbBackend());
    // Keep the screen awake during play (best effort; re-request when the tab returns).
    const requestWake = () => { try { void (navigator as Navigator & { wakeLock?: { request(type: string): Promise<unknown> } }).wakeLock?.request('screen').then(undefined, () => {}); } catch { /* ignore */ } };
    requestWake();
    if (!this.wakeHooked) {
      this.wakeHooked = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') requestWake();
      });
    }
    const startMuted = window.localStorage.getItem('omnigame.muted.v1') === '1';
    this.blips.setMuted(startMuted);
    this.muteBtn = this.add
      .sprite(GAME_WIDTH - 60, 60, startMuted ? 'img-ui-sound-off' : 'img-ui-sound-on')
      .setDisplaySize(72, 72)
      .setDepth(8)
      .setInteractive();
    pressify(this, this.muteBtn);
    this.muteBtn.on('pointerup', () => this.toggleMute());
    // Gear (block 4): pause sheet, top-right under the mute button, clear of
    // the goals panel (panel right edge <= 620; board top ~311).
    const gearBtn = this.add
      .sprite(GAME_WIDTH - 60, 152, 'img-ui-settings')
      .setDisplaySize(72, 72)
      .setDepth(8)
      .setInteractive();
    pressify(this, gearBtn);
    gearBtn.on('pointerup', () => this.openPause());
    this.chapter = this.progress.chapter;
    this.levels = loadLevels(this.chapter);
    this.marker = this.add
      .rectangle(0, 0, 10, 10)
      .setStrokeStyle(5, PALETTE.gold)
      .setFillStyle(0, 0)
      .setVisible(false)
      .setDepth(5);
    // RM anatomy v2: the moves number lives in a white circle badge inside
    // the top-center panel (positioned per level in buildGoalHud -- big dark
    // number on white, genre convention).
    this.movesText = this.add
      .text(0, -100, '', TS.numberTinted(56, '#0e1e3d'))
      .setOrigin(0.5)
      .setDepth(2);
    this.buildBoosterBar();
    // Hidden parent corner (decision #17): invisible top-left hotspot, 5 quick taps open the stats overlay.
    this.add
      .rectangle(45, 45, 90, 90, 0xffffff, 0.001)
      .setDepth(20)
      .setInteractive()
      .on('pointerdown', () => this.onSecretTap());
    // Coin counter: small strip in the very top-right corner, above the moves
    // badge (RM anatomy), left of the mute button which keeps the corner slot.
    // Coin icon is the pzUH dollar glyph (90x130): width scaled to keep aspect.
    this.coinIcon = this.add.sprite(512, 44, 'img-ui-coin').setDisplaySize(26, 26).setDepth(2);
    this.coinText = this.add
      .text(534, 44, String(this.wallet.data().coins), TS.number(24))
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.startCurrentLevel();
  }

  private currentDef(): LevelDef {
    const idx = Math.min(this.progress.levelIndexByChapter[this.chapter], this.levels.length - 1);
    const def = this.levels[idx]!;
    return this.retryCount === 0 ? def : { ...def, seed: def.seed + this.retryCount * 101 };
  }

  private startCurrentLevel(): void {
    this.select(null);
    this.disarmAssist();
    this.killHand();
    this.movesMadeThisLevel = 0;
    this.tutorialLogged = false;
    const def = PROFILE.features.adaptiveDifficulty ? this.adaptive.applyTier(this.currentDef()) : this.currentDef();
    this.pack = chapterById(this.chapter).packId;
    // Pre-level boosters staged by the map picker: taken exactly once (the
    // module clears on take), so retries and later levels start clean.
    const boosters = takePendingBoosters();
    this.activeBoosters = boosters;
    let started: GameState | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        started = startLevel({ ...def, seed: def.seed + attempt * 9999 }, { startBoosters: boosters });
        break;
      } catch (e) {
        if (e instanceof ShuffleError) {
          this.journal.log('shuffle_error', { level: def.id, phase: 'start', attempt });
          lastError = e;
          continue;
        }
        throw e;
      }
    }
    if (started === undefined) throw lastError;
    this.state = started;
    this.layout = boardLayout(
      GAME_WIDTH, GAME_HEIGHT,
      def.board.width, def.board.height,
      TOP_RESERVE, BOTTOM_RESERVE,
    );
    for (const t of this.backdrop) t.destroy();
    this.backdrop = [];
    for (let y = 0; y < def.board.height; y++) {
      for (let x = 0; x < def.board.width; x++) {
        const { px, py } = cellToXY(this.layout, x, y);
        // Board cells (Charles round-3): SOLID alternating navy cells with a
        // visible dark stroke = real grid lines, instead of ghost-alpha tiles.
        const tile = this.add
          .rectangle(px, py, this.layout.cell, this.layout.cell, (x + y) % 2 === 0 ? 0x1c3868 : 0x24437a, 0.95)
          .setStrokeStyle(2, 0x0e1e3d, 0.9)
          .setDepth(-1);
        this.backdrop.push(tile);
      }
    }
    // Board frame (Kenney UI Pack Adventure, decision #60): a warm brown
    // 9-slice panel behind the grid + a darker inner well the tiles sit in —
    // a DESIGNED board instead of the stretched gold hairline. 9-slice keeps
    // the 64px source's corners crisp at any board size. Never-strand: if the
    // panel didn't load, fall back to the old procedural frame.
    const framePad = this.layout.cell * 0.3;
    const boardW = this.layout.cell * this.layout.cols;
    const boardH = this.layout.cell * this.layout.rows;
    const bcx = this.layout.originX + boardW / 2;
    const bcy = this.layout.originY + boardH / 2;
    if (this.textures.exists('img-board-frame')) {
      // Brown Adventure frame; the inner well is a flat navy sheet the solid
      // grid cells sit on (the brown-on-brown well read muddy — round 3).
      this.backdrop.push(
        this.add.nineslice(bcx, bcy, 'img-board-frame', undefined, boardW + framePad * 2, boardH + framePad * 2, 20, 20, 20, 20).setDepth(-0.6),
        this.add.rectangle(bcx, bcy, boardW + framePad * 0.7, boardH + framePad * 0.7, 0x122647, 0.96).setDepth(-0.55),
      );
    } else {
      this.backdrop.push(
        this.add
          .image(bcx, bcy, 'ui-tile-frame')
          .setDisplaySize(boardW + framePad * 2, boardH + framePad * 2)
          .setAlpha(0.9)
          .setDepth(-0.5),
      );
    }
    this.journal.log('level_start', { level: def.id, chapter: this.chapter, retry: this.retryCount, tier: this.adaptive.state().tier, boosters });
    this.buildGoalHud();
    this.syncBoard();
    this.updateHud();
    this.showHand();
  }

  private buildGoalHud(): void {
    for (const g of this.goalHud) { g.icon.destroy(); g.txt.destroy(); }
    this.goalHud = [];
    for (const pnl of this.hudPanels) pnl.destroy();
    this.hudPanels = [];
    // RM anatomy v2 (RM-parity pass): ONE wide panel top-center -- the moves
    // count in a white circle badge on its LEFT, goal icons + remaining
    // counts to the right of it. Width adapts to the goal count.
    const n = this.state.goals.length;
    const w = HUD_W_BASE + Math.max(0, n - 1) * HUD_W_PER_GOAL;
    const left = GAME_WIDTH / 2 - w / 2;
    const movesX = left + 84;
    this.hudPanels.push(
      this.add.image(GAME_WIDTH / 2, HUD_Y, 'ui-panel').setDisplaySize(w, HUD_H).setAlpha(0.35).setDepth(0),
      // Warm halo behind the badge pulls the eye to the counter.
      this.add.image(movesX, HUD_Y, 'ui-glow').setDisplaySize(240, 240).setAlpha(0.15).setDepth(-0.4),
      this.add.circle(movesX, HUD_Y, 54, 0xffffff).setStrokeStyle(5, PALETTE.gold).setDepth(1),
    );
    this.movesText.setPosition(movesX, HUD_Y);
    // Goal columns, centered in the panel space right of the badge.
    const x0 = left + 160 + (w - 180 - n * 84) / 2 + 42;
    this.state.goals.forEach((gs, i) => {
      const iconKey =
        gs.goal.type === 'collect' ? pieceTextureKey({ kind: 'normal', color: gs.goal.color }, this.pack)
        : gs.goal.type === 'clearBoxes' ? 'img-ob-box1'
        : 'img-ob-ice';
      const cx = x0 + i * 84;
      const icon = this.add.sprite(cx, HUD_Y - 26, iconKey).setDisplaySize(54, 54).setDepth(2);
      const txt = this.add
        .text(cx, HUD_Y + 32, '', TS.number(34))
        .setOrigin(0.5)
        .setDepth(2);
      this.goalHud.push({ icon, txt });
    });
    // Fly-to-counter display state starts synced with the (fresh) core state.
    this.goalDisplay = this.state.goals.map((gs) => gs.collected);
    this.goalInFlight = this.state.goals.map(() => 0);
    this.flightJobs = [];
    // Streak flame: gold spark + win-streak count on the badge shoulder once
    // the streak reaches 3 (the free-booster threshold, adaptive.streakBonus).
    const streak = this.adaptive.state().streak;
    if (streak >= 3) {
      this.hudPanels.push(
        this.add.sprite(movesX + 48, HUD_Y - 40, 'img-fx-sparkle-1').setDisplaySize(48, 48).setTint(PALETTE.gold).setDepth(2),
        this.add.text(movesX + 48, HUD_Y - 40, String(streak), TS.number(22)).setOrigin(0.5).setDepth(3),
      );
    }
  }

  /**
   * RM anatomy, now LIVE (block 3): 3 tappable assist slots under the board.
   * Hammer (smash one chosen cell, 80c) and row-arrow (clear a chosen row,
   * 100c) arm on tap and apply on the next board tap; shuffle (free) fires
   * immediately. Price chips show numbers only (near-zero text).
   */
  private buildBoosterBar(): void {
    const slots: { kind: AssistKind; x: number; icon: string; iconSize: number }[] = [
      { kind: 'hammer', x: 240, icon: 'ui-hammer', iconSize: 62 },
      { kind: 'rowClear', x: 360, icon: 'img-ui-next', iconSize: 56 },
      { kind: 'shuffle', x: 480, icon: 'img-ui-retry', iconSize: 56 },
    ];
    for (const sl of slots) {
      const base = this.add.circle(sl.x, BOOSTER_BAR_Y, 52, PALETTE.panel, 0.85).setStrokeStyle(4, 0x8a93a6, 0.9).setDepth(2);
      const icon = this.add.sprite(sl.x, BOOSTER_BAR_Y, sl.icon).setDisplaySize(sl.iconSize, sl.iconSize).setDepth(2.1);
      // Armed indicator: gold ring, hidden until the slot arms.
      const ring = this.add.circle(sl.x, BOOSTER_BAR_Y, 58, 0x000000, 0).setStrokeStyle(6, PALETTE.gold, 1).setDepth(2.2).setVisible(false);
      const price = ASSIST_PRICES[sl.kind];
      const chip: Phaser.GameObjects.GameObject[] = [];
      if (price > 0) {
        chip.push(
          this.add.circle(sl.x + 34, BOOSTER_BAR_Y + 34, 20, PALETTE.gold).setStrokeStyle(3, 0xb8860b).setDepth(2.3),
          this.add.text(sl.x + 34, BOOSTER_BAR_Y + 34, String(price), TS.number(18)).setOrigin(0.5).setDepth(2.4),
        );
      }
      base.setInteractive();
      base.on('pointerup', () => this.onAssistSlotTap(sl.kind));
      this.assistSlots.set(sl.kind, { base, icon, chip, ring, ringTween: null, wiggleTween: null });
    }
  }

  private onAssistSlotTap(kind: AssistKind): void {
    if (this.busy || this.state === undefined || this.state.status !== 'playing') return;
    // A swipe that starts on the board and releases over a slot must not carry
    // its stale down-cell into onUp (same object-before-scene ordering as the
    // gear): arming is a deliberate two-step, never one gesture.
    this.downAt = null;
    sfx(this, 'click', { volume: 0.6 });
    if (kind === 'shuffle') {
      this.disarmAssist();
      void this.runAssist('shuffle').catch((e: unknown) => {
        this.journal.log('error', { where: 'runAssist', message: String(e) });
        this.busy = false;
      });
      return;
    }
    if (this.assistArmed === kind) {
      this.disarmAssist();
      return;
    }
    if (this.wallet.data().coins < ASSIST_PRICES[kind]) {
      this.wiggleSlot(kind);
      return;
    }
    this.disarmAssist();
    this.select(null);
    this.assistArmed = kind;
    const slot = this.assistSlots.get(kind);
    if (slot) {
      slot.ring.setVisible(true).setScale(1);
      slot.ringTween = this.tweens.add({ targets: slot.ring, scale: 1.08, duration: 340, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private disarmAssist(): void {
    if (this.assistArmed === null) return;
    const slot = this.assistSlots.get(this.assistArmed);
    if (slot) {
      slot.ringTween?.stop();
      slot.ringTween = null;
      slot.ring.setVisible(false).setScale(1);
    }
    this.assistArmed = null;
  }

  /** Can't-afford feedback: the whole slot (chip included) wiggles side to side.
   *  The previous wiggle is killed and positions restored first, so spamming the
   *  slot can't compound mid-tween offsets into a permanent displacement. */
  private wiggleSlot(kind: AssistKind): void {
    const slot = this.assistSlots.get(kind);
    if (slot === undefined) return;
    const parts = [slot.base, slot.icon, ...slot.chip] as (Phaser.GameObjects.GameObject & { x: number; setX(x: number): unknown })[];
    if (slot.wiggleTween !== null) {
      slot.wiggleTween.stop();
      const homeX = slot.ring.x;
      for (const part of parts) part.setX(part === slot.base || part === slot.icon ? homeX : homeX + 34);
    }
    const starts = parts.map((part) => part.x);
    slot.wiggleTween = this.tweens.add({
      targets: parts,
      x: '+=9',
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        slot.wiggleTween = null;
        parts.forEach((part, i) => part.setX(starts[i]!));
      },
    });
  }

  private updateHud(): void {
    this.movesText.setText(String(this.state.movesLeft));
    this.state.goals.forEach((gs, i) => {
      // While fliers are in the air the counter shows the display value; each
      // landing bumps it. Once the air clears, snap the display to the truth.
      const pending = (this.goalInFlight[i] ?? 0) > 0;
      if (!pending) this.goalDisplay[i] = gs.collected;
      this.paintGoalCount(i, pending ? this.goalDisplay[i]! : gs.collected);
    });
  }

  /** Paint one goal counter from a given collected value. */
  private paintGoalCount(i: number, collected: number): void {
    const gs = this.state.goals[i];
    const hud = this.goalHud[i];
    if (gs === undefined || hud === undefined) return;
    const remaining = Math.max(0, gs.goal.count - collected);
    hud.txt.setText(remaining === 0 ? '✓' : String(remaining));
    hud.txt.setColor(remaining === 0 ? '#54b842' : PALETTE.textOnDark);
  }

  private syncBoard(): void {
    for (const sp of this.sprites.values()) sp.destroy();
    this.sprites.clear();
    for (const sp of this.iceSprites.values()) sp.destroy();
    this.iceSprites.clear();
    const b = this.state.board;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const { px, py } = cellToXY(this.layout, x, y);
        if (b.ice[y * b.width + x] === true) {
          // Ice plates sit above the board tiles (-1) but below gems/boxes (1).
          const ice = this.add.sprite(px, py, 'img-ob-ice').setDisplaySize(this.layout.cell * 0.94, this.layout.cell * 0.94).setDepth(0.5);
          this.iceSprites.set(key({ x, y }), ice);
        }
        const piece = b.cells[y * b.width + x];
        if (piece === null || piece === undefined) continue;
        const sp = this.add.sprite(px, py, pieceTextureKey(piece, this.pack)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setDepth(1);
        this.sprites.set(key({ x, y }), sp);
      }
    }
  }

  private toggleMute(): void {
    const m = !this.blips.muted();
    this.blips.setMuted(m);
    this.muteBtn.setTexture(m ? 'img-ui-sound-off' : 'img-ui-sound-on');
    window.localStorage.setItem('omnigame.muted.v1', m ? '1' : '0');
  }

  // -------------------------------------------------------------------------
  // Pause sheet (block 4): RM anatomy — resume big and green, replay, map,
  // sound + haptics toggles. Icons and one number nowhere: near-zero text.
  // -------------------------------------------------------------------------

  private openPause(): void {
    if (this.pauseSheet.length > 0 || this.busy || this.statsOverlay.length > 0) return;
    if (this.state === undefined || this.state.status !== 'playing') return;
    sfx(this, 'click', { volume: 0.6 });
    this.journal.log('pause_open', { level: this.state.level.id });
    this.disarmAssist();
    this.select(null);
    this.downAt = null;
    const objs = this.pauseSheet;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(30)
      .setInteractive();
    const openedAt = this.time.now;
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.downTime > openedAt) this.closePause();
    });
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'img-ui-panel-cream').setDisplaySize(520, 680).setDepth(31));
    const button = (x: number, y: number, tex: string, size: number, onTap: () => void): Phaser.GameObjects.Sprite => {
      const b = this.add.sprite(x, y, tex).setDisplaySize(size, size).setDepth(32).setInteractive();
      pressify(this, b);
      b.on('pointerup', onTap);
      objs.push(b);
      return b;
    };
    // Resume: the big green one (RM anatomy) — a play glyph on a green pill.
    const pill = this.add.image(GAME_WIDTH / 2, 500, 'img-ui-btn-pill-green').setDisplaySize(300, 110).setDepth(31.5);
    objs.push(pill);
    button(GAME_WIDTH / 2, 500, 'ui-play', 76, () => this.closePause());
    // Replay + map (quit) side by side.
    button(GAME_WIDTH / 2 - 90, 660, 'img-ui-retry', 96, () => {
      this.closePause();
      this.journal.log('replay', { level: this.state.level.id, from: 'pause' });
      if (this.activeBoosters.length > 0) setPendingBoosters(this.activeBoosters);
      this.retryCount += 1;
      this.startCurrentLevel();
    });
    button(GAME_WIDTH / 2 + 90, 660, 'img-ui-home', 96, () => {
      this.closePause();
      this.journal.log('quit_to_map', { level: this.state.level.id, from: 'pause' });
      goto(this, 'map');
    });
    // Toggles: sound + (profile-gated) haptics. Off state = dimmed and greyed.
    const soundBtn = button(GAME_WIDTH / 2 - 90, 810, this.blips.muted() ? 'img-ui-sound-off' : 'img-ui-sound-on', 84, () => {
      this.toggleMute();
      soundBtn.setTexture(this.blips.muted() ? 'img-ui-sound-off' : 'img-ui-sound-on');
    });
    if (PROFILE.features.haptics) {
      const paintHaptics = (b: Phaser.GameObjects.Sprite): void => {
        const on = hapticsEnabled();
        b.setAlpha(on ? 1 : 0.45);
        if (on) b.clearTint();
        else b.setTint(0xaab2c4);
      };
      const hapticsBtn = button(GAME_WIDTH / 2 + 90, 810, 'ui-haptics', 84, () => {
        setHapticsEnabled(!hapticsEnabled());
        paintHaptics(hapticsBtn);
        vibrate(40);
      });
      paintHaptics(hapticsBtn);
    }
  }

  private closePause(): void {
    for (const o of this.pauseSheet) o.destroy();
    this.pauseSheet = [];
  }

  private onSecretTap(): void {
    const now = Date.now();
    this.secretTaps = this.secretTaps.filter((t) => now - t < 2500);
    this.secretTaps.push(now);
    if (this.secretTaps.length >= 5) {
      this.secretTaps = [];
      this.openStats();
    }
  }

  /** Parent-only stats overlay (text allowed here: parent-facing, not the player). */
  private openStats(): void {
    if (this.statsOverlay.length > 0) return;
    this.journal.log('stats_viewed', {});
    const stats = summarize(this.journal.read());
    const objs = this.statsOverlay;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(21)
      .setInteractive();
    const openedAt = this.time.now;
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.downTime > openedAt) this.closeStats();
    });
    objs.push(dim);
    // Parent-facing overlay on the light cream sheet.
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'img-ui-panel-cream').setDisplaySize(620, 1000).setDepth(22));
    // Light panel => dark unstroked ink (cream TS.number here was the
    // ghost-letter popup bug Charles kept hitting).
    const textStyle = TS.onLight(32);
    const header: { icon: string | null; value: string }[] = [
      { icon: 'img-ui-play', value: String(stats.levelsPlayed) },
      { icon: 'img-ui-star', value: String(stats.wins) },
      { icon: null, value: `${Math.round(stats.winRate * 100)}%` },
      { icon: 'ui-pip', value: String(stats.gifts) },
      { icon: 'img-ui-retry', value: String(stats.retries) },
      { icon: 'sp-propeller', value: String(stats.shuffles) },
    ];
    let y = 210;
    for (const row of header) {
      if (row.icon !== null) objs.push(this.add.sprite(250, y, row.icon).setDisplaySize(40, 40).setDepth(23));
      objs.push(this.add.text(300, y, row.value, textStyle).setOrigin(0, 0.5).setDepth(23));
      y += 58;
    }
    // Currencies + influencer level, read fresh from storage at open time.
    const walletNow = createWallet(window.localStorage);
    const w = walletNow.data();
    const currencies: { icon: string; value: string }[] = [
      { icon: 'img-ui-coin', value: String(w.coins) },
      { icon: 'ui-follower', value: String(w.followers) },
      { icon: 'img-ui-heart', value: String(w.hearts) },
      { icon: 'ui-levelbadge', value: String(walletNow.level()) },
    ];
    currencies.forEach((c, i) => {
      const cx = 130 + i * 150;
      objs.push(this.add.sprite(cx, y, c.icon).setDisplaySize(40, 40).setDepth(23));
      objs.push(this.add.text(cx + 30, y, c.value, textStyle).setOrigin(0, 0.5).setDepth(23));
    });
    y += 58;
    // Adaptive difficulty tier (signed), read fresh at open time.
    const tier = createAdaptive(window.localStorage).state().tier;
    objs.push(this.add.sprite(250, y, 'ui-levelbadge').setDisplaySize(40, 40).setTint(0x888899).setDepth(23));
    objs.push(this.add.text(300, y, tier > 0 ? `+${tier}` : String(tier), textStyle).setOrigin(0, 0.5).setDepth(23));
    y += 58;
    y += 16;
    // Per-level results as a compact 5-column grid so up to 50 levels fit the panel:
    // number + earned stars below; past 25 entries, denser number+star-count text.
    const label = (id: string): string => id.replace(/^[a-z]+-/, '');
    const entries = Object.entries(stats.perLevel).sort(
      ([a], [b]) => parseInt(label(a), 10) - parseInt(label(b), 10),
    );
    const gridX = (i: number): number => 116 + (i % 5) * 122;
    if (entries.length > 25) {
      entries.forEach(([id, lv], i) => {
        const gy = y + Math.floor(i / 5) * 44;
        objs.push(
          this.add
            .text(gridX(i), gy, `${label(id)} ★${lv.bestStars}`, TS.onLight(22))
            .setOrigin(0.5)
            .setDepth(23),
        );
      });
    } else {
      entries.forEach(([id, lv], i) => {
        const cx = gridX(i);
        const gy = y + Math.floor(i / 5) * 66;
        objs.push(this.add.text(cx, gy, label(id), TS.onLight(24)).setOrigin(0.5).setDepth(23));
        for (let st = 0; st < Math.min(3, lv.bestStars); st++) {
          objs.push(this.add.sprite(cx - 22 + st * 22, gy + 26, 'img-ui-star').setDisplaySize(18, 18).setDepth(23));
        }
      });
    }
  }

  private closeStats(): void {
    for (const o of this.statsOverlay) o.destroy();
    this.statsOverlay = [];
  }

  /** Kill the tutorial hand and any pending re-arm timer. */
  private killHand(): void {
    if (this.handTimer !== null) {
      this.handTimer.remove();
      this.handTimer = null;
    }
    if (this.hand !== null) {
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }
  }

  /** Zero-text tutorial: hand loops from a valid move's start cell to its end cell (first level, first session, no moves yet). */
  private showHand(): void {
    if (!PROFILE.features.tutorialHand) return;
    if (this.chapter !== 'kitchen') return;
    const idx = Math.min(this.progress.levelIndexByChapter.kitchen, this.levels.length - 1);
    if (idx !== 0 || Object.keys(this.progress.completed).length !== 0 || this.movesMadeThisLevel !== 0) return;
    if (this.hand !== null) return;
    const move = findValidMoves(this.state.board)[0];
    if (move === undefined) return;
    if (!this.tutorialLogged) {
      this.tutorialLogged = true;
      this.journal.log('tutorial_shown', { level: this.state.level.id });
    }
    const ox = this.layout.cell * 0.25;
    const oy = this.layout.cell * 0.3;
    const a = cellToXY(this.layout, move.a.x, move.a.y);
    const b = cellToXY(this.layout, move.b.x, move.b.y);
    const hand = this.add.sprite(a.px + ox, a.py + oy, 'ui-hand').setDepth(7).setAlpha(0);
    this.hand = hand;
    const cycle = (): void => {
      if (!hand.active || this.hand !== hand) return;
      hand.setPosition(a.px + ox, a.py + oy).setAlpha(0);
      this.tweens.chain({
        targets: hand,
        tweens: [
          { alpha: 0.95, duration: 200 },
          { x: b.px + ox, y: b.py + oy, duration: 650, ease: 'Sine.easeInOut' },
          { alpha: 0, duration: 200 },
        ],
        onComplete: () => {
          this.time.delayedCall(500, cycle);
        },
      });
    };
    cycle();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.blips.unlock();
    if (this.statsOverlay.length > 0 || this.pauseSheet.length > 0) return;
    if (this.hand !== null) {
      this.killHand();
      // Re-arm: show again after 8s of inactivity while the condition still holds.
      this.handTimer = this.time.delayedCall(8000, () => {
        this.handTimer = null;
        this.showHand();
      });
    }
    if (this.busy || this.state === undefined || this.state.status !== 'playing') return;
    const cell = xyToCell(this.layout, p.x, p.y);
    if (cell === null) return;
    this.downAt = { cell, px: p.x, py: p.y };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    // Sheet/overlay guard mirrors onDown: a drag released over the gear opens
    // the pause sheet via the object handler BEFORE this scene-level handler,
    // and the stale downAt must not turn into a swap behind the dim.
    if (this.pauseSheet.length > 0 || this.statsOverlay.length > 0) { this.downAt = null; return; }
    if (this.busy || this.downAt === null || this.state === undefined || this.state.status !== 'playing') return;
    const start = this.downAt;
    this.downAt = null;
    // An armed assist consumes the next board tap (tap or drag, RM-style).
    if (this.assistArmed !== null) {
      const kind = this.assistArmed;
      this.disarmAssist();
      void this.runAssist(kind, start.cell).catch((e: unknown) => {
        this.journal.log('error', { where: 'runAssist', message: String(e) });
        this.busy = false;
      });
      return;
    }
    const dx = p.x - start.px;
    const dy = p.y - start.py;
    const dragDist = Math.hypot(dx, dy);
    if (dragDist > this.layout.cell * 0.35) {
      const dir = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
      const target = { x: start.cell.x + dir.x, y: start.cell.y + dir.y };
      this.select(null);
      this.attemptSwap(start.cell, target).catch((e: unknown) => {
        this.journal.log('error', { where: 'attemptSwap', message: String(e) });
        this.busy = false;
      });
      return;
    }
    if (this.selected === null) {
      this.select(start.cell);
    } else if (this.selected.x === start.cell.x && this.selected.y === start.cell.y) {
      this.select(null);
    } else if (Math.abs(this.selected.x - start.cell.x) + Math.abs(this.selected.y - start.cell.y) === 1) {
      const a = this.selected;
      this.select(null);
      this.attemptSwap(a, start.cell).catch((e: unknown) => {
        this.journal.log('error', { where: 'attemptSwap', message: String(e) });
        this.busy = false;
      });
    } else {
      this.select(start.cell);
    }
  }

  private select(cell: Coord | null): void {
    this.selected = cell;
    if (this.markerTween !== null) {
      this.markerTween.stop();
      this.markerTween = null;
      this.marker.setScale(1);
    }
    if (cell === null) {
      this.marker.setVisible(false);
      return;
    }
    const { px, py } = cellToXY(this.layout, cell.x, cell.y);
    this.marker.setPosition(px, py).setSize(this.layout.cell * 0.98, this.layout.cell * 0.98).setVisible(true);
    this.markerTween = this.tweens.add({
      targets: this.marker,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 320,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private async attemptSwap(a: Coord, b: Coord): Promise<void> {
    // Note before the move resolves whether either tapped cell held a special:
    // a valid special-swap gets a light camera shake in runTurn.
    const board = this.state.board;
    const isSpecial = (c: Coord): boolean => {
      if (c.x < 0 || c.x >= board.width || c.y < 0 || c.y >= board.height) return false;
      const piece = board.cells[c.y * board.width + c.x];
      return piece !== null && piece !== undefined && piece.kind === 'special';
    };
    const specialSwap = isSpecial(a) || isSpecial(b);
    let out: MoveOutcome;
    try {
      out = applyMove(this.state, a, b);
    } catch (e) {
      if (e instanceof ShuffleError) {
        await this.shuffleRestart('move');
        return;
      }
      throw e;
    }
    if (out.invalid === true) {
      this.busy = true;
      try {
        this.journal.log('invalid_move', { level: this.state.level.id, reason: out.reason ?? 'unknown' });
        if (out.reason === 'no-match') await Promise.all([this.wiggle(a), this.wiggle(b)]);
      } finally {
        this.busy = false;
      }
      return;
    }
    await this.runTurn(out, specialSwap);
  }

  /** Friendly cue before a silent level restart after an unshufflable board:
   *  dim + spinning retry icon, boosters re-staged, retry counted. */
  private async shuffleRestart(phase: 'move' | 'assist'): Promise<void> {
    this.journal.log('shuffle_error', { level: this.state.level.id, phase });
    if (this.activeBoosters.length > 0) setPendingBoosters(this.activeBoosters);
    this.retryCount += 1;
    this.busy = true;
    const dim = this.overlay();
    const spinner = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'img-ui-retry').setDepth(11).setScale(1.22);
    await this.tweenAsync({ targets: spinner, angle: 360, duration: 900, ease: 'Cubic.easeInOut' });
    dim.destroy();
    spinner.destroy();
    this.startCurrentLevel();
    this.busy = false;
  }

  private wiggle(c: Coord): Promise<void> {
    const sp = this.sprites.get(key(c));
    if (sp === undefined) return Promise.resolve();
    return new Promise((resolve) => {
      this.tweens.add({ targets: sp, x: sp.x + 9, duration: 45, yoyo: true, repeat: 3, onComplete: () => resolve() });
    });
  }

  private tweenAsync(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  private async runTurn(out: MoveOutcome, specialSwap = false): Promise<void> {
    this.busy = true;
    if (specialSwap) this.cameras.main.shake(120, 0.004);
    this.movesMadeThisLevel += 1;
    this.state = out.state;
    this.journal.log('move', { level: this.state.level.id, movesLeft: this.state.movesLeft });
    let wave = 0;
    for (const step of planSteps(out.events)) {
      if (step.event.type === 'clear') {
        await this.animateStep(step, wave);
        wave += 1;
      } else {
        await this.animateStep(step);
      }
    }
    this.syncBoard();
    this.updateHud();
    if (out.gift !== undefined) {
      // Stage the move counter: show the pre-gift value while the pips fly in.
      this.movesText.setText(String(this.state.movesLeft - out.gift));
      this.journal.log('gift', { level: this.state.level.id, moves: out.gift });
      await this.celebrateGift(out.gift);
      this.updateHud();
    }
    // Let every goal flier land before the win/lose beat (and before input unblocks).
    if (this.flightJobs.length > 0) {
      await Promise.all(this.flightJobs);
      this.flightJobs = [];
      // Snap displays to truth: a spriteless cleared cell launches no flier, so
      // the lagging counter would otherwise stay stale through the win overlay.
      this.updateHud();
    }
    if (this.state.status === 'won') await this.onWin();
    else if (this.state.status === 'lost') await this.onLose();
    this.busy = false;
  }

  private async animateStep(step: Step, wave = 0): Promise<void> {
    const ev = step.event;
    switch (ev.type) {
      case 'swap': {
        const sa = this.sprites.get(key(ev.a));
        const sb = this.sprites.get(key(ev.b));
        const pa = cellToXY(this.layout, ev.a.x, ev.a.y);
        const pb = cellToXY(this.layout, ev.b.x, ev.b.y);
        const jobs: Promise<void>[] = [];
        if (sa) jobs.push(this.tweenAsync({ targets: sa, x: pb.px, y: pb.py, duration: step.duration, ease: EASE.swap }));
        if (sb) jobs.push(this.tweenAsync({ targets: sb, x: pa.px, y: pa.py, duration: step.duration, ease: EASE.swap }));
        await Promise.all(jobs);
        if (sa && sb) {
          this.sprites.set(key(ev.a), sb);
          this.sprites.set(key(ev.b), sa);
        }
        break;
      }
      case 'clear': {
        if (wave >= 1) sfx(this, 'cascade-tick', { rate: 1 + wave * 0.15 });
        const consumed = new Set<string>();
        const acts = ev.activations ?? [];
        if (acts.length > 0) await this.animateActivations(acts, ev.cells, consumed);
        const rest = ev.cells.filter((c) => !consumed.has(key(c)));
        const targets = rest.map((c) => this.sprites.get(key(c))).filter((s): s is Phaser.GameObjects.Sprite => s !== undefined);
        if (rest.length > 0) {
          const POPS: readonly SfxKey[] = ['match-pop-1', 'match-pop-2', 'match-pop-3'];
          sfx(this, POPS[this.popCycle++ % POPS.length]!);
          if (acts.length === 0 && ev.cells.length >= 6) {
            // Big plain cascade: a white ring bursts at each cleared cell (fire-and-forget).
            for (const c of rest) {
              const { px, py } = cellToXY(this.layout, c.x, c.y);
              const ring = this.add.sprite(px, py, 'ui-ringlight').setTint(0xffffff).setAlpha(0.7).setScale(0.2).setDepth(2);
              this.tweens.add({
                targets: ring,
                alpha: 0,
                scale: 1.2,
                duration: 250,
                ease: 'Quad.easeOut',
                onComplete: () => ring.destroy(),
              });
            }
          }
          for (const c of rest) {
            const src = this.sprites.get(key(c));
            if (src === undefined) continue;
            this.maybeFlyGoalPiece(c, src.texture.key);
          }
          for (const c of rest.slice(0, 12)) {
            const src = this.sprites.get(key(c));
            if (src === undefined) continue;
            this.burstPips(c, tintForTexture(src.texture.key), 4);
          }
          if (targets.length > 0) {
            await this.tweenAsync({ targets, scale: 0, alpha: 0, duration: step.duration, ease: 'Back.easeIn' });
          }
        }
        for (const c of ev.cells) {
          const sp = this.sprites.get(key(c));
          if (sp) { sp.destroy(); this.sprites.delete(key(c)); }
        }
        if (ev.cells.length > 0) vibrate(20);
        break;
      }
      case 'spawn': {
        const { px, py } = cellToXY(this.layout, ev.coord.x, ev.coord.y);
        const sp = this.add.sprite(px, py, pieceTextureKey(ev.piece, this.pack)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setScale(0).setDepth(1);
        this.sprites.set(key(ev.coord), sp);
        await this.tweenAsync({ targets: sp, scale: (this.layout.cell * 0.92) / 96, duration: step.duration, ease: 'Back.easeOut' });
        break;
      }
      case 'fall': {
        const moving: { sp: Phaser.GameObjects.Sprite; to: Coord }[] = [];
        for (const m of ev.moves) {
          const sp = this.sprites.get(key(m.from));
          if (sp) { moving.push({ sp, to: m.to }); this.sprites.delete(key(m.from)); }
        }
        const jobs = moving.map(({ sp, to }) => {
          const { px, py } = cellToXY(this.layout, to.x, to.y);
          return this.tweenAsync({ targets: sp, x: px, y: py, duration: step.duration, ease: EASE.fall });
        });
        for (const { sp, to } of moving) this.sprites.set(key(to), sp);
        await Promise.all(jobs);
        // One settle thunk per fall event, however many pieces dropped.
        if (moving.length > 0) sfx(this, 'piece-drop', { volume: 0.5 });
        break;
      }
      case 'refill': {
        // A blocker above the cell in the final board means the column is sealed
        // there: dropping from the top edge would pass through the crate, so
        // those fills pop in place instead. (this.state is the post-turn board.)
        const b = this.state.board;
        const sealed = (c: Coord): boolean => {
          for (let y = 0; y < c.y; y++) {
            const piece = b.cells[y * b.width + c.x];
            if (piece !== null && piece !== undefined && piece.kind === 'blocker') return true;
          }
          return false;
        };
        const jobs: Promise<void>[] = [];
        for (const f of ev.fills) {
          const { px, py } = cellToXY(this.layout, f.coord.x, f.coord.y);
          if (sealed(f.coord)) {
            const sp = this.add
              .sprite(px, py, pieceTextureKey(f.piece, this.pack))
              .setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92)
              .setScale(0)
              .setDepth(1);
            this.sprites.set(key(f.coord), sp);
            jobs.push(this.tweenAsync({ targets: sp, scale: (this.layout.cell * 0.92) / 96, duration: step.duration, ease: 'Back.easeOut' }));
            continue;
          }
          const sp = this.add
            .sprite(px, this.layout.originY - this.layout.cell, pieceTextureKey(f.piece, this.pack))
            .setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92)
            .setDepth(1);
          this.sprites.set(key(f.coord), sp);
          jobs.push(this.tweenAsync({ targets: sp, y: py, duration: step.duration, ease: 'Quad.easeOut' }));
        }
        await Promise.all(jobs);
        break;
      }
      case 'shuffle': {
        this.journal.log('shuffle', { level: this.state.level.id });
        const all = [...this.sprites.values()];
        await this.tweenAsync({ targets: all, alpha: 0, duration: step.duration / 2 });
        this.syncBoard();
        for (const sp of this.sprites.values()) sp.setAlpha(0);
        await this.tweenAsync({ targets: [...this.sprites.values()], alpha: 1, duration: step.duration / 2 });
        break;
      }
      case 'damage': {
        // Boxes losing hp but surviving: shake, swap to the damaged (hp1) crate
        // texture (hp is capped at 2, so any survivor is hp1), splinter pips.
        this.blips.matchAt(0);
        const jobs: Promise<void>[] = [];
        for (const c of ev.cells) {
          const sp = this.sprites.get(key(c));
          if (sp === undefined) continue;
          sp.setTexture(textureKeyFor({ kind: 'blocker', hp: 1 }));
          const { px, py } = cellToXY(this.layout, c.x, c.y);
          for (let i = 0; i < 3; i++) {
            const pip = this.add.sprite(px, py, 'ui-pip').setScale(0.9).setDepth(1);
            // Fire-and-forget: not awaited; each pip destroys itself on complete.
            this.tweens.add({
              targets: pip,
              x: px + (Math.random() * 2 - 1) * this.layout.cell * 0.6,
              y: py + (Math.random() * 2 - 1) * this.layout.cell * 0.6,
              alpha: 0,
              scale: 0.2,
              duration: 300,
              ease: 'Quad.easeOut',
              onComplete: () => pip.destroy(),
            });
          }
          jobs.push(this.tweenAsync({ targets: sp, x: sp.x + 7, duration: 50, yoyo: true, repeat: 1 }));
        }
        await Promise.all(jobs);
        break;
      }
      case 'iceClear': {
        // Fire-and-forget crack-fade; sprites leave the map immediately so a
        // syncBoard mid-tween can't double-destroy them.
        for (const c of ev.cells) {
          const ice = this.iceSprites.get(key(c));
          if (ice === undefined) continue;
          this.iceSprites.delete(key(c));
          this.tweens.add({
            targets: ice,
            alpha: 0,
            scale: ice.scale * 1.15,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => ice.destroy(),
          });
        }
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Booster choreography (RM-feel pass). Pure visuals: the core has already
  // resolved the wave; these methods just stage HOW the cleared cells leave.
  // Every popped sprite is removed from this.sprites immediately so the
  // generic cleanup at the end of the clear step can't double-destroy it.
  // -------------------------------------------------------------------------

  /** Small colored particle burst at a cell (fire-and-forget). */
  private burstPips(c: Coord, tint: number, count: number, spread = 0.8): void {
    const { px, py } = cellToXY(this.layout, c.x, c.y);
    for (let i = 0; i < count; i++) {
      const pip = this.add.sprite(px, py, 'ui-pip').setTint(tint).setScale(0.9).setDepth(1);
      this.tweens.add({
        targets: pip,
        x: px + (Math.random() * 2 - 1) * this.layout.cell * spread,
        y: py + (Math.random() * 2 - 1) * this.layout.cell * spread,
        alpha: 0,
        scale: 0.2,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => pip.destroy(),
      });
    }
  }

  /** Pop one cell's sprite after `delay` ms, with pips and an optional outward drift. */
  private popCell(c: Coord, delay: number, consumed: Set<string>, drift?: { dx: number; dy: number }): Promise<void> {
    const k = key(c);
    consumed.add(k);
    const sp = this.sprites.get(k);
    if (sp === undefined) return Promise.resolve();
    this.sprites.delete(k);
    const tint = tintForTexture(sp.texture.key);
    return new Promise((resolve) => {
      this.time.delayedCall(delay, () => {
        this.maybeFlyGoalPiece(c, sp.texture.key);
        this.burstPips(c, tint, 3, 0.6);
        this.tweens.add({
          targets: sp,
          scale: 0,
          alpha: 0,
          x: sp.x + (drift?.dx ?? 0),
          y: sp.y + (drift?.dy ?? 0),
          duration: 180,
          ease: 'Back.easeIn',
          onComplete: () => { sp.destroy(); resolve(); },
        });
      });
    });
  }

  /** White expanding shockwave ring (fire-and-forget). */
  private shockwave(px: number, py: number, scaleTo = 2, delay = 0): void {
    const ring = this.add.image(px, py, 'img-fx-glow').setTint(0xffffff).setAlpha(0.6).setScale(0.2).setDepth(3);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: scaleTo,
      duration: 320,
      delay,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Stage each fired special in order; `big` scales the drama up for combos. */
  private async animateActivations(acts: SpecialActivation[], cells: Coord[], consumed: Set<string>): Promise<void> {
    const inClear = new Set(cells.map(key));
    // Swapped combos share one targets array (resolve.ts hands both specials
    // the combined list) — that identity is the combo marker.
    const combo = acts.length >= 2 && acts[0]!.targets === acts[1]!.targets;
    if (combo && acts[0]!.special === 'lightball' && acts[1]!.special === 'lightball') {
      await this.animateBoardFlash(acts, inClear, consumed);
      return;
    }
    for (const [i, act] of acts.entries()) {
      const own = act.targets.filter((t) => inClear.has(key(t)) && !consumed.has(key(t)));
      // Only the swapped combo pair gets the big treatment, not chained specials.
      const big = combo && i < 2;
      switch (act.special) {
        case 'rocketH':
        case 'rocketV':
          await this.animateRocket(act.coord, act.special === 'rocketV', own, consumed, big);
          break;
        case 'tnt':
          await this.animateTnt(act.coord, own, consumed, big);
          break;
        case 'lightball':
          await this.animateLightball(act.coord, own, consumed);
          break;
        case 'propeller':
          await this.animatePropeller(act.coord, own, consumed);
          break;
      }
    }
  }

  /** Ball+ball: full-board white flash, then every CLEARED cell pops radially
   *  outward (surviving damaged boxes stay — they get the damage-event shake). */
  private async animateBoardFlash(acts: SpecialActivation[], inClear: Set<string>, consumed: Set<string>): Promise<void> {
    sfx(this, 'lightning-zap');
    sfx(this, 'explosion-boom', { delay: 0.12 });
    this.cameras.main.shake(220, 0.01);
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setDepth(9);
    await this.tweenAsync({ targets: flash, fillAlpha: 0.85, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    flash.destroy();
    const origin = cellToXY(this.layout, acts[0]!.coord.x, acts[0]!.coord.y);
    this.shockwave(origin.px, origin.py, 3.2);
    this.shockwave(origin.px, origin.py, 3.2, 100);
    const jobs: Promise<void>[] = [];
    for (const t of acts[0]!.targets) {
      if (!inClear.has(key(t))) continue;
      const { px, py } = cellToXY(this.layout, t.x, t.y);
      const d = Math.hypot(px - origin.px, py - origin.py);
      const s = d > 0 ? this.layout.cell * 0.35 / d : 0;
      jobs.push(this.popCell(t, d * 0.35, consumed, { dx: (px - origin.px) * s, dy: (py - origin.py) * s }));
    }
    await Promise.all(jobs);
  }

  /** Streak sweeping the full row/col + staggered pops rippling out from the rocket. */
  private async animateRocket(coord: Coord, vertical: boolean, own: Coord[], consumed: Set<string>, big: boolean): Promise<void> {
    sfx(this, 'rocket-whoosh');
    this.cameras.main.shake(100, big ? 0.008 : 0.005);
    const origin = cellToXY(this.layout, coord.x, coord.y);
    const cellPx = this.layout.cell;
    // Actual pixel extents of the swept line (cell centers of both endpoints).
    const n = vertical ? this.state.board.height : this.state.board.width;
    const start = vertical ? cellToXY(this.layout, coord.x, 0) : cellToXY(this.layout, 0, coord.y);
    const end = vertical ? cellToXY(this.layout, coord.x, n - 1) : cellToXY(this.layout, n - 1, coord.y);
    const lineLen = cellPx * n;
    const midX = (start.px + end.px) / 2;
    const midY = (start.py + end.py) / 2;
    // White bar the full length of the line, collapsing as the streaks pass.
    const bar = this.add.rectangle(midX, midY, vertical ? cellPx * 0.34 : lineLen, vertical ? lineLen : cellPx * 0.34, 0xffffff, 0.55).setDepth(2);
    this.tweens.add({ targets: bar, alpha: 0, [vertical ? 'scaleX' : 'scaleY']: 0.1, duration: 260, ease: 'Quad.easeOut', onComplete: () => bar.destroy() });
    // Two glint streaks racing from the rocket to each end of the line.
    for (const dir of [-1, 1] as const) {
      const streak = this.add.image(origin.px, origin.py, 'img-fx-glint').setTint(0xffffff).setAlpha(0.95).setDepth(3);
      streak.setDisplaySize(cellPx * 1.7, cellPx * 0.55);
      if (vertical) streak.setAngle(90);
      const to = dir === -1 ? (vertical ? start.py : start.px) : (vertical ? end.py : end.px);
      this.tweens.add({
        targets: streak,
        [vertical ? 'y' : 'x']: to + dir * cellPx * 0.5,
        alpha: 0.2,
        duration: 240,
        ease: 'Quad.easeIn',
        onComplete: () => streak.destroy(),
      });
    }
    // The rocket piece itself goes first, then cells pop outward in both directions.
    const jobs: Promise<void>[] = [this.popCell(coord, 0, consumed)];
    for (const t of own) {
      if (t.x === coord.x && t.y === coord.y) continue;
      const dist = Math.abs(vertical ? t.y - coord.y : t.x - coord.x);
      jobs.push(this.popCell(t, dist * 15, consumed));
    }
    await Promise.all(jobs);
  }

  /** Fuse spark on the bomb, then boom: shockwave + radial outward pops. */
  private async animateTnt(coord: Coord, own: Coord[], consumed: Set<string>, big: boolean): Promise<void> {
    const origin = cellToXY(this.layout, coord.x, coord.y);
    const bomb = this.sprites.get(key(coord));
    const spark = this.add.image(origin.px + this.layout.cell * 0.3, origin.py - this.layout.cell * 0.38, 'img-fx-sparkle-1')
      .setTint(0xffe08a).setScale(0.3).setDepth(3);
    this.tweens.add({ targets: spark, scale: 0.65, angle: 180, duration: 125, yoyo: true, repeat: 1, ease: 'Quad.easeInOut' });
    if (bomb) this.tweens.add({ targets: bomb, scale: bomb.scale * 1.12, duration: 125, yoyo: true, repeat: 1 });
    await new Promise<void>((resolve) => this.time.delayedCall(250, () => resolve()));
    spark.destroy();
    sfx(this, 'explosion-boom');
    this.cameras.main.shake(big ? 220 : 150, big ? 0.01 : 0.007);
    this.shockwave(origin.px, origin.py, big ? 2.8 : 2);
    if (big) this.shockwave(origin.px, origin.py, 2.8, 90);
    const jobs: Promise<void>[] = [this.popCell(coord, 0, consumed)];
    for (const t of own) {
      if (t.x === coord.x && t.y === coord.y) continue;
      const { px, py } = cellToXY(this.layout, t.x, t.y);
      const d = Math.hypot(px - origin.px, py - origin.py);
      const s = d > 0 ? this.layout.cell * 0.3 / d : 0;
      jobs.push(this.popCell(t, d * 0.12, consumed, { dx: (px - origin.px) * s, dy: (py - origin.py) * s }));
    }
    await Promise.all(jobs);
  }

  /** The lollipop pulses while zapping each target in sequence with a white flash. */
  private async animateLightball(coord: Coord, own: Coord[], consumed: Set<string>): Promise<void> {
    sfx(this, 'lightning-zap');
    const ball = this.sprites.get(key(coord));
    if (ball) {
      ball.setDepth(3);
      this.tweens.add({ targets: ball, scale: ball.scale * 1.18, duration: 130, yoyo: true, repeat: Math.max(1, Math.ceil(own.length / 8)) });
    }
    const jobs: Promise<void>[] = [];
    let i = 0;
    for (const t of own) {
      if (t.x === coord.x && t.y === coord.y) continue;
      const delay = i * 25;
      i += 1;
      const { px, py } = cellToXY(this.layout, t.x, t.y);
      const sp = this.sprites.get(key(t));
      const tint = sp ? tintForTexture(sp.texture.key) : 0xffffff;
      this.time.delayedCall(delay, () => {
        const flash = this.add.image(px, py, 'img-fx-glint').setTint(0xffffff).setAlpha(0.9).setScale(0.35).setDepth(3);
        this.tweens.add({ targets: flash, scale: 1, alpha: 0, duration: 160, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
        const zap = this.add.image(px, py, 'img-fx-sparkle-1').setTint(tint).setScale(0.28).setDepth(3);
        this.tweens.add({ targets: zap, scale: 0.75, alpha: 0, angle: 120, duration: 200, ease: 'Quad.easeOut', onComplete: () => zap.destroy() });
      });
      jobs.push(this.popCell(t, delay + 40, consumed));
    }
    await Promise.all(jobs);
    await this.popCell(coord, 0, consumed);
  }

  /** Lift-off, spin, and a bezier arc to the flown-to target; neighbors pop behind it. */
  private async animatePropeller(coord: Coord, own: Coord[], consumed: Set<string>): Promise<void> {
    sfx(this, 'propeller-whir');
    const origin = cellToXY(this.layout, coord.x, coord.y);
    const isAdj = (t: Coord): boolean => Math.abs(t.x - coord.x) + Math.abs(t.y - coord.y) === 1;
    // boosterTargets = 4 orthogonal neighbors + one flown-to pick; the pick is
    // the one non-adjacent target (adjacent picks just pop with the neighbors).
    const flight = own.find((t) => !isAdj(t) && !(t.x === coord.x && t.y === coord.y)) ?? null;
    const jobs: Promise<void>[] = [];
    let ni = 0;
    for (const t of own) {
      if (t === flight || (t.x === coord.x && t.y === coord.y)) continue;
      jobs.push(this.popCell(t, 120 + ni * 30, consumed));
      ni += 1;
    }
    const prop = this.sprites.get(key(coord));
    if (prop === undefined) {
      if (flight) jobs.push(this.popCell(flight, 200, consumed));
      jobs.push(this.popCell(coord, 0, consumed));
      await Promise.all(jobs);
      return;
    }
    consumed.add(key(coord));
    this.sprites.delete(key(coord));
    prop.setDepth(4);
    await this.tweenAsync({ targets: prop, scale: prop.scale * 1.35, duration: 140, ease: 'Back.easeOut' });
    if (flight) {
      const dest = cellToXY(this.layout, flight.x, flight.y);
      // Quadratic bezier via manual interpolation: control point offset
      // perpendicular to the flight line for a real arc.
      const mx = (origin.px + dest.px) / 2;
      const my = (origin.py + dest.py) / 2;
      const dx = dest.px - origin.px;
      const dy = dest.py - origin.py;
      const len = Math.max(1, Math.hypot(dx, dy));
      const cx = mx - (dy / len) * this.layout.cell * 2.2;
      const cy = my + (dx / len) * this.layout.cell * 2.2;
      const p = { t: 0 };
      this.tweens.add({ targets: prop, angle: 720, duration: 450, ease: 'Linear' });
      await this.tweenAsync({
        targets: p,
        t: 1,
        duration: 450,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          const u = 1 - p.t;
          prop.setPosition(
            u * u * origin.px + 2 * u * p.t * cx + p.t * p.t * dest.px,
            u * u * origin.py + 2 * u * p.t * cy + p.t * p.t * dest.py,
          );
        },
      });
      const hit = this.add.image(dest.px, dest.py, 'img-fx-sparkle-1').setTint(0xffffff).setScale(0.4).setDepth(3);
      this.tweens.add({ targets: hit, scale: 1, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => hit.destroy() });
      jobs.push(this.popCell(flight, 0, consumed));
    } else {
      this.tweens.add({ targets: prop, angle: 360, duration: 300, ease: 'Linear' });
    }
    jobs.push(this.tweenAsync({ targets: prop, scale: 0, alpha: 0, duration: 160, ease: 'Back.easeIn' }).then(() => prop.destroy()));
    await Promise.all(jobs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  // -------------------------------------------------------------------------
  // In-level assists (block 3): hammer / row-arrow / shuffle.
  // -------------------------------------------------------------------------

  /** Resolve an assist through the core, then charge and animate. The wallet is
   *  only touched AFTER a valid resolution: an invalid target or a stuck-board
   *  ShuffleError restart must never cost coins (same principle as the
   *  pre-level picker's charge-at-play-tap). No move is consumed. */
  private async runAssist(kind: AssistKind, target?: Coord): Promise<void> {
    if (this.busy || this.state.status !== 'playing') return;
    const price = ASSIST_PRICES[kind];
    if (price > 0 && this.wallet.data().coins < price) {
      this.wiggleSlot(kind);
      return;
    }
    this.busy = true;
    try {
      let out: MoveOutcome;
      try {
        out = applyAssist(this.state, kind, target);
      } catch (e) {
        if (e instanceof ShuffleError) {
          await this.shuffleRestart('assist');
          return;
        }
        throw e;
      }
      if (out.invalid === true) return;
      if (price > 0 && !this.wallet.spend(price)) {
        this.wiggleSlot(kind);
        return;
      }
      this.coinText.setText(String(this.wallet.data().coins));
      this.journal.log('assist_used', { level: this.state.level.id, kind, cost: price });
      // Assist-specific staging fx fire before the core's event stream plays.
      if (kind === 'hammer' && target !== undefined) await this.hammerSmash(target);
      if (kind === 'rowClear' && target !== undefined) this.rowSweepFx(target.y);
      this.state = out.state;
      let wave = 0;
      for (const step of planSteps(out.events)) {
        if (step.event.type === 'clear') {
          await this.animateStep(step, wave);
          wave += 1;
        } else {
          await this.animateStep(step);
        }
      }
      this.syncBoard();
      this.updateHud();
      if (this.flightJobs.length > 0) {
        await Promise.all(this.flightJobs);
        this.flightJobs = [];
        this.updateHud();
      }
      if (this.state.status === 'won') await this.onWin();
    } finally {
      this.busy = false;
    }
  }

  /** Hammer swing at the target cell: mallet arcs in, starburst on impact. */
  private async hammerSmash(target: Coord): Promise<void> {
    const { px, py } = cellToXY(this.layout, target.x, target.y);
    const cell = this.layout.cell;
    const mallet = this.add.sprite(px + cell * 0.7, py - cell * 1.1, 'ui-hammer').setDisplaySize(cell * 1.1, cell * 1.1).setAngle(45).setDepth(5);
    await this.tweenAsync({ targets: mallet, angle: -18, x: px + cell * 0.28, y: py - cell * 0.3, duration: 160, ease: 'Back.easeIn' });
    this.cameras.main.shake(90, 0.006);
    const burst = this.add.image(px, py, 'img-fx-starburst-hard').setTint(0xffffff).setScale(0.3).setDepth(4);
    this.tweens.add({ targets: burst, scale: 1.1, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => burst.destroy() });
    this.tweens.add({ targets: mallet, alpha: 0, duration: 140, onComplete: () => mallet.destroy() });
  }

  /** Row-arrow sweep: white bar flash across the chosen row (rocket-like). */
  private rowSweepFx(y: number): void {
    sfx(this, 'rocket-whoosh', { volume: 0.8 });
    this.cameras.main.shake(90, 0.004);
    const start = cellToXY(this.layout, 0, y);
    const end = cellToXY(this.layout, this.state.board.width - 1, y);
    const lineLen = this.layout.cell * this.state.board.width;
    const bar = this.add.rectangle((start.px + end.px) / 2, start.py, lineLen, this.layout.cell * 0.34, 0xffffff, 0.55).setDepth(2);
    this.tweens.add({ targets: bar, alpha: 0, scaleY: 0.1, duration: 260, ease: 'Quad.easeOut', onComplete: () => bar.destroy() });
    const streak = this.add.image(start.px, start.py, 'img-fx-glint').setTint(0xffffff).setAlpha(0.95).setDepth(3);
    streak.setDisplaySize(this.layout.cell * 1.7, this.layout.cell * 0.55);
    this.tweens.add({ targets: streak, x: end.px + this.layout.cell * 0.5, alpha: 0.2, duration: 240, ease: 'Quad.easeIn', onComplete: () => streak.destroy() });
  }

  // -------------------------------------------------------------------------
  // RM signature mechanics (block 2): goal fly-to-counter + win finale.
  // -------------------------------------------------------------------------

  /** If this cleared piece feeds an incomplete collect goal whose display lags
   *  the core truth, launch a flying copy toward its HUD icon (visual only). */
  private maybeFlyGoalPiece(c: Coord, texKey: string): void {
    this.state.goals.forEach((gs, i) => {
      if (gs.goal.type !== 'collect') return;
      if (texKey !== pieceTextureKey({ kind: 'normal', color: gs.goal.color }, this.pack)) return;
      const shown = this.goalDisplay[i] ?? 0;
      const inFlight = this.goalInFlight[i] ?? 0;
      if (shown + inFlight >= gs.collected) return;
      this.goalInFlight[i] = inFlight + 1;
      this.flightJobs.push(this.flyGoalPiece(c, texKey, i));
    });
  }

  private flyGoalPiece(c: Coord, texKey: string, goalIdx: number): Promise<void> {
    const hud = this.goalHud[goalIdx];
    if (hud === undefined) {
      this.goalInFlight[goalIdx] = Math.max(0, (this.goalInFlight[goalIdx] ?? 1) - 1);
      return Promise.resolve();
    }
    const { px, py } = cellToXY(this.layout, c.x, c.y);
    const flier = this.add.sprite(px, py, texKey).setDisplaySize(this.layout.cell * 0.8, this.layout.cell * 0.8).setDepth(6);
    const startScale = flier.scale;
    const dest = { x: hud.icon.x, y: hud.icon.y };
    // Quadratic bezier: control point lofted above the straight line for an arc.
    const cx = (px + dest.x) / 2 + (px < dest.x ? -90 : 90);
    const cy = Math.min(py, dest.y) - 140;
    this.tweens.add({ targets: flier, scale: startScale * 0.5, duration: 400, ease: 'Quad.easeIn' });
    const p = { t: 0 };
    return this.tweenAsync({
      targets: p,
      t: 1,
      duration: 400,
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const u = 1 - p.t;
        flier.setPosition(
          u * u * px + 2 * u * p.t * cx + p.t * p.t * dest.x,
          u * u * py + 2 * u * p.t * cy + p.t * p.t * dest.y,
        );
      },
    }).then(() => {
      flier.destroy();
      sfx(this, 'collect-ding', { volume: 0.7 });
      this.goalInFlight[goalIdx] = Math.max(0, (this.goalInFlight[goalIdx] ?? 1) - 1);
      this.goalDisplay[goalIdx] = (this.goalDisplay[goalIdx] ?? 0) + 1;
      this.paintGoalCount(goalIdx, this.goalDisplay[goalIdx]!);
      const icon = hud.icon;
      this.tweens.add({ targets: icon, scale: icon.scale * 1.25, duration: 110, yoyo: true });
    });
  }

  /** RM's moves-to-rockets win conversion: leftover moves become rockets that
   *  auto-fire over the finished board, each worth +3 coins. Pure bonus layer:
   *  the core planned it deterministically; the GameState is never touched. */
  private async playFinale(rockets: FinaleRocket[]): Promise<void> {
    const coins = rockets.length * FINALE_COINS_PER_ROCKET;
    this.journal.log('finale', { rockets: rockets.length, coins });
    this.wallet.earnFinale(rockets.length);
    // Convert: leftover moves drain from the badge as rockets pop in (the
    // badge drains per planned rocket even if a cell's sprite is missing).
    for (const [i, r] of rockets.entries()) {
      this.time.delayedCall(i * 60, () => {
        sfx(this, 'click', { volume: 0.5 });
        this.movesText.setText(String(Math.max(0, this.state.movesLeft - (i + 1))));
        const sp = this.sprites.get(key(r.coord));
        if (sp === undefined) return;
        sp.setTexture(r.vertical ? 'img-sp-rocketV' : 'img-sp-rocketH');
        sp.setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92);
        this.tweens.add({ targets: sp, scale: sp.scale * 1.18, duration: 90, yoyo: true });
      });
    }
    await this.sleep(rockets.length * 60 + 220);
    // Fire one by one, 150ms apart (overlapping sweeps, RM style).
    const consumed = new Set<string>();
    const jobs: Promise<void>[] = [];
    for (const [i, r] of rockets.entries()) {
      jobs.push(
        this.sleep(i * 150).then(async () => {
          const { px, py } = cellToXY(this.layout, r.coord.x, r.coord.y);
          if (this.sprites.has(key(r.coord))) {
            const own = r.targets.filter((t) => this.sprites.has(key(t)) && !consumed.has(key(t)));
            await this.animateRocket(r.coord, r.vertical, own, consumed, false);
          }
          // +3 coins fly to the counter as each rocket resolves.
          sfx(this, 'coin-clink', { volume: 0.6 });
          const pip = this.add.sprite(px, py, 'ui-pip').setTint(0xf1c40f).setScale(1.4).setDepth(12);
          await this.tweenAsync({ targets: pip, x: this.coinIcon.x, y: this.coinIcon.y, scale: 0.5, duration: 420, ease: 'Cubic.easeIn' });
          pip.destroy();
          this.coinText.setText(String(Number(this.coinText.text) + FINALE_COINS_PER_ROCKET));
        }),
      );
    }
    await Promise.all(jobs);
  }

  private async celebrateGift(moves: number): Promise<void> {
    this.blips.gift();
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < moves; i++) {
      const pip = this.add.sprite(GAME_WIDTH / 2 + (i - moves / 2) * 60, GAME_HEIGHT / 2, 'ui-pip').setTint(PALETTE.gold).setScale(2).setDepth(6);
      jobs.push(
        this.tweenAsync({
          targets: pip,
          x: this.movesText.x,
          y: this.movesText.y,
          scale: 0.5,
          duration: 550,
          delay: i * 90,
          ease: 'Cubic.easeIn',
        }).then(() => pip.destroy()),
      );
    }
    await Promise.all(jobs);
    // Counter pulse with a brief gold flash on the number itself (dark gold:
    // the badge ground is white now).
    this.movesText.setColor('#b8860b');
    this.time.delayedCall(300, () => this.movesText.setColor('#0e1e3d'));
    await this.tweenAsync({ targets: this.movesText, scale: 1.6, duration: 140, yoyo: true });
  }

  private overlay(): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(10);
  }

  private async onWin(): Promise<void> {
    this.killHand();
    // RM moves-to-rockets finale: leftover moves auto-fire as bonus rockets
    // BEFORE the win overlay. Stars are computed from the untouched movesLeft.
    const finaleRockets = planFinale(this.state);
    if (finaleRockets.length > 0) await this.playFinale(finaleRockets);
    const stars = starsFor({
      status: this.state.status,
      giftUsed: this.state.giftUsed,
      movesLeft: this.state.movesLeft,
      baseMoves: this.state.level.moves,
    });
    this.journal.log('level_end', { level: this.state.level.id, won: true, movesLeft: this.state.movesLeft, stars, retries: this.retryCount });
    const chapterIndex = CHAPTERS.findIndex((ch) => ch.id === this.chapter);
    const bonus = CHAPTER_COIN_BONUS_PER_INDEX * Math.max(0, chapterIndex);
    this.wallet.earnWin(stars, bonus);
    this.journal.log('earn', { coins: 20 + 10 * stars + bonus });
    this.coinText.setText(String(this.wallet.data().coins));
    const outcome = this.adaptive.recordOutcome(true, stars);
    if (outcome.changed) this.journal.log('difficulty_tier', { tier: outcome.tier });
    const wins = this.adaptive.recordWin();
    const offerBreak = PROFILE.features.danceBreaks && wins >= PROFILE.features.danceBreakEveryWins;
    this.flyCoinPips();
    sfx(this, 'win-fanfare');
    this.overlay();
    // Win banner (the baked flat ribbon) sweeps in behind the
    // stars (depth 10.5: between dim and stars). Star sizes are explicit
    // pixels — the old code scaled off the retired 170px star texture.
    const bannerW = GAME_WIDTH * 0.7;
    const bannerY = GAME_HEIGHT * 0.38;
    const banner = this.add.image(-bannerW / 2, bannerY, 'img-ui-banner').setDisplaySize(bannerW, 132).setDepth(10.5);
    this.tweens.add({ targets: banner, x: GAME_WIDTH / 2, duration: 300, ease: 'Back.easeOut' });
    const STAR_W = 165;
    const STAR_H = 155;
    const starSprites: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const slot = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'img-ui-star')
        .setDepth(11).setDisplaySize(STAR_W, STAR_H).setTint(0x555566);
      starSprites.push(slot);
    }
    for (let i = 0; i < stars; i++) {
      const st = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'img-ui-star').setDepth(12).setScale(0);
      starSprites.push(st);
      sfx(this, 'star-pop', { rate: 1 + i * 0.08 });
      // Blush light bloom under the pop — celebration reads as light, not text.
      const bloom = this.add.image(st.x, st.y, 'ui-glow').setTint(PALETTE.blush).setAlpha(0).setScale(0.2).setDepth(11.5);
      this.tweens.add({
        targets: bloom, alpha: 0.5, scale: 1.3, duration: 300, ease: 'Quad.easeOut',
        onComplete: () => this.tweens.add({ targets: bloom, alpha: 0, duration: 650, onComplete: () => bloom.destroy() }),
      });
      // Each star pop bursts 8 gold pips outward (fire-and-forget).
      for (let p = 0; p < 8; p++) {
        const ang = (p * Math.PI * 2) / 8;
        const pip = this.add.sprite(st.x, st.y, 'ui-pip').setTint(PALETTE.gold).setScale(1.2).setDepth(12);
        this.tweens.add({
          targets: pip,
          x: st.x + Math.cos(ang) * 95,
          y: st.y + Math.sin(ang) * 95,
          alpha: 0,
          scale: 0.3,
          duration: 380,
          ease: 'Quad.easeOut',
          onComplete: () => pip.destroy(),
        });
      }
      await this.tweenAsync({ targets: st, displayWidth: STAR_W, displayHeight: STAR_H, duration: 260, ease: 'Back.easeOut' });
    }
    const idx = this.progress.levelIndexByChapter[this.chapter];
    this.progress.completed[this.state.level.id] = true;
    this.progress.stars[this.state.level.id] = Math.max(stars, this.progress.stars[this.state.level.id] ?? 0);
    if (idx < this.levels.length - 1) this.progress.levelIndexByChapter[this.chapter] = idx + 1;
    saveProgress(window.localStorage, this.progress);
    if (idx >= this.levels.length - 1) {
      await this.showChapterComplete();
      return;
    }
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, 'img-ui-play').setDepth(11).setDisplaySize(200, 200).setInteractive();
    pressify(this, btn);
    btn.once('pointerup', () => {
      this.retryCount = 0;
      if (offerBreak) this.danceBreak();
      else goto(this, 'map');
    });
  }

  /** 4-6 gold coin pips fly from board center to the coin counter (fire-and-forget). */
  private flyCoinPips(): void {
    sfx(this, 'coin-clink');
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const pip = this.add
        .sprite(GAME_WIDTH / 2 + (Math.random() * 2 - 1) * 50, GAME_HEIGHT / 2 + (Math.random() * 2 - 1) * 50, 'ui-pip')
        .setTint(0xf1c40f)
        .setScale(1.4)
        .setDepth(12);
      this.tweens.add({
        targets: pip,
        x: this.coinIcon.x,
        y: this.coinIcon.y,
        scale: 0.5,
        duration: 520,
        delay: i * 80,
        ease: 'Cubic.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
  }

  /** Optional dance break after every 5th win: dancing avatar + beat, prominent skip. */
  private danceBreak(): void {
    const TOTAL_BEATS = 33; // ~20s at 600ms per beat
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92)
      .setDepth(40)
      .setInteractive();
    const equipped = this.wardrobe.state().equipped;
    const equippedColor = this.wardrobe.equippedColor();
    let prefix = 'avatar-o0';
    if (equipped !== null && equippedColor !== null) {
      prefix = `avatar-w${equipped}`;
      for (const pz of [0, 1, 2] as const) {
        const k = `${prefix}-p${pz}`;
        if (!this.textures.exists(k)) makeAvatarTexture(this, k, equippedColor, pz);
      }
    }
    const avatar = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, `${prefix}-p0`).setDepth(41).setScale(3);
    this.tweens.add({
      targets: avatar,
      scaleX: 3.18,
      scaleY: 3.18,
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const skip = this.add
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.84, 'img-ui-play')
      .setDepth(41)
      .setScale(1.12)
      .setTint(0x888899)
      .setInteractive();
    pressify(this, skip);
    let done = false;
    let usingMusic = false;
    let musicEl: HTMLAudioElement | null = null;
    let musicUrl: string | null = null;
    const stopMusic = (): void => {
      if (musicEl !== null) {
        musicEl.pause();
        musicEl = null;
      }
      if (musicUrl !== null) {
        URL.revokeObjectURL(musicUrl);
        musicUrl = null;
      }
    };
    // Her playlist (decision #37): if tracks are stored, a random one replaces
    // the procedural beat blips (the avatar keeps bouncing on the 600ms timer).
    // Muted -> no music at all. Empty playlist, no IndexedDB or an autoplay
    // refusal -> the procedural beat below runs exactly as before.
    if (PROFILE.features.playlistMusic && !this.blips.muted()) {
      this.music
        .randomTrack(Date.now() >>> 0)
        .then((track) => {
          if (track === null || done) return;
          const url = URL.createObjectURL(new Blob([track.data]));
          const el = new Audio(url);
          el.play().then(
            () => {
              if (done) {
                // Break already ended while play() settled: clean up immediately.
                el.pause();
                URL.revokeObjectURL(url);
                return;
              }
              usingMusic = true;
              musicEl = el;
              musicUrl = url;
            },
            () => URL.revokeObjectURL(url),
          );
        })
        .catch(() => {});
    }
    const finish = (completed: boolean): void => {
      if (done) return;
      done = true;
      timer.remove();
      this.tweens.killTweensOf(avatar);
      stopMusic();
      dim.destroy();
      avatar.destroy();
      skip.destroy();
      this.adaptive.resetBreakCounter();
      this.journal.log('dance_break', { completed, music: usingMusic });
      goto(this, 'map');
    };
    let pose = 0;
    let ticks = 0;
    const timer = this.time.addEvent({
      delay: 600,
      repeat: TOTAL_BEATS - 1,
      callback: () => {
        ticks += 1;
        if (!usingMusic) this.blips.beat();
        pose = (pose + 1) % 3;
        avatar.setTexture(`${prefix}-p${pose}`);
        if (ticks >= TOTAL_BEATS) finish(true);
      },
    });
    skip.once('pointerup', () => finish(false));
  }

  /** Last level won: trophy + confetti celebration, replay button restarts the chapter. */
  private async showChapterComplete(): Promise<void> {
    this.journal.log('chapter_complete', { chapter: this.chapter });
    const trophy = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.55, 'ui-trophy').setDepth(12).setScale(0);
    const tints = Object.values(COLOR_HEX);
    for (let i = 0; i < 24; i++) {
      const pip = this.add
        .sprite(Math.random() * GAME_WIDTH, -40 - Math.random() * 160, 'ui-pip')
        .setTint(tints[i % tints.length]!)
        .setScale(1.4 + Math.random())
        .setDepth(11);
      this.confetti.push(pip);
      // Fire-and-forget confetti: not awaited; each pip destroys itself on complete.
      this.tweens.add({
        targets: pip,
        y: GAME_HEIGHT + 60,
        x: pip.x + (Math.random() * 2 - 1) * 140,
        angle: 360,
        duration: 1700 + Math.random() * 600,
        delay: Math.random() * 400,
        ease: 'Sine.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
    await this.tweenAsync({ targets: trophy, scale: 3, duration: 420, ease: 'Back.easeOut' });
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.74, 'img-ui-retry').setDepth(12).setScale(1.22).setInteractive();
    pressify(this, btn);
    btn.once('pointerup', () => {
      this.progress.levelIndexByChapter[this.chapter] = 0;
      saveProgress(window.localStorage, this.progress);
      this.journal.log('chapter_replay', { chapter: this.chapter });
      this.retryCount = 0;
      this.confetti = [];
      goto(this, 'map');
    });
  }

  private async onLose(): Promise<void> {
    this.killHand();
    this.journal.log('level_end', { level: this.state.level.id, won: false, retries: this.retryCount });
    const outcome = this.adaptive.recordOutcome(false, 0);
    if (outcome.changed) this.journal.log('difficulty_tier', { tier: outcome.tier });
    sfx(this, 'lose-soft');
    const dim = this.overlay();
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, 'img-ui-retry').setDepth(11).setScale(0).setInteractive();
    await this.tweenAsync({ targets: btn, scale: 1.22, duration: 300, ease: 'Back.easeOut' });
    pressify(this, btn);
    btn.once('pointerup', () => {
      this.retryCount += 1;
      dim.destroy();
      btn.destroy();
      this.startCurrentLevel();
    });
  }
}
