import Phaser from 'phaser';
import { CHAPTERS, chapterById, type ChapterId } from '../meta/chapters';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { createWallet, type Wallet } from '../services/wallet';
import { createWardrobe } from '../services/wardrobe';
import { createBlips, type Blips } from './audio';
import { fadeIn, goto, pressify } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { loadLevels } from './levels';
import { mapWindow } from './mapWindow';
import { PALETTE } from './palette';
import { makeAvatarTexture } from './theme';
import { TS } from './textStyles';

const BAR_Y = 70;

/** Chapter goal icon for the banner (same mapping as CareerScene's strip). */
const CHAPTER_ICON: Record<ChapterId, string> = {
  kitchen: 'ui-video',
  dance: 'ui-note',
  gym: 'ui-dumbbell',
  vanity: 'img-ui-heart',
};

/**
 * Ten path anchors snaking bottom -> top (saga-map S-curve): x hand-tuned to
 * swing across the left/right thirds of the 720 width, y at ~88px steps from
 * 1030 down to 238 (clear of the bottom bar below and the banner above).
 */
const NODE_X = [200, 340, 490, 540, 420, 270, 185, 250, 410, 520] as const;
const nodeY = (i: number): number => 1030 - i * 88;

type BarKey = 'coins' | 'followers' | 'hearts' | 'level';

/**
 * Saga-style level map (RM anatomy): candyland vista background, a winding
 * 10-node path for the ACTIVE chapter with per-level stars, the avatar on the
 * current node, currency strip + chapter banner up top and a MAP/ROOMS/HOME
 * bar + big PLAY pill at the bottom. This is the match-3 home screen; the
 * career room keeps its own play button and chapter strip untouched.
 */
export class MapScene extends Phaser.Scene {
  private wallet!: Wallet;
  private journal!: Journal;
  private blips!: Blips;
  private progress!: ProgressData;

  constructor() {
    super('map');
  }

  create(): void {
    fadeIn(this);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.progress = loadProgress(window.localStorage);
    // Same guard as CareerScene: never park the player on a locked chapter.
    if (this.wallet.level() < chapterById(this.progress.chapter).unlockLevel) {
      this.progress.chapter = 'kitchen';
      saveProgress(window.localStorage, this.progress);
    }
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    this.journal.log('map_open', { chapter: this.progress.chapter });
    this.buildBackdrop();
    this.buildPath();
    this.buildTopBar();
    this.buildBottomBar();
  }

