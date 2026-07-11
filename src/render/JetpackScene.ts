import Phaser from 'phaser';
import { PROFILE } from '../config/profile';
import { starsForRun, startRun, step, START_HEARTS } from '../core/jetpack/engine';
import { JET_LEVELS } from '../core/jetpack/level';
import type { JetEvent, JetState } from '../core/jetpack/types';
import { createJournal, type Journal } from '../services/journal';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, sfx, type Blips } from './audio';
import { buildBackground, fadeIn, goto, pressify } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { TS } from './textStyles';

/** World-to-screen: the player hangs at PLAYER_X; the world scrolls left. */
const PLAYER_X = GAME_WIDTH * 0.3;
const SKY_TOP = 240;
const SKY_BOTTOM = 1120;
const SKY_H = SKY_BOTTOM - SKY_TOP;
/** Pixels per world meter. */
const PPM = 8;
/** Soft cap on the coin payout, matching the old runner's verified 20-60 band. */
const coinPayout = (collected: number): number => Math.min(60, 20 + collected * 2);

const yPx = (y: number): number => SKY_TOP + y * SKY_H;
const dPx = (d: number, dist: number): number => PLAYER_X + (d - dist) * PPM;

/**
 * Jetpack runner (run 6c, decision #62): one input — hold anywhere to thrust.
 * Fixed-length forgiving runs over the pure core in src/core/jetpack. The old
 * gate-runner stays in the codebase, unrouted.
 */
export class JetpackScene extends Phaser.Scene {
  private state: JetState | null = null;
  private journal!: Journal;
  private wallet!: Wallet;
  private blips!: Blips;
  private holding = false;
  private over = false;
  private phase: 'select' | 'run' = 'select';
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private player: Phaser.GameObjects.Sprite | null = null;
  private flame: Phaser.GameObjects.Sprite | null = null;
  private obstacleBars: Phaser.GameObjects.Rectangle[] = [];
  private coinSprites: Phaser.GameObjects.Sprite[] = [];
  private finishFlag: Phaser.GameObjects.Sprite | null = null;
  private hearts: Phaser.GameObjects.Sprite[] = [];
  private coinText: Phaser.GameObjects.Text | null = null;
  private progressFill: Phaser.GameObjects.Rectangle | null = null;
  private levelIndex = 0;

  constructor() {
    super('jetpack');
  }

  create(): void {
    fadeIn(this);
    this.state = null;
    this.holding = false;
    this.over = false;
    this.phase = 'select';
    this.viewObjects = [];
    this.player = null;
    this.flame = null;
    this.obstacleBars = [];
    this.coinSprites = [];
    this.finishFlag = null;
    this.hearts = [];
    this.coinText = null;
    this.progressFill = null;
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    buildBackground(this, 0x123c5f, PALETTE.bgPlum, PALETTE.bgDeep);
    this.input.on('pointerdown', () => {
      this.blips.unlock();
      this.holding = true;
    });
    this.input.on('pointerup', () => {
      this.holding = false;
    });
    this.journal.log('jet_open', {});
    this.showSelect();
  }

  private clearView(): void {
    for (const o of this.viewObjects) o.destroy();
    this.viewObjects = [];
    this.obstacleBars = [];
    this.coinSprites = [];
    this.hearts = [];
    this.player = null;
    this.flame = null;
    this.finishFlag = null;
    this.coinText = null;
    this.progressFill = null;
  }

