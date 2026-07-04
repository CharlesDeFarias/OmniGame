import Phaser from 'phaser';
import {
  advance,
  coinsForScore,
  createRng,
  startGate,
  type GateEvent,
  type GateLevelDef,
  type GateState,
  type Lane,
  type RNG,
} from '../core/gaterunner/index';
import { createJournal, type Journal } from '../services/journal';
import { createRunner, starsForRun, type RunnerProgress } from '../services/runner';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { buildBackground, fadeIn, goto, pressify } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { loadRunnerLevels } from './levels';
import { PALETTE } from './palette';
import { TS } from './textStyles';

/** Squad anchor: world scrolls left, the runners stay put. */
const SQUAD_X = GAME_WIDTH * 0.25;
/** Three horizontal lanes stacked vertically (portrait-friendly). */
const LANE_Y = [GAME_HEIGHT * 0.35, GAME_HEIGHT * 0.55, GAME_HEIGHT * 0.75] as const;
/** World-units-per-d: columns sit at d * SPACING inside the scrolling container. */
const SPACING = 340;
const MAX_PIPS = 24;
const PIP_SIZE = 36;
const SWIPE_MIN = 70;
/** Approach pacing: ~1.6s between columns at the start, gentle ramp to a 1.1s floor. */
const approachMs = (columnIndex: number): number => Math.max(1100, 1600 - columnIndex * 50);

/** Deterministic sunflower cluster: pip i's offset inside the squad (no RNG needed). */
const pipOffset = (i: number): { x: number; y: number } => {
  if (i === 0) return { x: 0, y: 0 };
  const a = i * 2.399963; // golden angle
  const rad = 13 + 11 * Math.sqrt(i);
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.7 };
};

const laneOf = (y: number): Lane => (y < 576 ? 0 : y < 832 ? 1 : 2);

/**
 * Gate-runner renderer (game #3, queue #20): horizontal auto-runner, near-zero
 * text (numbers and +/x symbols only). The pure core in src/core/gaterunner
 * owns all rules; this scene adds pacing, input and celebration. Relaxed but
 * alive: columns approach on a timer, but there is no other fail pressure.
 */
