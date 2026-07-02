import Phaser from 'phaser';
import { applyMove, startLevel, ShuffleError } from '../core/match3/index';
import type { Coord, GameState, LevelDef, MoveOutcome, PieceColor } from '../core/match3/index';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { createBlips, type Blips } from './audio';
import { planSteps, type Step } from './choreo';
import { BOTTOM_RESERVE, GAME_HEIGHT, GAME_WIDTH, TOP_RESERVE } from './config';
import { boardLayout, cellToXY, xyToCell, type Layout } from './layout';
import { loadLevels } from './levels';
import { makeTextures, textureKeyFor } from './theme';

const key = (c: Coord): string => `${c.x},${c.y}`;

export class PlayScene extends Phaser.Scene {
  private levels: LevelDef[] = [];
  private state!: GameState;
  private layout!: Layout;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private selected: Coord | null = null;
  private marker!: Phaser.GameObjects.Rectangle;
  private busy = false;
  private journal!: Journal;
  private progress!: ProgressData;
  private blips!: Blips;
  private movesText!: Phaser.GameObjects.Text;
  private goalHud: { icon: Phaser.GameObjects.Sprite; txt: Phaser.GameObjects.Text; color: PieceColor }[] = [];
  private retryCount = 0;
  private downAt: { cell: Coord; px: number; py: number } | null = null;

  constructor() {
    super('play');
  }

  create(): void {
    makeTextures(this, 96);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.progress = loadProgress(window.localStorage);
    this.blips = createBlips();
    this.levels = loadLevels();
    this.marker = this.add
      .rectangle(0, 0, 10, 10)
      .setStrokeStyle(5, 0xffffff)
      .setFillStyle(0, 0)
      .setVisible(false)
      .setDepth(5);
    this.movesText = this.add
      .text(GAME_WIDTH / 2, TOP_RESERVE * 0.72, '', { fontSize: '64px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
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
    const def = this.currentDef();
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
    this.journal.log('level_start', { level: def.id, retry: this.retryCount });
    this.buildGoalHud();
    this.syncBoard();
    this.updateHud();
  }

  private buildGoalHud(): void {
    for (const g of this.goalHud) { g.icon.destroy(); g.txt.destroy(); }
    this.goalHud = [];
    const n = this.state.goals.length;
    const spacing = 150;
    const x0 = GAME_WIDTH / 2 - ((n - 1) * spacing) / 2;
    this.state.goals.forEach((gs, i) => {
      const icon = this.add.sprite(x0 + i * spacing - 34, TOP_RESERVE * 0.32, `gem-${gs.goal.color}`).setDisplaySize(64, 64);
      const txt = this.add
        .text(x0 + i * spacing + 14, TOP_RESERVE * 0.32, '', { fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5);
      this.goalHud.push({ icon, txt, color: gs.goal.color });
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
    const b = this.state.board;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const piece = b.cells[y * b.width + x];
        if (piece === null || piece === undefined) continue;
        const { px, py } = cellToXY(this.layout, x, y);
        const sp = this.add.sprite(px, py, textureKeyFor(piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92);
        this.sprites.set(key({ x, y }), sp);
      }
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.blips.unlock();
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
    if (cell === null) {
      this.marker.setVisible(false);
      return;
    }
    const { px, py } = cellToXY(this.layout, cell.x, cell.y);
    this.marker.setPosition(px, py).setSize(this.layout.cell * 0.98, this.layout.cell * 0.98).setVisible(true);
  }

  private async attemptSwap(a: Coord, b: Coord): Promise<void> {
    let out: MoveOutcome;
    try {
      out = applyMove(this.state, a, b);
    } catch (e) {
      if (e instanceof ShuffleError) {
        this.journal.log('shuffle_error', { level: this.state.level.id, phase: 'move' });
        this.retryCount += 1;
        this.startCurrentLevel();
        return;
      }
      throw e;
    }
    if (out.invalid === true) {
      this.journal.log('invalid_move', { level: this.state.level.id, reason: out.reason ?? 'unknown' });
      if (out.reason === 'no-match') await Promise.all([this.wiggle(a), this.wiggle(b)]);
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
    this.state = out.state;
    this.journal.log('move', { level: this.state.level.id, movesLeft: this.state.movesLeft });
    for (const step of planSteps(out.events)) await this.animateStep(step);
    this.syncBoard();
    this.updateHud();
    if (out.gift !== undefined) {
      this.journal.log('gift', { level: this.state.level.id, moves: out.gift });
      await this.celebrateGift(out.gift);
    }
    if (this.state.status === 'won') await this.onWin();
    else if (this.state.status === 'lost') await this.onLose();
    this.busy = false;
  }

  private async animateStep(step: Step): Promise<void> {
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
        else this.blips.match();
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
        const sp = this.add.sprite(px, py, textureKeyFor(ev.piece)).setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92).setScale(0);
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
        const jobs: Promise<void>[] = [];
        for (const f of ev.fills) {
          const { px, py } = cellToXY(this.layout, f.coord.x, f.coord.y);
          const sp = this.add
            .sprite(px, this.layout.originY - this.layout.cell, textureKeyFor(f.piece))
            .setDisplaySize(this.layout.cell * 0.92, this.layout.cell * 0.92);
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
    }
  }

  private async celebrateGift(moves: number): Promise<void> {
    this.blips.gift();
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < moves; i++) {
      const pip = this.add.sprite(GAME_WIDTH / 2 + (i - moves / 2) * 60, GAME_HEIGHT / 2, 'ui-pip').setScale(2);
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
    this.journal.log('level_end', { level: this.state.level.id, won: true, movesLeft: this.state.movesLeft, retries: this.retryCount });
    this.blips.win();
    const dim = this.overlay();
    const stars: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 3; i++) {
      const st = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, GAME_HEIGHT * 0.38, 'ui-star').setDepth(11).setScale(0);
      stars.push(st);
      await this.tweenAsync({ targets: st, scale: 2.2, duration: 260, ease: 'Back.easeOut' });
    }
    const idx = this.progress.levelIndex;
    this.progress.completed[this.state.level.id] = true;
    if (idx < this.levels.length - 1) this.progress.levelIndex = idx + 1;
    saveProgress(window.localStorage, this.progress);
    const btn = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.62, 'ui-play').setDepth(11).setScale(2.4).setInteractive();
    btn.once('pointerup', () => {
      this.retryCount = 0;
      dim.destroy();
      stars.forEach((s) => s.destroy());
      btn.destroy();
      if (idx >= this.levels.length - 1) this.journal.log('chapter_complete', { chapter: 'kitchen' });
      this.startCurrentLevel();
    });
  }

  private async onLose(): Promise<void> {
    this.journal.log('level_end', { level: this.state.level.id, won: false, retries: this.retryCount });
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