  /** Candyland map art, cover-fit to 720x1280 (center crop), + dark vignette bands top/bottom for HUD readability. */
  private buildBackdrop(): void {
    const src = this.textures.get('img-bg-map').getSourceImage();
    const scale = Math.max(GAME_WIDTH / src.width, GAME_HEIGHT / src.height);
    this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'img-bg-map')
      .setDisplaySize(src.width * scale, src.height * scale)
      .setDepth(-3);
    // Vignette: stacked bands fading out (Graphics gradients are WebGL-only;
    // bands render identically under Canvas).
    const bandH = 44;
    for (let i = 0; i < 5; i++) {
      const alpha = 0.4 * (1 - i / 5);
      this.add
        .rectangle(GAME_WIDTH / 2, i * bandH + bandH / 2, GAME_WIDTH, bandH + 1, PALETTE.bgDeep, alpha)
        .setDepth(-2);
      this.add
        .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - i * bandH - bandH / 2, GAME_WIDTH, bandH + 1, PALETTE.bgDeep, alpha + 0.12)
        .setDepth(-2);
    }
  }

  /** Winding level path: dotted trail + one node per level of the active chapter. */
  private buildPath(): void {
    const chapter = this.progress.chapter;
    const levels = loadLevels(chapter);
    const levelIndex = Math.min(this.progress.levelIndexByChapter[chapter], levels.length - 1);
    // The anchor tables hold exactly 10 positions: page chapters longer than
    // ten levels, showing the 10-level window that contains the current level
    // (LOCAL index li drives anchors; the global index i drives level data).
    const { start, end } = mapWindow(levels.length, levelIndex);
    // Dotted trail: 3 small cream dots interpolated along each straight segment.
    for (let i = start; i < end - 1; i++) {
      const li = i - start;
      for (const t of [0.25, 0.5, 0.75]) {
        const x = NODE_X[li]! + (NODE_X[li + 1]! - NODE_X[li]!) * t;
        const y = nodeY(li) + (nodeY(li + 1) - nodeY(li)) * t;
        this.add.sprite(x, y, 'ui-pip').setTint(PALETTE.cream).setScale(1.5).setAlpha(0.5).setDepth(0);
      }
    }
    for (let i = start; i < end; i++) {
      const def = levels[i]!;
      const li = i - start;
      const x = NODE_X[li]!;
      const y = nodeY(li);
      const completed = this.progress.completed[def.id] === true;
      const current = i === levelIndex;
      // Global level number (kitchen-003 -> 3, vanity-041 -> 41): matches the
      // ledger's global 001..050 numbering, RM-style running count.
      const label = String(parseInt(def.id.replace(/^[a-z]+-/, ''), 10));
      if (current) {
        this.buildCurrentNode(x, y, label);
      } else if (completed) {
        // Gold node: the neutral grey FGG square tinted gold (no blank circle
        // in the pack; grey takes the gold tint cleanly -- judgment call).
        this.add.image(x, y, 'img-ui-btn-sq-grey').setDisplaySize(84, 84).setTint(PALETTE.gold).setDepth(1);
        this.add.text(x, y - 4, label, TS.number(34)).setOrigin(0.5).setDepth(2);
      } else {
        // Locked ahead: dim node, dim number (RM shows numbers on locked too).
        this.add.image(x, y, 'img-ui-btn-sq-grey').setDisplaySize(84, 84).setAlpha(0.5).setDepth(1);
        this.add.text(x, y - 4, label, TS.number(34)).setOrigin(0.5).setDepth(2).setAlpha(0.55);
      }
      // Up to 3 tiny gold stars below any earned node (per-level best).
      const stars = Math.min(3, this.progress.stars[def.id] ?? 0);
      for (let s = 0; s < stars; s++) {
        this.add
          .sprite(x + (s - (stars - 1) / 2) * 26, y + 52, 'img-ui-star-sm')
          .setDisplaySize(24, 24)
          .setDepth(2);
      }
    }
    // Chapter-forward arrow lives at the path top: only meaningful (and only
    // positioned correctly) on the last page.
    if (end === levels.length) this.maybeChapterArrow(levels, levelIndex);
  }

  /** Current level: bigger blue node, pulsing gold ring, avatar standing on it; tap -> play. */
  private buildCurrentNode(x: number, y: number, label: string): void {
    const node = this.add
      .image(x, y, 'img-ui-btn-sq-blue')
      .setDisplaySize(108, 108)
      .setDepth(1)
      .setInteractive();
    this.add.text(x, y - 4, label, TS.number(40)).setOrigin(0.5).setDepth(2);
    const ring = this.add.circle(x, y, 66).setStrokeStyle(6, PALETTE.gold).setDepth(1);
    this.tweens.add({ targets: ring, alpha: 0.4, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: node,
      scaleX: node.scaleX * 1.06,
      scaleY: node.scaleY * 1.06,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    // The influencer herself stands on the node (equipped wardrobe outfit when
    // one is set -- same pattern as PlayScene's dance break).
    const wardrobe = createWardrobe(window.localStorage);
    const equipped = wardrobe.state().equipped;
    const equippedColor = wardrobe.equippedColor();
    let avatarKey = 'avatar-o0-p0';
    if (equipped !== null && equippedColor !== null) {
      avatarKey = `avatar-w${equipped}-p0`;
      if (!this.textures.exists(avatarKey)) makeAvatarTexture(this, avatarKey, equippedColor, 0);
    }
    const avatar = this.add.sprite(x, y - 92, avatarKey).setDisplaySize(96, 96).setDepth(3);
    this.tweens.add({ targets: avatar, y: y - 100, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    pressify(this, node);
    node.on('pointerup', () => {
      this.blips.ding();
      goto(this, 'play');
    });
  }

  /**
   * Chapter-complete forward arrow at the path top: shown once the active
   * chapter's last level is done AND the next chapter is unlocked (same rules
   * as the career strip's badges). Tap advances progress.chapter and re-enters
   * the map on the new chapter's path.
   */
  private maybeChapterArrow(levels: { id: string }[], levelIndex: number): void {
    const last = levels[levels.length - 1];
    if (last === undefined || this.progress.completed[last.id] !== true) return;
    if (levelIndex < levels.length - 1) return;
    const idx = CHAPTERS.findIndex((ch) => ch.id === this.progress.chapter);
    const next = CHAPTERS[idx + 1];
    if (next === undefined || this.wallet.level() < next.unlockLevel) return;
    const ax = 620;
    const ay = 236;
    const glowBg = this.add.circle(ax, ay, 52, PALETTE.bgDeep, 0.55).setDepth(1);
    const arrow = this.add.sprite(ax, ay, 'img-ui-next').setDisplaySize(84, 84).setDepth(2).setInteractive();
    const icon = this.add.sprite(ax, ay - 62, CHAPTER_ICON[next.id]).setDisplaySize(44, 44).setDepth(2);
    this.tweens.add({
      targets: [arrow, icon],
      scale: '*=1.12',
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    pressify(this, arrow, glowBg);
    arrow.on('pointerup', () => {
      this.progress.chapter = next.id;
      saveProgress(window.localStorage, this.progress);
      this.journal.log('chapter_switch', { chapter: next.id });
      this.blips.ding();
      goto(this, 'map');
    });
  }

  /** Currency strip (hub pattern, read-once) + chapter banner with the chapter's goal icon. */
  private buildTopBar(): void {
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
    this.add.image(GAME_WIDTH / 2, BAR_Y, 'ui-panel').setDisplaySize(704, 92).setAlpha(0.45).setDepth(4);
    items.forEach((it, i) => {
      const x = 90 + i * 180;
      this.add.sprite(x - 44, BAR_Y, it.icon).setDisplaySize(it.icon === 'img-ui-coin' ? 30 : 44, 44).setDepth(5);
      this.add
        .text(x - 14, BAR_Y, values[it.k], TS.number(30))
        .setOrigin(0, 0.5)
        .setDepth(5);
    });
    // Chapter banner: red ribbon + the chapter's goal icon (icons-only).
    this.add.image(GAME_WIDTH / 2, 156, 'img-ui-banner').setDisplaySize(250, 66).setDepth(4);
    this.add.sprite(GAME_WIDTH / 2, 150, CHAPTER_ICON[this.progress.chapter]).setDisplaySize(46, 46).setDepth(5);
  }

  /** RM-style bottom bar: MAP (active) + ROOMS buttons, small HOME, big PLAY pill above. */
  private buildBottomBar(): void {
    this.add.image(GAME_WIDTH / 2, 1218, 'ui-panel').setDisplaySize(704, 122).setAlpha(0.45).setDepth(4);
    // MAP tab (this screen): green square wearing a mini path glyph (three
    // trail dots + a tiny star) + active gold ring, non-navigating.
    this.add.image(240, 1218, 'img-ui-btn-sq-green').setDisplaySize(92, 92).setDepth(5);
    this.add.circle(240, 1218, 52).setStrokeStyle(4, PALETTE.gold).setDepth(5);
    this.add.sprite(224, 1240, 'ui-pip').setTint(PALETTE.cream).setScale(1.3).setDepth(6);
    this.add.sprite(240, 1222, 'ui-pip').setTint(PALETTE.cream).setScale(1.3).setDepth(6);
    this.add.sprite(256, 1204, 'ui-pip').setTint(PALETTE.cream).setScale(1.3).setDepth(6);
    this.add.sprite(262, 1190, 'img-ui-star-sm').setDisplaySize(22, 22).setDepth(6);
    // ROOMS tab -> career (the furnishing slot marker she already knows).
    const rooms = this.add.image(480, 1218, 'img-ui-btn-sq-blue').setDisplaySize(92, 92).setDepth(5).setInteractive();
    const slot = this.add.sprite(480, 1218, 'ui-slot').setDisplaySize(52, 52).setDepth(6);
    pressify(this, rooms, slot);
    rooms.on('pointerup', () => {
      this.blips.ding();
      goto(this, 'career');
    });
    // Small HOME back to the hub.
    const home = this.add.sprite(64, 1218, 'img-ui-home').setDisplaySize(64, 64).setDepth(5).setInteractive();
    pressify(this, home);
    home.on('pointerup', () => goto(this, 'hub'));
    // Big PLAY pill, bottom-center above the bar: just the level number on it
    // (near-zero text). Same destination as the current node.
    const chapter = this.progress.chapter;
    const levels = loadLevels(chapter);
    const idx = Math.min(this.progress.levelIndexByChapter[chapter], levels.length - 1);
    const label = String(parseInt(levels[idx]!.id.replace(/^[a-z]+-/, ''), 10));
    const pill = this.add.image(GAME_WIDTH / 2, 1118, 'img-ui-btn-pill-green').setDisplaySize(264, 88).setDepth(5).setInteractive();
    const pillTxt = this.add.text(GAME_WIDTH / 2, 1114, label, TS.number(40)).setOrigin(0.5).setDepth(6);
    this.tweens.add({
      targets: [pill, pillTxt],
      scaleX: '*=1.05',
      scaleY: '*=1.05',
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    pressify(this, pill, pillTxt);
    pill.on('pointerup', () => {
      this.blips.ding();
      goto(this, 'play');
    });
  }
}