  /** Level select: 3 cards, best stars per level from the journal. */
  private showSelect(): void {
    this.clearView();
    this.phase = 'select';
    this.state = null;
    const best = new Map<string, number>();
    for (const e of this.journal.read()) {
      if (e.type !== 'jet_run_end') continue;
      const d = e.data as { level?: string; stars?: number };
      if (typeof d.level === 'string' && typeof d.stars === 'number') {
        best.set(d.level, Math.max(best.get(d.level) ?? 0, d.stars));
      }
    }
    this.viewObjects.push(
      this.add.image(GAME_WIDTH / 2, 96, 'ui-panel').setDisplaySize(664, 128).setAlpha(0.45).setDepth(0),
      this.add.sprite(GAME_WIDTH / 2 + (PROFILE.textTier !== 'none' ? 80 : 0), 96, 'sp-propeller').setDisplaySize(76, 76).setDepth(1),
    );
    if (PROFILE.textTier !== 'none') {
      this.viewObjects.push(this.add.text(GAME_WIDTH / 2 - 60, 96, 'Fly!', TS.number(40)).setOrigin(0.5).setDepth(1));
    }
    const home = this.add.sprite(78, 96, 'img-ui-home').setDisplaySize(68, 68).setDepth(1).setInteractive();
    pressify(this, home);
    this.viewObjects.push(home);
    home.on('pointerup', () => goto(this, 'hub'));
    JET_LEVELS.forEach((level, i) => {
      const y = 400 + i * 230;
      const x = GAME_WIDTH / 2;
      const card = this.add.image(x, y, 'img-ui-panel-blue').setDisplaySize(540, 200).setDepth(0).setInteractive();
      pressify(this, card);
      this.viewObjects.push(card);
      this.viewObjects.push(this.add.text(x - 170, y, String(i + 1), TS.number(56)).setOrigin(0.5).setDepth(1));
      const stars = best.get(level.id) ?? 0;
      for (let st = 0; st < 3; st++) {
        const sp = this.add.sprite(x + 20 + st * 66, y, 'img-ui-star').setDisplaySize(54, 50).setDepth(1);
        if (st >= stars) sp.setTint(0x555566).setAlpha(0.6);
        this.viewObjects.push(sp);
      }
      card.on('pointerup', () => {
        if (this.phase !== 'select') return;
        this.blips.ding();
        this.startLevel(i);
      });
    });
  }

  private startLevel(index: number): void {
    this.clearView();
    this.phase = 'run';
    this.over = false;
    this.holding = false;
    this.levelIndex = index;
    const level = JET_LEVELS[index]!;
    this.state = startRun(level);
    this.journal.log('jet_run_start', { level: level.id });
    // World objects: bars + coins + finish, positioned every frame from state.
    for (const o of this.state.obstacles) {
      const topPx = yPx(o.top);
      const hPx = (o.bottom - o.top) * SKY_H;
      const bar = this.add
        .rectangle(dPx(o.d, 0), topPx + hPx / 2, 26, hPx, 0xf5c542, 0.95)
        .setStrokeStyle(3, 0xb8860b)
        .setDepth(2);
      this.obstacleBars.push(bar);
      this.viewObjects.push(bar);
    }
    for (const c of this.state.coins) {
      const sp = this.add.sprite(dPx(c.d, 0), yPx(c.y), 'img-ui-coin').setDisplaySize(34, 34).setDepth(2);
      this.coinSprites.push(sp);
      this.viewObjects.push(sp);
    }
    this.finishFlag = this.add.sprite(dPx(level.length, 0), yPx(0.5), 'gr-flag').setDisplaySize(120, 120).setDepth(2);
    this.viewObjects.push(this.finishFlag);
    // Player: Luana toon with a flame under her; tilt follows vy.
    const tex = this.textures.exists('img-toon-cust-a') ? 'img-toon-cust-a' : 'img-toon-bro-idle';
    this.player = this.add.sprite(PLAYER_X, yPx(0.5), tex).setDisplaySize(84, 112).setDepth(4);
    this.flame = this.add.sprite(PLAYER_X - 26, yPx(0.5) + 52, 'img-fx-glow').setDisplaySize(40, 56).setTint(0xf5a623).setDepth(3).setAlpha(0);
    this.viewObjects.push(this.player, this.flame);
    // HUD: hearts, coin count, progress to the flag.
    for (let i = 0; i < START_HEARTS; i++) {
      const h = this.add.sprite(64 + i * 52, 96, 'img-ui-heart').setDisplaySize(44, 44).setDepth(5);
      this.hearts.push(h);
      this.viewObjects.push(h);
    }
    this.viewObjects.push(this.add.sprite(530, 96, 'img-ui-coin').setDisplaySize(40, 40).setDepth(5));
    this.coinText = this.add.text(558, 96, '0', TS.number(32)).setOrigin(0, 0.5).setDepth(5);
    this.viewObjects.push(this.coinText);
    this.viewObjects.push(this.add.rectangle(GAME_WIDTH / 2, 170, 420, 14, 0x0e1e3d, 0.7).setDepth(5));
    this.progressFill = this.add.rectangle(GAME_WIDTH / 2 - 210, 170, 1, 9, 0x54b842).setOrigin(0, 0.5).setDepth(6);
    this.viewObjects.push(this.progressFill);
  }

  override update(_time: number, deltaMs: number): void {
    if (this.phase !== 'run' || this.over || this.state === null) return;
    // Un-stick the thrust if pointerup was swallowed (alt-tab mid-hold).
    if (this.holding && !this.input.activePointer.isDown) this.holding = false;
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const r = step(this.state, dt, this.holding);
    this.state = r.state;
    for (const ev of r.events) this.handle(ev);
    this.paint();
  }

