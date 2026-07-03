import Phaser from 'phaser';
import { applyMove, findValidMoves, startLevel, starsFor, ShuffleError } from '../core/match3/index';
import type { Coord, GameState, LevelDef, MoveOutcome, PieceColor } from '../core/match3/index';
import { createAdaptive, type Adaptive } from '../services/adaptive';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { summarize } from '../services/stats';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { planSteps, type Step } from './choreo';
import { BOTTOM_RESERVE, GAME_HEIGHT, GAME_WIDTH, TOP_RESERVE } from './config';
import { boardLayout, cellToXY, xyToCell, type Layout } from './layout';
import { loadLevels } from './levels';
import { COLOR_HEX, makeTextures, textureKeyFor } from './theme';

const key = (c: Coord): string => `${c.x},${c.y}`;

/** Particle tint from a sprite's texture key: 'gem-red' -> COLOR_HEX.red; crates -> brown; specials/unknown -> white. */
const tintForTexture = (texKey: string): number =>
  texKey.startsWith('gem-')
    ? (COLOR_HEX[texKey.slice(4) as PieceColor] ?? 0xffffff)
    : texKey.startsWith('ob-box') ? 0x9c6b30
    : 0xffffff;

export class PlayScene extends Phaser.Scene {
  private levels: LevelDef[] = [];
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
  private adaptive!: Adaptive;
  private blips!: Blips;
  private coinIcon!: Phaser.GameObjects.Sprite;
  private coinText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private goalHud: { icon: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text; color: PieceColor | null }[] = [];
  private retryCount = 0;
  private downAt: { cell: Coord; px: number; py: number } | null = null;
  private backdrop: Phaser.GameObjects.Image[] = [];
  private hudPanels: Phaser.GameObjects.Image[] = [];
  private markerTween: Phaser.Tweens.Tween | null = null;
  private hand: Phaser.GameObjects.Sprite | null = null;
  private handTimer: Phaser.Time.TimerEvent | null = null;
  private movesMadeThisLevel = 0;
  private tutorialLogged = false;
  private secretTaps: number[] = [];
  private statsOverlay: Phaser.GameObjects.GameObject[] = [];
  private confetti: Phaser.GameObjects.Sprite[] = [];
  private wakeHooked = false;

  constructor() {
    super('play');
  }

