import Phaser from 'phaser';
import { APP_IDENTITY } from '../config/appIdentity';
import { PROFILE } from '../config/profile';
import { createJournal, type Journal } from '../services/journal';
import { createIdbBackend, createMusicStore, MAX_TRACK_BYTES, type MusicStore } from '../services/music';
import { loadProgress } from '../services/progress';
import { createRunner } from '../services/runner';
import { summarize } from '../services/stats';
import { createTasks, TASK_ICONS, type Tasks } from '../services/tasks';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { buildBackground, fadeIn, goto, pressify } from './chrome';
import { loadRunnerLevels } from './levels';
import { TASK_ICON_TEXTURE } from './taskIcons';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { TS } from './textStyles';

const BAR_Y = 70;

/** Influencer level that opens the gate-runner card (early treat, before gym at 4). */
const RUNNER_UNLOCK_LEVEL = 2;

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
  private music!: MusicStore;
  private musicTracks: { id: string; name: string }[] = [];
  private musicAddBtn: Phaser.GameObjects.Image | null = null;
  private secretTaps: number[] = [];
  private parentObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('hub');
  }

  create(): void {
    fadeIn(this);
    // Scene instances persist across start/stop: reset per-run refs.
    this.secretTaps = [];
    this.parentObjects = [];
    this.wallet = createWallet(window.localStorage);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.tasks = createTasks(window.localStorage);
    this.music = createMusicStore(createIdbBackend());
    this.musicTracks = [];
    this.musicAddBtn = null;
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Smooth studio-night gradient + ambient glow + bokeh (plan 9 legit-look).
    buildBackground(this, PALETTE.bgPlumLight, PALETTE.bgPlum, PALETTE.bgDeep);
    // Logo lockup (plan 9): gold glow + slowly rotating ring light + static
    // heart-ring + the app name beneath. The name is brand chrome, exempt from
    // the near-zero-text rule (judgment call, logged); it comes from the
    // profile so a public-layer swap rebrands the hub too.
    this.add.image(GAME_WIDTH / 2, 190, 'ui-glow').setDisplaySize(430, 430).setAlpha(0.35).setDepth(-1);
    const spin = this.add.image(GAME_WIDTH / 2, 190, 'ui-ringlight').setDisplaySize(250, 250).setAlpha(0.45);
    this.tweens.add({ targets: spin, angle: 360, duration: 24000, repeat: -1 });
    this.add.image(GAME_WIDTH / 2, 190, 'ui-logo-ring').setDisplaySize(210, 210);
    this.add.text(GAME_WIDTH / 2, 340, APP_IDENTITY.name, TS.display(64)).setOrigin(0.5).setDepth(1);
    this.buildBar();
    // Hidden parent corner (decision #17 pattern, same as PlayScene): invisible
    // top-left hotspot, 5 quick taps open the manager/parent panel.
    this.add
      .rectangle(45, 45, 90, 90, 0xffffff, 0.001)
      .setDepth(20)
      .setInteractive()
      .on('pointerdown', () => this.onSecretTap());
    // Two big game cards, stacked (portrait): icon cluster left, progress
    // hint right (numbers only — stays inside the near-zero-text rule).
    const matchStars = Object.values(loadProgress(window.localStorage).stars).reduce((a, b) => a + b, 0);
    // Diner card badge: completed shifts (the old recipesDone stat belongs to
    // the unrouted recipe flow and would freeze forever).
    const shiftsDone = this.journal.read().filter((e) => e.type === 'diner_shift_end').length;
    this.gameCard(510, 'map', { icon: 'img-ui-star', value: matchStars }, (x, y) => {
      // Match-3: piece cluster.
      this.add.sprite(x - 36, y + 8, 'img-shape-red').setDisplaySize(96, 96).setDepth(2);
      this.add.sprite(x + 50, y - 34, 'img-shape-blue').setDisplaySize(84, 84).setDepth(2);
      this.add.sprite(x + 40, y + 50, 'img-shape-green').setDisplaySize(76, 76).setDepth(2);
    }, 'Puzzle');
    // Decision #62: the Cooking card opens the DINER; the recipe flow stays
    // in the codebase unrouted.
    this.gameCard(830, 'diner', { icon: 'ui-check', value: shiftsDone }, (x, y) => {
      this.add.sprite(x, y, 'ui-pan-card').setDisplaySize(150, 150).setDepth(2);
    }, 'Cooking');
    // Gate-runner card (game #3): real once influencer level >= 2 (early treat);
    // below that it stays dimmed with a lock + level badge, chapter-strip style.
    this.runnerCard(210, 1090);
    // Tower teaser card: future game, purely visual (no handler) — dimmer and
    // smaller than the real cards so it reads as 'someday', not 'tap me'.
    this.add.image(515, 1090, 'ui-panel').setDisplaySize(210, 144).setAlpha(0.26);
    this.add.sprite(486, 1090, 'img-ob-box2').setDisplaySize(70, 70).setTint(0x555566).setAlpha(0.45).setDepth(1);
    this.add.sprite(566, 1090, 'img-ui-lock').setDisplaySize(48, 48).setAlpha(0.8).setDepth(2);
  }

  /** Gate-runner hub card: squad-pip cluster + finish flag; tap starts the runner. */
  private runnerCard(x: number, y: number): void {
    const unlocked = this.wallet.level() >= RUNNER_UNLOCK_LEVEL;
    const card = this.add.image(x, y, 'ui-panel').setDisplaySize(250, 170).setAlpha(unlocked ? 0.95 : 0.35);
    const flag = this.add.sprite(x + 54, y - 6, 'gr-flag').setDisplaySize(90, 90).setDepth(1);
    const pipOffsets = [
      { dx: -64, dy: 10 },
      { dx: -30, dy: -16 },
      { dx: -16, dy: 26 },
    ];
    const pips = pipOffsets.map(({ dx, dy }) =>
      this.add.sprite(x + dx, y + dy, 'gr-pip').setDisplaySize(50, 50).setDepth(1),
    );
    if (!unlocked) {
      flag.setTint(0x555566).setAlpha(0.55);
      for (const pip of pips) pip.setTint(0x555566).setAlpha(0.55);
      this.add.sprite(x + 74, y + 52, 'img-ui-lock').setDisplaySize(52, 52).setDepth(2);
      this.add.sprite(x + 74, y - 44, 'ui-levelbadge').setDisplaySize(40, 40).setDepth(2);
      this.add
        .text(x + 74, y - 42, String(RUNNER_UNLOCK_LEVEL), TS.number(24))
        .setOrigin(0.5)
        .setDepth(3);
      return;
    }
    // Star-progress hint, bottom-right: total stars across runner levels.
    const rp = createRunner(window.localStorage);
    const runnerStars = loadRunnerLevels().reduce((a, l) => a + rp.bestFor(l.id), 0);
    this.add
      .text(x + 40, y + 56, String(runnerStars), TS.number(30))
      .setOrigin(1, 0.5)
      .setDepth(2);
    this.add.sprite(x + 68, y + 56, 'img-ui-star').setDisplaySize(34, 34).setDepth(2);
    this.tweens.add({
      targets: card,
      scaleX: card.scaleX * 1.02,
      scaleY: card.scaleY * 1.02,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    card.setInteractive();
    pressify(this, card);
    card.on('pointerup', () => {
      this.blips.ding();
      goto(this, 'runner');
    });
  }

  /**
   * Big gold-framed game card (plan 9 facelift): shadow panel + a thin blush
   * CTA strip (btn-pill stretched — judgment call: restretching the pill keeps
   * one texture instead of baking a bespoke strip) + icon cluster left + a
   * mini progress hint right. Gentle pulse; tap starts the target scene.
   */
  private gameCard(
    y: number,
    target: string,
    hint: { icon: string; value: number },
    decorate: (x: number, y: number) => void,
    label?: string,
  ): void {
    const x = GAME_WIDTH / 2;
    // Kenney-look pass: cards sit on the family's blue flat panel; the CTA
    // strip becomes the green pill (same texture the map's PLAY uses).
    const card = this.add.image(x, y, 'img-ui-panel-blue').setDisplaySize(560, 250).setDepth(1).setInteractive();
    const strip = this.add.image(x, y + 82, 'img-ui-btn-pill-green').setDisplaySize(480, 46).setAlpha(0.9).setDepth(1.5);
    // textTier 'minimal' (Charles 2026-07-10): a single friendly word per card
    // — pure icons overshot into confusing.
    if (PROFILE.textTier !== 'none' && label !== undefined) {
      this.add.text(x, y + 82, label, TS.label(28)).setOrigin(0.5).setDepth(2);
    }
    this.tweens.add({
      targets: card,
      scaleX: card.scaleX * 1.02,
      scaleY: card.scaleY * 1.02,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    decorate(x - 150, y - 14);
    // Progress hint: number + icon on the card's right half (TS.number(30)).
    this.add
      .text(x + 128, y - 14, String(hint.value), TS.number(30))
      .setOrigin(1, 0.5)
      .setDepth(2);
    this.add.sprite(x + 160, y - 14, hint.icon).setDisplaySize(44, 44).setDepth(2);
    pressify(this, card, strip);
    card.on('pointerup', () => {
      this.blips.ding();
      goto(this, target);
    });
  }

  /**
   * Currency bar, duplicated from CareerScene's buildBar rather than extracted
   * (judgment call per plan: two small copies beat a premature shared module;
   * hub values are read-once, no refresh loop needed).
   */
  private buildBar(): void {
    const items: { icon: string; k: BarKey }[] = [
      { icon: 'img-ui-coin', k: 'coins' },
      { icon: 'ui-follower', k: 'followers' },
      { icon: 'img-ui-heart', k: 'hearts' },
      { icon: 'ui-levelbadge', k: 'level' },
    ];
    const d = this.wallet.data();
    const values: Record<BarKey, string> = {
      coins: String(d.coins),
      followers: String(d.followers),
      hearts: String(d.hearts),
      level: String(this.wallet.level()),
    };
    // One wide strip instead of four floating chips (plan 9 facelift).
    this.add.image(GAME_WIDTH / 2, BAR_Y, 'ui-panel').setDisplaySize(704, 92).setAlpha(0.35).setDepth(1);
    items.forEach((it, i) => {
      const x = 90 + i * 180;
      this.add.sprite(x - 44, BAR_Y, it.icon).setDisplaySize(44, 44).setDepth(2);
      this.add
        .text(x - 14, BAR_Y, values[it.k], TS.number(30))
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
    void this.refreshMusic();
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
    const openedAt = this.time.now;
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.downTime > openedAt) this.closeParentPanel();
    });
    objs.push(dim);
    // Parent-facing overlay: cream FGG panel (commit-3 GUI pass); the plum task
    // chips + dark-outlined text keep their contrast on the light ground.
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'img-ui-panel-cream').setDisplaySize(620, 1000).setDepth(22));
    // The manager IS the brother (decision #61): he fronts his own panel,
    // reviewing his sister's stats. Toon Character, CC0 (docs/ART-BIBLE.md).
    if (this.textures.exists('img-toon-bro-idle')) {
      // y 218: feet clear the 5th task chip (top edge 282) below him.
      objs.push(this.add.sprite(585, 218, 'img-toon-bro-idle').setDisplaySize(96, 122).setDepth(23));
    }
    const textStyle = TS.number(32);
    // Compact stats summary: plays / wins / win rate (full detail stays in PlayScene's overlay).
    const stats = summarize(this.journal.read());
    const summary: { icon: string | null; value: string }[] = [
      { icon: 'img-ui-play', value: String(stats.levelsPlayed) },
      { icon: 'img-ui-star', value: String(stats.wins) },
      { icon: null, value: `${Math.round(stats.winRate * 100)}%` },
    ];
    summary.forEach((row, i) => {
      const x = 165 + i * 160;
      if (row.icon !== null) objs.push(this.add.sprite(x - 28, 220, row.icon).setDisplaySize(40, 40).setDepth(23));
      objs.push(this.add.text(x, 220, row.value, textStyle).setOrigin(0, 0.5).setDepth(23));
    });
    // Assignment buttons: one per task icon; tap assigns that practice task.
    if (PROFILE.features.managerTasks) {
      TASK_ICONS.forEach((icon, i) => {
        const x = 130 + i * 115;
        const y = 330;
        const btn = this.add.image(x, y, 'ui-panel').setDisplaySize(96, 96).setAlpha(0.5).setDepth(23).setInteractive();
        pressify(this, btn);
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
    }
    // Task list, newest-capped at 8 rows: icon + created-order number + done
    // toggle (empty ring = pending, gold check fill = done) + remove.
    const all = PROFILE.features.managerTasks ? this.tasks.all() : [];
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
      pressify(this, toggle);
      objs.push(toggle);
      if (task.done) {
        objs.push(
          this.add
            .text(510, y, '\u2713', TS.glyph(30, '#0e1e3d'))
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
        .text(586, y, '\u00d7', TS.glyph(44, '#777788'))
        .setOrigin(0.5)
        .setDepth(23)
        .setInteractive();
      pressify(this, remove);
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
    // Her-playlist section (decision #37): note icon + stored-track count on the
    // left, add button on the right, then up to 5 per-track rows. Parent-facing,
    // so text is allowed. Sits below the task list; rows that would spill past
    // the panel bottom are clipped (the count always shows the true total).
    if (PROFILE.features.playlistMusic) {
      const musicY = 434 + rows.length * 74 + 30;
      objs.push(this.add.sprite(120, musicY, 'ui-note').setDisplaySize(48, 48).setDepth(23));
      objs.push(this.add.text(160, musicY, String(this.musicTracks.length), textStyle).setOrigin(0, 0.5).setDepth(23));
      const addBtn = this.add.image(540, musicY, 'ui-panel').setDisplaySize(96, 96).setAlpha(0.5).setDepth(23).setInteractive();
      pressify(this, addBtn);
      this.musicAddBtn = addBtn;
      objs.push(addBtn);
      objs.push(this.add.sprite(526, musicY, 'ui-note').setDisplaySize(44, 44).setDepth(24));
      objs.push(
        this.add
          .text(566, musicY - 2, '+', TS.glyph(44, '#f5e6c8'))
          .setOrigin(0.5)
          .setDepth(24),
      );
      addBtn.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.pickMusicFiles();
        },
      );
      this.musicTracks.slice(0, 5).forEach((track, i) => {
        const y = musicY + 76 + i * 56;
        if (y > 1108) return;
        const name = track.name.length > 18 ? `${track.name.slice(0, 18)}\u2026` : track.name;
        objs.push(
          this.add.text(110, y, name, TS.glyph(26, '#ffffff')).setOrigin(0, 0.5).setDepth(23),
        );
        const removeTrack = this.add
          .text(586, y, '\u00d7', TS.glyph(44, '#777788'))
          .setOrigin(0.5)
          .setDepth(23)
          .setInteractive();
        pressify(this, removeTrack);
        objs.push(removeTrack);
        removeTrack.on(
          'pointerup',
          (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            void this.music.remove(track.id).then(
              () => this.refreshMusic(),
              () => {},
            );
          },
        );
      });
    }
  }

  /** Re-reads the stored playlist; rebuilds the panel in place if it is open. */
  private async refreshMusic(): Promise<void> {
    try {
      this.musicTracks = await this.music.tracks();
    } catch {
      this.musicTracks = []; // no IndexedDB in this browser: empty playlist
    }
    if (this.parentObjects.length > 0) this.buildParentPanel();
  }

  /**
   * Hidden file input (audio/*, multiple), created on demand and removed from
   * the DOM after change/cancel. Local-only: files go straight into the
   * on-device IndexedDB store and never leave the device.
   */
  private pickMusicFiles(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      void this.addMusicFiles(files);
    });
    input.addEventListener('cancel', () => input.remove());
    input.click();
  }

  private async addMusicFiles(files: File[]): Promise<void> {
    let added = 0;
    let failed = false;
    for (const f of files) {
      if (f.size > MAX_TRACK_BYTES) {
        failed = true; // size guard before reading the bytes at all
        continue;
      }
      try {
        await this.music.addFile(f.name, await f.arrayBuffer());
        added += 1;
      } catch {
        failed = true; // 20-track cap (or backend failure)
      }
    }
    if (added > 0) {
      this.journal.log('music_added', { count: added });
      this.blips.ding();
    }
    await this.refreshMusic();
    if (failed) this.wiggleAdd();
  }

  /** Cap-hit feedback: quick horizontal wiggle on the add button (same feel as the board's no-match wiggle). */
  private wiggleAdd(): void {
    const btn = this.musicAddBtn;
    if (btn === null || !btn.active) return;
    const x = btn.x;
    this.tweens.add({ targets: btn, x: x + 12, duration: 55, yoyo: true, repeat: 3, onComplete: () => btn.setX(x) });
  }

  private closeParentPanel(): void {
    for (const o of this.parentObjects) o.destroy();
    this.parentObjects = [];
    this.musicAddBtn = null;
  }
}