export class RunnerScene extends Phaser.Scene {
  private journal!: Journal;
  private wallet!: Wallet;
  private runner!: RunnerProgress;
  private blips!: Blips;
  private levels: GateLevelDef[] = [];
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private phase: 'select' | 'run' | 'over' = 'select';
  private levelIndex = 0;
  private level: GateLevelDef | null = null;
  private state: GateState | null = null;
  private requestedLane: Lane = 1;
  private rng: RNG = createRng(1);
  private world: Phaser.GameObjects.Container | null = null;
  private worldTween: Phaser.Tweens.Tween | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];
  private squad: Phaser.GameObjects.Container | null = null;
  private pips: Phaser.GameObjects.Sprite[] = [];
  private countText: Phaser.GameObjects.Text | null = null;
  private laneMarker: Phaser.GameObjects.Rectangle | null = null;
  /** Per column, per lane: the container/image to animate at resolution (null = empty cell). */
  private columnCells: (Phaser.GameObjects.Container | Phaser.GameObjects.Image | null)[][] = [];
  private downPt: { x: number; y: number } | null = null;

  constructor() {
    super('runner');
  }

  create(): void {
    fadeIn(this);
    // Scene instances persist across start/stop: reset per-run refs.
    this.viewObjects = [];
    this.timers = [];
    this.worldTween = null;
    this.phase = 'select';
    this.level = null;
    this.state = null;
    this.downPt = null;
    this.levels = loadRunnerLevels();
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.runner = createRunner(window.localStorage);
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Cool night-run variant of the shared gradient (plan 9 legit-look).
    buildBackground(this, 0x1f2b4a, PALETTE.bgPlum, PALETTE.bgDeep);
    // Lane-change input (only live while phase === 'run').
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    // Tweens/timers must not leak into the next scene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clearAll());
    this.journal.log('runner_open', {});
    this.showSelect();
  }

  // --- cleanup ---

  private clearRunTimers(): void {
    if (this.worldTween !== null) {
      this.worldTween.stop();
      this.worldTween = null;
    }
    for (const t of this.timers) t.remove();
    this.timers = [];
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  private clearAll(): void {
    this.clearRunTimers();
    for (const o of this.viewObjects) o.destroy();
    this.viewObjects = [];
    this.pips = [];
    this.world = null;
    this.squad = null;
    this.countText = null;
    this.laneMarker = null;
    this.columnCells = [];
    this.state = null;
    this.level = null;
  }

  // --- SELECT view: 3 level cards with best-star rows ---

  private showSelect(): void {
    this.clearAll();
    this.phase = 'select';
    // Header: flag logo center, coin display right, home (to hub) left.
    this.viewObjects.push(
      this.add.image(GAME_WIDTH / 2, 96, 'ui-panel').setDisplaySize(664, 128).setAlpha(0.45).setDepth(0),
      this.add.sprite(GAME_WIDTH / 2, 96, 'gr-flag').setDisplaySize(96, 96).setDepth(1),
      this.add.sprite(530, 96, 'ui-coin').setDisplaySize(44, 44).setDepth(1),
      this.add
        .text(560, 96, String(this.wallet.data().coins), TS.number(32))
        .setOrigin(0, 0.5)
        .setDepth(1),
    );
    const home = this.add.sprite(78, 96, 'ui-home').setDisplaySize(68, 68).setDepth(1).setInteractive();
    pressify(this, home);
    this.viewObjects.push(home);
    home.on('pointerup', () => goto(this, 'hub'));
    this.levels.forEach((level, i) => {
      const y = 400 + i * 230;
      const x = GAME_WIDTH / 2;
      const card = this.add.image(x, y, 'ui-panel').setDisplaySize(540, 200).setAlpha(0.95).setDepth(0).setInteractive();
      pressify(this, card);
      this.viewObjects.push(card);
      // Mini squad cluster + level number on the left.
      for (let pip = 0; pip < 3; pip++) {
        const off = pipOffset(pip);
        this.viewObjects.push(
          this.add.sprite(x - 170 + off.x * 1.2, y + off.y * 1.2, 'gr-pip').setDisplaySize(52, 52).setDepth(1),
        );
      }
      this.viewObjects.push(
        this.add
          .text(x - 92, y, String(i + 1), TS.number(52))
          .setOrigin(0.5)
          .setDepth(1),
      );
      // Best-star row from omnigame.runner.v1.
      const best = this.runner.bestFor(level.id);
      for (let st = 0; st < 3; st++) {
        const starSp = this.add.sprite(x + 30 + st * 66, y, 'ui-star').setDisplaySize(56, 56).setDepth(1);
        if (st >= best) starSp.setTint(0x555566).setAlpha(0.6);
        this.viewObjects.push(starSp);
      }
      card.on('pointerup', () => {
        if (this.phase !== 'select') return;
        this.blips.ding();
        this.startRun(i);
      });
    });
  }

  // --- RUN view ---

  private startRun(index: number): void {
    this.clearAll();
    this.levelIndex = index;
    const level = this.levels[index]!;
    this.level = level;
    this.state = startGate(level);
    this.requestedLane = this.state.lane;
    this.rng = createRng(level.seed);
    this.phase = 'run';
    this.journal.log('runner_start', { id: level.id });
    // Faint lane bands so the three tracks read at a glance.
    LANE_Y.forEach((y) => {
      this.viewObjects.push(
        this.add.rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, 200, PALETTE.bgPlumLight, 0.22).setDepth(-1),
      );
    });
    // Requested-lane indicator: subtle gold underline on the target lane.
    this.laneMarker = this.add
      .rectangle(SQUAD_X, LANE_Y[this.requestedLane] + 96, 180, 7, PALETTE.gold, 0.6)
      .setDepth(2);
    this.viewObjects.push(this.laneMarker);
    this.buildWorld(level);
    this.buildSquad(level.startCount);
    // Small home escape back to the level list (pausing/quitting is always fine).
    const home = this.add.sprite(60, 62, 'ui-home').setDisplaySize(56, 56).setAlpha(0.85).setDepth(6).setInteractive();
    pressify(this, home);
    this.viewObjects.push(home);
    home.on('pointerup', () => {
      if (this.phase !== 'run') return;
      this.showSelect();
    });
    this.scheduleNext();
  }

  /** All columns live in one container that tweens left; positions are d * SPACING. */
  private buildWorld(level: GateLevelDef): void {
    const world = this.add.container(SQUAD_X, 0).setDepth(1);
    this.world = world;
    this.viewObjects.push(world);
    this.columnCells = level.columns.map(() => [null, null, null]);
    level.columns.forEach((col, i) => {
      const x = col.d * SPACING;
      col.lanes.forEach((cell, laneIdx) => {
        const y = LANE_Y[laneIdx as Lane];
        if (cell.kind === 'empty') return;
        if (cell.kind === 'gate') {
          const panel = this.add.image(0, 0, 'gr-gate').setDisplaySize(190, 168);
          const label = this.add
            .text(0, 0, `${cell.op === 'add' ? '+' : '×'}${cell.value}`, TS.numberGold(54))
            .setOrigin(0.5);
          const cont = this.add.container(x, y, [panel, label]);
          world.add(cont);
          this.columnCells[i]![laneIdx] = cont;
          this.tweens.add({ targets: panel, alpha: 0.7, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (cell.kind === 'foe') {
          const cont = this.add.container(x, y);
          const n = Math.min(cell.count, 10);
          for (let f = 0; f < n; f++) {
            const off = pipOffset(f);
            cont.add(this.add.sprite(off.x, off.y * 0.9, 'gr-foe-pip').setDisplaySize(34, 34));
          }
          cont.add(
            this.add
              .text(0, -74, String(cell.count), TS.numberTinted(38, '#fd79a8'))
              .setOrigin(0.5),
          );
          world.add(cont);
          this.columnCells[i]![laneIdx] = cont;
        } else {
          const img = this.add.image(x, y, 'img-ob-box2').setDisplaySize(176, 176);
          world.add(img);
          this.columnCells[i]![laneIdx] = img;
        }
      });
    });
    // Finish flag one step past the last column, centre lane.
    const lastD = level.columns[level.columns.length - 1]!.d;
    world.add(this.add.sprite((lastD + 1) * SPACING, LANE_Y[1], 'gr-flag').setDisplaySize(300, 300));
  }

  private buildSquad(count: number): void {
    const squad = this.add.container(SQUAD_X, LANE_Y[1]).setDepth(3);
    this.squad = squad;
    this.viewObjects.push(squad);
    this.pips = [];
    this.countText = this.add
      .text(SQUAD_X, LANE_Y[1] - 118, String(count), TS.number(46))
      .setOrigin(0.5)
      .setDepth(4);
    this.viewObjects.push(this.countText);
    this.syncSquad(count, 'grow');
  }

  /** Reconciles the pip cluster and the count number with the core's count. */
  private syncSquad(count: number, mode: 'grow' | 'fall' | 'scatter'): void {
    const squad = this.squad;
    const countText = this.countText;
    if (squad === null || countText === null) return;
    const target = Math.min(count, MAX_PIPS);
    while (this.pips.length > target) {
      const pip = this.pips.pop()!;
      // Detach into scene space so it can fall away from the moving cluster.
      const gx = squad.x + pip.x;
      const gy = squad.y + pip.y;
      squad.remove(pip);
      pip.setPosition(gx, gy).setDepth(4);
      this.viewObjects.push(pip);
      const scatter = mode === 'scatter';
      this.tweens.add({
        targets: pip,
        x: gx + (this.rng.next() - 0.5) * (scatter ? 460 : 170),
        y: gy + (scatter ? -60 - this.rng.next() * 120 : 40) + (scatter ? 420 : 320),
        angle: (this.rng.next() - 0.5) * 320,
        alpha: 0,
        duration: scatter ? 600 : 480,
        ease: 'Quad.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
    while (this.pips.length < target) {
      const off = pipOffset(this.pips.length);
      const pip = this.add.sprite(0, 0, 'gr-pip');
      squad.add(pip);
      this.pips.push(pip);
      pip.setScale(0);
      this.tweens.add({
        targets: pip,
        x: off.x,
        y: off.y,
        scale: PIP_SIZE / 96,
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    countText.setText(String(count));
    this.tweens.add({ targets: countText, scale: 1.3, duration: 110, yoyo: true, onComplete: () => countText.setScale(1) });
  }

  // --- input: swipe up/down or tap a lane; the core clamps to adjacent ---

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'run') return;
    this.downPt = { x: p.x, y: p.y };
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (this.phase !== 'run' || this.downPt === null) return;
    const start = this.downPt;
    this.downPt = null;
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (Math.abs(dy) > SWIPE_MIN && Math.abs(dy) > Math.abs(dx)) {
      const next = Math.min(2, Math.max(0, this.requestedLane + Math.sign(dy))) as Lane;
      this.setRequestedLane(next);
      return;
    }
    if (Math.hypot(dx, dy) > SWIPE_MIN) return; // sideways drag: ignore
    if (p.y < 300 || p.y > GAME_HEIGHT - 120) return; // header/footer taps are not lane picks
    this.setRequestedLane(laneOf(p.y));
  }

  private setRequestedLane(lane: Lane): void {
    if (lane === this.requestedLane) return;
    this.requestedLane = lane;
    if (this.laneMarker !== null) {
      this.tweens.add({ targets: this.laneMarker, y: LANE_Y[lane] + 96, duration: 150, ease: 'Quad.easeOut' });
    }
    this.moveSquadToward();
  }

  /** Anticipation: the squad drifts one lane toward the request (the core's clamp). */
  private moveSquadToward(): void {
    const state = this.state;
    const squad = this.squad;
    if (state === null || squad === null || state.done) return;
    const step = Math.sign(this.requestedLane - state.lane);
    const visual = (state.lane + step) as Lane;
    const targetY = LANE_Y[visual];
    if (squad.y !== targetY) {
      this.tweens.add({ targets: squad, y: targetY, duration: 190, ease: 'Quad.easeOut' });
      if (this.countText !== null) {
        this.tweens.add({ targets: this.countText, y: targetY - 118, duration: 190, ease: 'Quad.easeOut' });
      }
    }
  }

  // --- pacing + resolution ---

  private scheduleNext(): void {
    const level = this.level;
    const state = this.state;
    const world = this.world;
    if (level === null || state === null || world === null || state.done || this.phase !== 'run') return;
    const col = level.columns[state.nextColumnIndex];
    if (col === undefined) return;
    this.worldTween = this.tweens.add({
      targets: world,
      x: SQUAD_X - col.d * SPACING,
      duration: approachMs(state.nextColumnIndex),
      ease: 'Linear',
      onComplete: () => {
        this.worldTween = null;
        this.resolveColumn();
      },
    });
  }

  private resolveColumn(): void {
    const level = this.level;
    const state = this.state;
    if (level === null || state === null || this.phase !== 'run') return;
    const colIndex = state.nextColumnIndex;
    const res = advance(state, level, this.requestedLane);
    this.state = res.state;
    // Settle the squad on the lane the core resolved (deflects bounce it back).
    this.settleSquad(res.state.lane);
    let at = 0;
    for (const ev of res.events) at = this.playEvent(ev, colIndex, at);
    if (res.state.done) {
      if (!res.state.won) this.later(Math.max(700, at + 300), () => this.loseRun());
      return; // win path continues from the finish event
    }
    this.later(Math.max(220, at), () => {
      this.moveSquadToward();
      this.scheduleNext();
    });
  }

  private settleSquad(lane: Lane): void {
    const squad = this.squad;
    if (squad === null) return;
    const y = LANE_Y[lane];
    if (squad.y !== y) {
      this.tweens.add({ targets: squad, y, duration: 140, ease: 'Quad.easeOut' });
      if (this.countText !== null) this.tweens.add({ targets: this.countText, y: y - 118, duration: 140 });
    }
  }

  /** Animates one core event; returns the delay offset for any event after it. */
  private playEvent(ev: GateEvent, colIndex: number, at: number): number {
    const cellObj = (lane: Lane): Phaser.GameObjects.Container | Phaser.GameObjects.Image | null =>
      this.columnCells[colIndex]?.[lane] ?? null;
    switch (ev.type) {
      case 'gate': {
        const obj = cellObj(this.state?.lane ?? 1);
        this.blips.matchAt(Math.min(colIndex, 6));
        if (obj !== null) {
          this.tweens.add({ targets: obj, scaleX: 1.25, scaleY: 1.25, alpha: 0.25, duration: 320, ease: 'Quad.easeOut' });
        }
        this.syncSquad(ev.countAfter, 'grow');
        return at + 120;
      }
      case 'foe': {
        const obj = cellObj(this.state?.lane ?? 1);
        if (obj instanceof Phaser.GameObjects.Container) {
          // Dark pips tumble off; the count label fades with them.
          for (const child of obj.list) {
            this.tweens.add({
              targets: child,
              y: (child as Phaser.GameObjects.Sprite).y + 300 + this.rng.next() * 120,
              x: (child as Phaser.GameObjects.Sprite).x + (this.rng.next() - 0.5) * 200,
              alpha: 0,
              angle: (this.rng.next() - 0.5) * 240,
              duration: 520,
              ease: 'Quad.easeIn',
            });
          }
        }
        this.flashSquad(0xe74c3c);
        this.syncSquad(ev.countAfter, 'fall');
        return at + 200;
      }
      case 'wall': {
        // Head-on crash: camera shake + pips scatter.
        this.cameras.main.shake(220, 0.012);
        const obj = cellObj(this.state?.lane ?? 1);
        if (obj !== null) this.wiggle(obj);
        this.flashSquad(0xe74c3c);
        this.syncSquad(ev.countAfter, 'scatter');
        return at + 250;
      }
      case 'deflect': {
        // Bounce off the wall lane: squad squashes horizontally, wall shakes.
        const obj = cellObj(ev.lane);
        if (obj !== null) this.wiggle(obj);
        const squad = this.squad;
        if (squad !== null) {
          this.tweens.add({ targets: squad, scaleX: 0.68, duration: 110, yoyo: true, onComplete: () => squad.setScale(1) });
        }
        return at + 150;
      }
      case 'revive': {
        // The big moment: golden ring-light burst, half the squad re-forms.
        this.later(at + 350, () => {
          if (this.phase === 'select') return;
          this.blips.booster();
          const squad = this.squad;
          const cx = squad?.x ?? SQUAD_X;
          const cy = squad?.y ?? LANE_Y[1];
          const ring = this.add.sprite(cx, cy, 'ui-ringlight').setDisplaySize(60, 60).setDepth(5).setTint(PALETTE.gold);
          this.viewObjects.push(ring);
          this.tweens.add({
            targets: ring,
            displayWidth: 460,
            displayHeight: 460,
            alpha: 0,
            duration: 640,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy(),
          });
          const flash = this.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xf5c542, 0.4)
            .setDepth(11);
          this.viewObjects.push(flash);
          this.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
          this.syncSquad(ev.count, 'grow');
        });
        return at + 900;
      }
      case 'finish': {
        this.later(at, () => this.finishRun(ev.count, ev.score));
        return at;
      }
    }
  }

  private flashSquad(tint: number): void {
    for (const pip of this.pips) {
      pip.setTintFill(tint);
    }
    this.later(140, () => {
      for (const pip of this.pips) if (pip.active) pip.clearTint();
    });
  }

  private wiggle(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image): void {
    const x = obj.x;
    this.tweens.add({ targets: obj, x: x + 14, duration: 50, yoyo: true, repeat: 3, onComplete: () => obj.setX(x) });
  }

  // --- endings ---

  private finishRun(count: number, score: number): void {
    const level = this.level;
    const state = this.state;
    if (level === null || state === null || this.phase !== 'run') return;
    this.phase = 'over';
    // Wallet + best + journal FIRST: an interrupted celebration can't lose a win.
    const coins = coinsForScore(score);
    const stars = starsForRun(state.revived, count, level.startCount);
    this.wallet.earnRunner(coins);
    this.runner.record(level.id, stars);
    this.journal.log('runner_done', { id: level.id, stars, count, coins });
    this.blips.win();
    // Flag sweep: the finish flag glides in to meet the squad.
    if (this.world !== null) {
      this.tweens.add({ targets: this.world, x: this.world.x - SPACING, duration: 520, ease: 'Quad.easeOut' });
    }
    this.later(620, () => this.showWinOverlay(stars, coins));
  }

  private showWinOverlay(stars: 1 | 2 | 3, coins: number): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(10)
      .setInteractive();
    const panel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(540, 560).setDepth(11);
    this.viewObjects.push(dim, panel);
    // Star slots + earned pops (same feel as cooking's plating).
    for (let i = 0; i < 3; i++) {
      const slot = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 130, GAME_HEIGHT / 2 - 140, 'ui-star')
        .setDisplaySize(96, 96)
        .setTint(0x555566)
        .setDepth(12);
      this.viewObjects.push(slot);
    }
    for (let i = 0; i < stars; i++) {
      const st = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 130, GAME_HEIGHT / 2 - 140, 'ui-star')
        .setDisplaySize(96, 96)
        .setScale(0)
        .setDepth(13);
      this.viewObjects.push(st);
      this.tweens.add({ targets: st, scale: 1, duration: 240, delay: 200 + i * 220, ease: 'Back.easeOut' });
    }
    // Coin payout (already in the wallet).
    this.viewObjects.push(
      this.add.sprite(GAME_WIDTH / 2 - 56, GAME_HEIGHT / 2, 'ui-coin').setDisplaySize(56, 56).setDepth(12),
      this.add
        .text(GAME_WIDTH / 2 - 16, GAME_HEIGHT / 2, `+${coins}`, TS.number(44))
        .setOrigin(0, 0.5)
        .setDepth(12),
    );
    this.overlayButtons();
  }

  private loseRun(): void {
    const level = this.level;
    if (level === null || this.phase !== 'run') return;
    this.phase = 'over';
    this.journal.log('runner_lost', { id: level.id });
    this.blips.lose();
    // Gentle: soft dim, no harsh flash; retry front and centre.
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setDepth(10)
      .setInteractive();
    const panel = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(540, 460).setDepth(11);
    this.viewObjects.push(dim, panel);
    this.overlayButtons();
  }

  /** Retry (same level, deterministic layout) + home to the hub. */
  private overlayButtons(): void {
    const y = GAME_HEIGHT / 2 + 150;
    const retry = this.add
      .sprite(GAME_WIDTH / 2 - 110, y, 'ui-retry')
      .setDisplaySize(130, 130)
      .setDepth(12)
      .setInteractive();
    const home = this.add.sprite(GAME_WIDTH / 2 + 110, y, 'ui-home').setDisplaySize(130, 130).setDepth(12).setInteractive();
    pressify(this, retry);
    pressify(this, home);
    this.viewObjects.push(retry, home);
    this.tweens.add({ targets: retry, scale: retry.scale * 1.08, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    retry.once('pointerup', () => {
      this.blips.ding();
      this.startRun(this.levelIndex);
    });
    home.once('pointerup', () => goto(this, 'hub'));
  }
}
