import Phaser from 'phaser';
import { createJournal, type Journal } from '../services/journal';
import { summarize } from '../services/stats';
import { createTasks, TASK_ICONS, type Tasks } from '../services/tasks';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { TASK_ICON_TEXTURE } from './taskIcons';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { makeTextures } from './theme';

const BAR_Y = 70;

type BarKey = 'coins' | 'followers' | 'hearts' | 'level';

/**
 * Game-picker front door (plan 8): ring-light logo, shared currency bar, two big
 * gold-framed game cards (match-3 career, cooking) and two locked teaser cards.
 */
export class HubScene extends Phaser.Scene {
  private wallet!: Wallet;
  private blips!: Blips;
  private journal!: Journal;
  private tasks!: Tasks;
  private secretTaps: number[] = [];
  private parentObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('hub');
  }

  create(): void {
    makeTextures(this, 96);
    // Scene instances persist across start/stop: reset per-run refs.
    this.secretTaps = [];
    this.parentObjects = [];
    this.wallet = createWallet(window.localStorage);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.tasks = createTasks(window.localStorage);
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Stage bands, same studio feel as PlayScene.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.125, GAME_WIDTH, GAME_HEIGHT * 0.25, PALETTE.bgPlum, 0.8)
      .setDepth(-2);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.875, GAME_WIDTH, GAME_HEIGHT * 0.25, PALETTE.bgDeep, 0.9)
      .setDepth(-2);
    // Logo: static heart-ring on top of a slowly rotating plain ring light
    // (judgment call: rotating the heart itself looks broken; the spin lives
    // on the bulb ring behind it).
    const spin = this.add.image(GAME_WIDTH / 2, 230, 'ui-ringlight').setDisplaySize(300, 300).setAlpha(0.45);
    this.tweens.add({ targets: spin, angle: 360, duration: 24000, repeat: -1 });
    this.add.image(GAME_WIDTH / 2, 230, 'ui-logo-ring').setDisplaySize(250, 250);
    this.buildBar();
    // Hidden parent corner (decision #17 pattern, same as PlayScene): invisible
    // top-left hotspot, 5 quick taps open the manager/parent panel.
    this.add
      .rectangle(45, 45, 90, 90, 0xffffff, 0.001)
      .setDepth(20)
      .setInteractive()
      .on('pointerdown', () => this.onSecretTap());
    // Two big game cards, stacked (portrait).
    this.gameCard(510, 'career', (x, y) => {
      // Match-3: gem cluster.
      this.add.sprite(x - 70, y + 6, 'gem-red').setDisplaySize(108, 108).setDepth(2);
      this.add.sprite(x + 62, y - 34, 'gem-blue').setDisplaySize(100, 100).setDepth(2);
      this.add.sprite(x + 40, y + 56, 'gem-green').setDisplaySize(92, 92).setDepth(2);
    });
    this.gameCard(830, 'cooking', (x, y) => {
      this.add.sprite(x, y, 'ui-pan-card').setDisplaySize(170, 170).setDepth(2);
    });
    // Two dimmed teaser cards: future games, purely visual (no handlers).
    const teasers: { x: number; icon: string }[] = [
      { x: 210, icon: 'sp-rocketH' },
      { x: 510, icon: 'ob-box2' },
    ];
    for (const t of teasers) {
      this.add.image(t.x, 1090, 'ui-panel').setDisplaySize(250, 170).setAlpha(0.35);
      this.add.sprite(t.x - 34, 1090, t.icon).setDisplaySize(84, 84).setTint(0x555566).setAlpha(0.55).setDepth(1);
      this.add.sprite(t.x + 62, 1090, 'ui-lock').setDisplaySize(56, 56).setDepth(2);
    }
  }

  /** Big gold-framed card: panel + gentle pulse; tap starts the target scene. */
  private gameCard(y: number, target: string, decorate: (x: number, y: number) => void): void {
    const x = GAME_WIDTH / 2;
    const card = this.add.image(x, y, 'ui-panel').setDisplaySize(520, 280).setAlpha(0.95).setDepth(1).setInteractive();
    this.tweens.add({
      targets: card,
      scaleX: card.scaleX * 1.02,
      scaleY: card.scaleY * 1.02,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    decorate(x, y);
    card.on('pointerup', () => {
      this.blips.ding();
      this.scene.start(target);
    });
  }

  /**
   * Currency bar, duplicated from CareerScene's buildBar rather than extracted
   * (judgment call per plan: two small copies beat a premature shared module;
   * hub values are read-once, no refresh loop needed).
   */
  private buildBar(): void {
    const items: { icon: string; k: BarKey }[] = [
      { icon: 'ui-coin', k: 'coins' },
      { icon: 'ui-follower', k: 'followers' },
      { icon: 'ui-heart', k: 'hearts' },
      { icon: 'ui-levelbadge', k: 'level' },
    ];
    const d = this.wallet.data();
    const values: Record<BarKey, string> = {
      coins: String(d.coins),
      followers: String(d.followers),
      hearts: String(d.hearts),
      level: String(this.wallet.level()),
    };
    items.forEach((it, i) => {
      const x = 90 + i * 180;
      this.add.image(x, BAR_Y, 'ui-panel').setDisplaySize(168, 84).setAlpha(0.3).setDepth(1);
      this.add.sprite(x - 44, BAR_Y, it.icon).setDisplaySize(44, 44).setDepth(2);
      this.add
        .text(x - 14, BAR_Y, values[it.k], {
          fontSize: '30px', fontStyle: 'bold', color: PALETTE.textOnDark, stroke: '#141428', strokeThickness: 6,
        })
        .setOrigin(0, 0.5)
        .setDepth(2);
    });
  }
  private onSecretTap(): void {
    const now = Date.now();
    this.secretTaps = this.secretTaps.filter((t) => now - t < 2500);
    this.secretTaps.push(now);
    if (this.secretTaps.length >= 5) {
      this.secretTaps = [];
      this.openParentPanel();
    }
  }

  private openParentPanel(): void {
    if (this.parentObjects.length > 0) return;
    this.journal.log('parent_panel_viewed', {});
    this.buildParentPanel();
  }

  /**
   * Manager/parent panel (decision #50). Charles-facing, so text is allowed
   * here (same rule as PlayScene's stats overlay). Rebuilt in place after every
   * task action; the dim layer swallows taps to the hub underneath and closes
   * the panel on its own pointerup (same input-leak guard as the stats overlay).
   */
  private buildParentPanel(): void {
    for (const o of this.parentObjects) o.destroy();
    this.parentObjects = [];
    const objs = this.parentObjects;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.75)
      .setDepth(21)
      .setInteractive();
    dim.on('pointerup', () => this.closeParentPanel());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(620, 1000).setDepth(22));
    const textStyle = { fontSize: '32px', color: '#ffffff' };
    // Compact stats summary: plays / wins / win rate (full detail stays in PlayScene's overlay).
    const stats = summarize(this.journal.read());
    const summary: { icon: string | null; value: string }[] = [
      { icon: 'ui-play', value: String(stats.levelsPlayed) },
      { icon: 'ui-star', value: String(stats.wins) },
      { icon: null, value: `${Math.round(stats.winRate * 100)}%` },
    ];
    summary.forEach((row, i) => {
      const x = 165 + i * 160;
      if (row.icon !== null) objs.push(this.add.sprite(x - 28, 220, row.icon).setDisplaySize(40, 40).setDepth(23));
      objs.push(this.add.text(x, 220, row.value, textStyle).setOrigin(0, 0.5).setDepth(23));
    });
    // Assignment buttons: one per task icon; tap assigns that practice task.
    TASK_ICONS.forEach((icon, i) => {
      const x = 130 + i * 115;
      const y = 330;
      const btn = this.add.image(x, y, 'ui-panel').setDisplaySize(96, 96).setAlpha(0.5).setDepth(23).setInteractive();
      objs.push(btn);
      objs.push(this.add.sprite(x, y, TASK_ICON_TEXTURE[icon]).setDisplaySize(56, 56).setDepth(24));
      btn.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.tasks.create(icon, Date.now());
          this.journal.log('task_created', { icon });
          this.blips.ding();
          this.buildParentPanel();
        },
      );
    });
    // Task list, newest-capped at 8 rows: icon + created-order number + done
    // toggle (empty ring = pending, gold check fill = done) + remove.
    const all = this.tasks.all();
    const rows = all.slice(-8);
    const baseIndex = all.length - rows.length;
    rows.forEach((task, i) => {
      const y = 434 + i * 74;
      objs.push(this.add.sprite(120, y, TASK_ICON_TEXTURE[task.icon]).setDisplaySize(48, 48).setDepth(23));
      objs.push(this.add.text(170, y, String(baseIndex + i + 1), textStyle).setOrigin(0, 0.5).setDepth(23));
      const toggle = this.add
        .circle(510, y, 22, PALETTE.gold, task.done ? 1 : 0)
        .setStrokeStyle(4, PALETTE.gold)
        .setDepth(23)
        .setInteractive();
      objs.push(toggle);
      if (task.done) {
        objs.push(
          this.add
            .text(510, y, '\u2713', { fontSize: '30px', fontStyle: 'bold', color: '#141428' })
            .setOrigin(0.5)
            .setDepth(24),
        );
      }
      toggle.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          const nowDone = this.tasks.toggleDone(task.id, Date.now());
          this.journal.log('task_toggled', { icon: task.icon, done: nowDone });
          this.blips.ding();
          this.buildParentPanel();
        },
      );
      const remove = this.add
        .text(586, y, '\u00d7', { fontSize: '44px', color: '#777788' })
        .setOrigin(0.5)
        .setDepth(23)
        .setInteractive();
      objs.push(remove);
      remove.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.tasks.remove(task.id);
          this.journal.log('task_removed', { icon: task.icon });
          this.buildParentPanel();
        },
      );
    });
  }

  private closeParentPanel(): void {
    for (const o of this.parentObjects) o.destroy();
    this.parentObjects = [];
  }
}