  create(): void {
    makeTextures(this, 96);
    // Vertical vignette over the 0x1a1a2e canvas color: cheap gradient illusion.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.2, GAME_WIDTH, GAME_HEIGHT * 0.4, 0x24244a, 0.35)
      .setDepth(-2);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.8, GAME_WIDTH, GAME_HEIGHT * 0.4, 0x101020, 0.35)
      .setDepth(-2);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.progress = loadProgress(window.localStorage);
    this.wallet = createWallet(window.localStorage);
    this.adaptive = createAdaptive(window.localStorage);
    this.blips = createBlips();
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
    const muteBtn = this.add
      .sprite(GAME_WIDTH - 60, 60, startMuted ? 'ui-sound-off' : 'ui-sound-on')
      .setDisplaySize(72, 72)
      .setDepth(8)
      .setInteractive();
    muteBtn.on('pointerup', () => {
      const m = !this.blips.muted();
      this.blips.setMuted(m);
      muteBtn.setTexture(m ? 'ui-sound-off' : 'ui-sound-on');
      window.localStorage.setItem('omnigame.muted.v1', m ? '1' : '0');
    });
    this.levels = loadLevels();
    this.marker = this.add
      .rectangle(0, 0, 10, 10)
      .setStrokeStyle(5, 0xffffff)
      .setFillStyle(0, 0)
      .setVisible(false)
      .setDepth(5);
    this.movesText = this.add
      .text(GAME_WIDTH / 2, TOP_RESERVE * 0.72, '', { fontSize: '64px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(2);
    // Hidden parent corner (decision #17): invisible top-left hotspot, 5 quick taps open the stats overlay.
    this.add
      .rectangle(45, 45, 90, 90, 0xffffff, 0.001)
      .setDepth(20)
      .setInteractive()
      .on('pointerdown', () => this.onSecretTap());
    this.coinIcon = this.add.sprite(90, 170, 'ui-coin').setDisplaySize(40, 40).setDepth(2);
    this.coinText = this.add
      .text(120, 170, String(this.wallet.data().coins), { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.startCurrentLevel();
  }

  private currentDef(): LevelDef {
    const idx = Math.min(this.progress.levelIndex, this.levels.length - 1);
    const def = this.levels[idx]!;
    return this.retryCount === 0 ? def : { ...def, seed: def.seed + this.retryCount * 101 };
  }

  private startCurrentLevel(): void {
    this.select(null);
    this.killHand();
    this.movesMadeThisLevel = 0;
    this.tutorialLogged = false;
    const def = this.adaptive.applyTier(this.currentDef());
    let started: GameState | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        started = startLevel({ ...def, seed: def.seed + attempt * 9999 });
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
        const tile = this.add
          .image(px, py, 'ui-tile')
          .setDisplaySize(this.layout.cell * 0.98, this.layout.cell * 0.98)
          .setAlpha((x + y) % 2 === 0 ? 0.06 : 0.1)
          .setDepth(-1);
        this.backdrop.push(tile);
      }
    }
    this.journal.log('level_start', { level: def.id, retry: this.retryCount, tier: this.adaptive.state().tier });
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
    const n = this.state.goals.length;
    const spacing = 150;
    this.hudPanels.push(
      this.add
        .image(GAME_WIDTH / 2, TOP_RESERVE * 0.32, 'ui-panel')
        .setDisplaySize(n * spacing + 30, 100)
        .setAlpha(0.3)
        .setDepth(0),
      this.add
        .image(GAME_WIDTH / 2, TOP_RESERVE * 0.72, 'ui-panel')
        .setDisplaySize(210, 96)
        .setAlpha(0.3)
        .setDepth(0),
    );
    const x0 = GAME_WIDTH / 2 - ((n - 1) * spacing) / 2;
    this.state.goals.forEach((gs, i) => {
      const color = gs.goal.type === 'collect' ? gs.goal.color : null;
      const iconKey =
        gs.goal.type === 'collect' ? `gem-${gs.goal.color}`
        : gs.goal.type === 'clearBoxes' ? 'ob-box1'
        : 'ob-ice';
      const icon = this.add.sprite(x0 + i * spacing - 34, TOP_RESERVE * 0.32, iconKey).setDisplaySize(64, 64).setDepth(2);
      const txt = this.add
        .text(x0 + i * spacing + 14, TOP_RESERVE * 0.32, '', { fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5)
        .setDepth(2);
      this.goalHud.push({ icon, txt, color });
    });
  }

  private updateHud(): void {
    this.movesText.setText(String(this.state.movesLeft));
    this.state.goals.forEach((gs, i) => {
      const remaining = Math.max(0, gs.goal.count - gs.collected);
      const hud = this.goalHud[i]!;
      hud.txt.setText(remaining === 0 ? '✓' : String(remaining));
      hud.txt.setColor(remaining === 0 ? '#2ecc71' : '#ffffff');
    });
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
          const ice = this.add.sprite(px, py, 'ob-ice').setDisplaySize(this.layout.cell * 0.94, this.layout.cell * 0.94).setDepth(0.5);
          this.iceSprites.set(key({ x, y }), ice);
        }
        const piece = b.cells[y * b.width + x];
        if (piece === null || piece === undefined) continue;
        const sp = this.add.sprite(px, py, textureKeyFor(piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setDepth(1);
        this.sprites.set(key({ x, y }), sp);
      }
    }
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

  /** Parent-only stats overlay (text allowed here: Charles reads it, not Luana). */
  private openStats(): void {
    if (this.statsOverlay.length > 0) return;
    this.journal.log('stats_viewed', {});
    const stats = summarize(this.journal.read());
    const objs = this.statsOverlay;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(21)
      .setInteractive();
    dim.on('pointerup', () => this.closeStats());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(620, 1000).setDepth(22));
    const textStyle = { fontSize: '32px', color: '#ffffff' };
    const header: { icon: string | null; value: string }[] = [
      { icon: 'ui-play', value: String(stats.levelsPlayed) },
      { icon: 'ui-star', value: String(stats.wins) },
      { icon: null, value: `${Math.round(stats.winRate * 100)}%` },
      { icon: 'ui-pip', value: String(stats.gifts) },
      { icon: 'ui-retry', value: String(stats.retries) },
      { icon: 'sp-propeller', value: String(stats.shuffles) },
    ];
    let y = 230;
    for (const row of header) {
      if (row.icon !== null) objs.push(this.add.sprite(250, y, row.icon).setDisplaySize(40, 40).setDepth(23));
      objs.push(this.add.text(300, y, row.value, textStyle).setOrigin(0, 0.5).setDepth(23));
      y += 64;
    }
    y += 24;
    for (const [id, lv] of Object.entries(stats.perLevel)) {
      objs.push(this.add.text(210, y, id.replace(/^kitchen-/, ''), textStyle).setOrigin(0, 0.5).setDepth(23));
      for (let i = 0; i < 3; i++) {
        const st = this.add.sprite(340 + i * 52, y, 'ui-star').setDisplaySize(40, 40).setDepth(23);
        if (i >= lv.bestStars) st.setTint(0x555566);
        objs.push(st);
      }
      y += 56;
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
    const idx = Math.min(this.progress.levelIndex, this.levels.length - 1);
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
    if (this.statsOverlay.length > 0) return;
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
    if (this.busy || this.downAt === null || this.state === undefined || this.state.status !== 'playing') return;
    const start = this.downAt;
    this.downAt = null;
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
    let out: MoveOutcome;
    try {
      out = applyMove(this.state, a, b);
    } catch (e) {
      if (e instanceof ShuffleError) {
        this.journal.log('shuffle_error', { level: this.state.level.id, phase: 'move' });
        this.retryCount += 1;
        // Friendly cue before the silent restart: dim + spinning retry icon.
        this.busy = true;
        const dim = this.overlay();
        const spinner = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-retry').setDepth(11).setScale(2.4);
        await this.tweenAsync({ targets: spinner, angle: 360, duration: 900, ease: 'Cubic.easeInOut' });
        dim.destroy();
        spinner.destroy();
        this.startCurrentLevel();
        this.busy = false;
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
    await this.runTurn(out);
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

  private async runTurn(out: MoveOutcome): Promise<void> {
    this.busy = true;
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
        if (sa) jobs.push(this.tweenAsync({ targets: sa, x: pb.px, y: pb.py, duration: step.duration }));
        if (sb) jobs.push(this.tweenAsync({ targets: sb, x: pa.px, y: pa.py, duration: step.duration }));
        await Promise.all(jobs);
        if (sa && sb) {
          this.sprites.set(key(ev.a), sb);
          this.sprites.set(key(ev.b), sa);
        }
        break;
      }
      case 'clear': {
        const targets = ev.cells.map((c) => this.sprites.get(key(c))).filter((s): s is Phaser.GameObjects.Sprite => s !== undefined);
        if (ev.cells.length >= 6) this.blips.booster();
        else this.blips.matchAt(wave);
        for (const c of ev.cells.slice(0, 12)) {
          const src = this.sprites.get(key(c));
          if (src === undefined) continue;
          const tint = tintForTexture(src.texture.key);
          const { px, py } = cellToXY(this.layout, c.x, c.y);
          for (let i = 0; i < 4; i++) {
            const pip = this.add.sprite(px, py, 'ui-pip').setTint(tint).setScale(0.9).setDepth(1);
            // Fire-and-forget: not awaited; each pip destroys itself on complete.
            this.tweens.add({
              targets: pip,
              x: px + (Math.random() * 2 - 1) * this.layout.cell * 0.8,
              y: py + (Math.random() * 2 - 1) * this.layout.cell * 0.8,
              alpha: 0,
              scale: 0.2,
              duration: 320,
              ease: 'Quad.easeOut',
              onComplete: () => pip.destroy(),
            });
          }
        }
        if (targets.length > 0) {
          await this.tweenAsync({ targets, scale: 0, alpha: 0, duration: step.duration, ease: 'Back.easeIn' });
        }
        for (const c of ev.cells) {
          const sp = this.sprites.get(key(c));
          if (sp) { sp.destroy(); this.sprites.delete(key(c)); }
        }
        if (navigator.vibrate) navigator.vibrate(20);
        break;
      }
      case 'spawn': {
        const { px, py } = cellToXY(this.layout, ev.coord.x, ev.coord.y);
        const sp = this.add.sprite(px, py, textureKeyFor(ev.piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setScale(0).setDepth(1);
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
          return this.tweenAsync({ targets: sp, x: px, y: py, duration: step.duration, ease: 'Quad.easeIn' });
        });
        for (const { sp, to } of moving) this.sprites.set(key(to), sp);
        await Promise.all(jobs);
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
              .sprite(px, py, textureKeyFor(f.piece))
              .setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92)
              .setScale(0)
              .setDepth(1);
            this.sprites.set(key(f.coord), sp);
            jobs.push(this.tweenAsync({ targets: sp, scale: (this.layout.cell * 0.92) / 96, duration: step.duration, ease: 'Back.easeOut' }));
            continue;
          }
          const sp = this.add
            .sprite(px, this.layout.originY - this.layout.cell, textureKeyFor(f.piece))
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

  private async celebrateGift(moves: number): Promise<void> {
    this.blips.gift();
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < moves; i++) {
      const pip = this.add.sprite(GAME_WIDTH / 2 + (i - moves / 2) * 60, GAME_HEIGHT / 2, 'ui-pip').setScale(2).setDepth(6);
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
    await this.tweenAsync({ targets: this.movesText, scale: 1.6, duration: 140, yoyo: true });
  }

  private overlay(): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setDepth(10);
  }

  private async onWin(): Promise<void> {
    this.killHand();
    const stars = starsFor({
      status: this.state.status,
      giftUsed: this.state.giftUsed,
      movesLeft: this.state.movesLeft,
      baseMoves: this.state.level.moves,
    });
    this.journal.log('level_end', { level: this.state.level.id, won: true, movesLeft: this.state.movesLeft, stars, retries: this.retryCount });
    this.wallet.earnWin(stars);
    this.journal.log('earn', { coins: 20 + 10 * stars });
    this.coinText.setText(String(this.wallet.data().coins));
    const outcome = this.adaptive.recordOutcome(true, stars);
    if (outcome.changed) this.journal.log('difficulty_tier', { tier: outcome.tier });
    const wins = this.adaptive.recordWin();
    const offerBreak = wins >= 5;
    this.flyCoinPips();
    this.blips.win();
    this.overlay();
    const starSprites: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const slot = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'ui-star')
        .setDepth(11).setScale(2.2).setTint(0x555566);
      starSprites.push(slot);
    }
    for (let i = 0; i < stars; i++) {
      const st = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'ui-star').setDepth(12).setScale(0);
      starSprites.push(st);
      await this.tweenAsync({ targets: st, scale: 2.2, duration: 260, ease: 'Back.easeOut' });
    }
    const idx = this.progress.levelIndex;
    this.progress.completed[this.state.level.id] = true;
    this.progress.stars[this.state.level.id] = Math.max(stars, this.progress.stars[this.state.level.id] ?? 0);
    if (idx < this.levels.length - 1) this.progress.levelIndex = idx + 1;
    saveProgress(window.localStorage, this.progress);
    if (idx >= this.levels.length - 1) {
      await this.showChapterComplete();
      return;
    }
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, 'ui-play').setDepth(11).setScale(2.4).setInteractive();
    btn.once('pointerup', () => {
      this.retryCount = 0;
      if (offerBreak) this.danceBreak();
      else this.scene.start('career');
    });
  }

  /** 4-6 gold coin pips fly from board center to the coin counter (fire-and-forget). */
  private flyCoinPips(): void {
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
    const avatar = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.45, 'avatar-o0-p0').setDepth(41).setScale(3);
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
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.84, 'ui-play')
      .setDepth(41)
      .setScale(2.2)
      .setTint(0x888899)
      .setInteractive();
    let done = false;
    const finish = (completed: boolean): void => {
      if (done) return;
      done = true;
      timer.remove();
      this.tweens.killTweensOf(avatar);
      dim.destroy();
      avatar.destroy();
      skip.destroy();
      this.adaptive.resetBreakCounter();
      this.journal.log('dance_break', { completed });
      this.scene.start('career');
    };
    let pose = 0;
    let ticks = 0;
    const timer = this.time.addEvent({
      delay: 600,
      repeat: TOTAL_BEATS - 1,
      callback: () => {
        ticks += 1;
        this.blips.beat();
        pose = (pose + 1) % 3;
        avatar.setTexture(`avatar-o0-p${pose}`);
        if (ticks >= TOTAL_BEATS) finish(true);
      },
    });
    skip.once('pointerup', () => finish(false));
  }

  /** Last level won: trophy + confetti celebration, replay button restarts the chapter. */
  private async showChapterComplete(): Promise<void> {
    this.journal.log('chapter_complete', { chapter: 'kitchen' });
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
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.74, 'ui-retry').setDepth(12).setScale(2.4).setInteractive();
    btn.once('pointerup', () => {
      this.progress.levelIndex = 0;
      saveProgress(window.localStorage, this.progress);
      this.journal.log('chapter_replay', { chapter: 'kitchen' });
      this.retryCount = 0;
      this.confetti = [];
      this.scene.start('career');
    });
  }

  private async onLose(): Promise<void> {
    this.killHand();
    this.journal.log('level_end', { level: this.state.level.id, won: false, retries: this.retryCount });
    const outcome = this.adaptive.recordOutcome(false, 0);
    if (outcome.changed) this.journal.log('difficulty_tier', { tier: outcome.tier });
    this.blips.lose();
    const dim = this.overlay();
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.5, 'ui-retry').setDepth(11).setScale(0).setInteractive();
    await this.tweenAsync({ targets: btn, scale: 2.4, duration: 300, ease: 'Back.easeOut' });
    btn.once('pointerup', () => {
      this.retryCount += 1;
      dim.destroy();
      btn.destroy();
      this.startCurrentLevel();
    });
  }
}