  private handle(ev: JetEvent): void {
    switch (ev.type) {
      case 'coin': {
        sfx(this, 'coin-clink', { volume: 0.5 });
        const sp = this.coinSprites[ev.index];
        if (sp !== undefined) {
          this.tweens.add({ targets: sp, scale: sp.scale * 1.8, alpha: 0, duration: 180, onComplete: () => sp.setVisible(false) });
        }
        if (this.coinText !== null && this.state !== null) this.coinText.setText(String(this.state.collected));
        break;
      }
      case 'hit': {
        sfx(this, 'lose-soft', { volume: 0.5 });
        this.journal.log('jet_hit', { level: this.state?.level.id ?? '?', heartsLeft: ev.heartsLeft });
        this.cameras.main.shake(120, 0.008);
        const heart = this.hearts[ev.heartsLeft];
        if (heart !== undefined) heart.setTint(0x555566).setAlpha(0.5);
        if (this.player !== null) {
          this.tweens.add({ targets: this.player, alpha: 0.3, duration: 120, yoyo: true, repeat: 5 });
        }
        break;
      }
      case 'finish': {
        this.finishRun(true);
        break;
      }
      case 'expired': {
        this.finishRun(false);
        break;
      }
    }
  }

  /** Reposition the scrolling world + player from the authoritative state. */
  private paint(): void {
    const s = this.state;
    if (s === null) return;
    if (this.player !== null) {
      this.player.setY(yPx(s.y));
      this.player.setAngle(Phaser.Math.Clamp(s.vy * 14, -22, 22));
    }
    if (this.flame !== null) {
      this.flame.setPosition(PLAYER_X - 26, yPx(s.y) + 52);
      this.flame.setAlpha(this.holding ? 0.9 : 0);
    }
    s.obstacles.forEach((o, i) => this.obstacleBars[i]?.setX(dPx(o.d, s.dist)));
    s.coins.forEach((c, i) => this.coinSprites[i]?.setX(dPx(c.d, s.dist)));
    this.finishFlag?.setX(dPx(s.level.length, s.dist));
    if (this.progressFill !== null) {
      this.progressFill.width = Math.max(1, 420 * Math.min(1, s.dist / s.level.length));
    }
  }

  private finishRun(finished: boolean): void {
    if (this.over || this.state === null) return;
    this.over = true;
    const s = this.state;
    const stars = finished ? starsForRun(s) : 1;
    const coins = coinPayout(s.collected);
    this.wallet.earnRunner(coins);
    this.journal.log('jet_run_end', { level: s.level.id, stars, coins, collected: s.collected, finished, dist: Math.round(s.dist) });
    // Overlay objects join viewObjects so retry (startLevel -> clearView)
    // sweeps them like everything else.
    this.viewObjects.push(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(10));
    sfx(this, finished ? 'win-fanfare' : 'lose-soft');
    for (let i = 0; i < 3; i++) {
      const x = GAME_WIDTH / 2 + (i - 1) * 150;
      const slot = this.add.sprite(x, 470, 'img-ui-star').setDisplaySize(120, 112).setDepth(11).setTint(0x555566);
      this.viewObjects.push(slot);
      if (i < stars) {
        slot.clearTint();
        slot.setScale(0);
        this.tweens.add({ targets: slot, displayWidth: 120, displayHeight: 112, duration: 280, delay: 250 + i * 200, ease: 'Back.easeOut' });
        sfx(this, 'star-pop', { rate: 1 + i * 0.08, delay: (250 + i * 200) / 1000 });
      }
    }
    this.viewObjects.push(
      this.add.sprite(GAME_WIDTH / 2 - 50, 640, 'img-ui-coin').setDisplaySize(48, 48).setDepth(11),
      this.add.text(GAME_WIDTH / 2 - 14, 640, `+${coins}`, TS.number(44)).setOrigin(0, 0.5).setDepth(11),
    );
    const again = this.add.sprite(GAME_WIDTH / 2 - 90, 800, 'img-ui-retry').setDisplaySize(120, 120).setDepth(11).setInteractive();
    const homeBtn = this.add.sprite(GAME_WIDTH / 2 + 90, 800, 'img-ui-home').setDisplaySize(120, 120).setDepth(11).setInteractive();
    pressify(this, again);
    pressify(this, homeBtn);
    this.viewObjects.push(again, homeBtn);
    // Retry means THIS level again; home is the way back out.
    again.once('pointerup', () => this.startLevel(this.levelIndex));
    homeBtn.once('pointerup', () => goto(this, 'hub'));
  }
}
