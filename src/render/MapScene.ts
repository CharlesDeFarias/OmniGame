import Phaser from 'phaser';
import type { LevelDef, SpecialKind } from '../core/match3/index';
import { CHAPTERS, chapterById, type ChapterId } from '../meta/chapters';
import { createAdaptive, streakBonus } from '../services/adaptive';
import { BOOSTER_PRICES, buy, type ShopBoosterKind } from '../services/boosterShop';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { createWallet, type Wallet } from '../services/wallet';
import { createWardrobe } from '../services/wardrobe';
import { createBlips, type Blips } from './audio';
import { fadeIn, goto, pressify } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { loadLevels } from './levels';
import { mapWindow } from './mapWindow';
import { pieceTextureKey } from './packs';
import { PALETTE } from './palette';
import { setPendingBoosters } from './pendingBoosters';
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
  private pickerOpen = false;

  constructor() {
    super('map');
  }

  create(): void {
    fadeIn(this);
    // Scene objects from a previous visit are gone, but the instance persists:
    // reset the sheet latch or a play-through would lock the picker forever.
    this.pickerOpen = false;
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
    // Map dressing v2 (block 5): soft warm haze drifting across the vista
    // (ui-glow bakes gold — reads as sunlit candy-land air, deliberately warm)
    // and a few slow twinkles along the path band. Pure ambience, fire-and-loop.
    const clouds = [
      { y: 300, size: 340, dur: 52000, alpha: 0.12 },
      { y: 470, size: 260, dur: 41000, alpha: 0.1 },
      { y: 700, size: 300, dur: 60000, alpha: 0.08 },
    ];
    for (const [i, cl] of clouds.entries()) {
      const cloud = this.add
        .image(-200 + i * 380, cl.y, 'ui-glow')
        .setDisplaySize(cl.size, cl.size * 0.42)
        .setAlpha(cl.alpha)
        .setDepth(-2.5);
      // Drift right, wrap to the left edge, repeat. Recursive onComplete keeps
      // speed constant regardless of the staggered start; scene shutdown kills
      // the active tween, so the chain can't leak.
      const drift = (fromX: number): void => {
        cloud.setX(fromX);
        const span = GAME_WIDTH + 220 - fromX;
        this.tweens.add({
          targets: cloud,
          x: GAME_WIDTH + 220,
          duration: cl.dur * (span / (GAME_WIDTH + 440)),
          ease: 'Linear',
          onComplete: () => drift(-220),
        });
      };
      drift(cloud.x);
    }
    const twinkles = [
      { x: 96, y: 380, s: 30 }, { x: 636, y: 480, s: 24 }, { x: 120, y: 760, s: 26 },
      { x: 610, y: 860, s: 30 }, { x: 340, y: 300, s: 22 }, { x: 560, y: 640, s: 24 },
    ];
    twinkles.forEach((tw, i) => {
      const spark = this.add
        .image(tw.x, tw.y, `img-fx-sparkle-${(i % 3) + 1}`)
        .setDisplaySize(tw.s, tw.s)
        .setTint(0xfff2c4)
        .setAlpha(0.15)
        .setDepth(0)
        .setAngle(i * 30);
      this.tweens.add({
        targets: spark,
        alpha: 0.7,
        angle: spark.angle + 40,
        duration: 1700 + i * 300,
        delay: i * 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
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
        // Completed: glossy gold round button (block 5 restyle, RM-look).
        this.add.image(x, y, 'ui-node-gold').setDisplaySize(88, 88).setDepth(1);
        this.add.text(x, y - 4, label, TS.number(34)).setOrigin(0.5).setDepth(2);
      } else {
        // Locked ahead: dim round node, dim number (RM shows numbers on locked too).
        this.add.image(x, y, 'ui-node-grey').setDisplaySize(88, 88).setAlpha(0.55).setDepth(1);
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
    // Page-flip affordance (queue #33): page dots under the chapter banner
    // when the chapter spans multiple 10-level pages, plus faded trail stubs
    // where the path continues off this page.
    const pages = Math.ceil(levels.length / 10);
    if (pages > 1) {
      const page = Math.floor(start / 10);
      for (let d = 0; d < pages; d++) {
        const dot = this.add.circle(GAME_WIDTH / 2 + (d - (pages - 1) / 2) * 34, 200, 9, d === page ? PALETTE.gold : PALETTE.cream);
        dot.setAlpha(d === page ? 1 : 0.45).setDepth(5);
      }
      // Faded dotted stubs where the path continues beyond this page: fading
      // dots trail off below the first node (earlier page) / above the last
      // node (later page), angled clear of the play pill and banner.
      const stubDots = (x0: number, y0: number, dx: number, dy: number): void => {
        for (let d = 1; d <= 3; d++) {
          this.add.sprite(x0 + dx * d, y0 + dy * d, 'ui-pip')
            .setTint(PALETTE.cream).setScale(1.5).setAlpha(0.55 - d * 0.15).setDepth(0);
        }
      };
      if (start > 0) stubDots(NODE_X[0]!, nodeY(0), -8, 36);
      if (end < levels.length) {
        const lastLi = end - 1 - start;
        // dx 36 keeps the stub clear of the avatar standing on a top-row current node.
        stubDots(NODE_X[lastLi]!, nodeY(lastLi), 36, -30);
      }
    }
    // Chapter-forward arrow lives at the path top: only meaningful (and only
    // positioned correctly) on the last page.
    if (end === levels.length) this.maybeChapterArrow(levels, levelIndex);
  }

  /** Current level: bigger blue node, pulsing gold ring, avatar standing on it; tap -> play. */
  private buildCurrentNode(x: number, y: number, label: string): void {
    const node = this.add
      .image(x, y, 'ui-node-blue')
      .setDisplaySize(112, 112)
      .setDepth(1)
      .setInteractive();
    const numTxt = this.add.text(x, y - 4, label, TS.number(40)).setOrigin(0.5).setDepth(2);
    const ring = this.add.circle(x, y, 66).setStrokeStyle(6, PALETTE.gold).setDepth(1);
    this.tweens.add({ targets: ring, alpha: 0.4, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Current-node bounce (block 5): the node hops with its number and lands
    // with a bounce — reads as 'this one!' louder than the old scale pulse.
    // (Chain, not yoyo: Phaser has no yoyoEase, and the landing needs Bounce.)
    this.tweens.chain({
      targets: [node, numTxt],
      loop: -1,
      loopDelay: 560,
      tweens: [
        { y: '-=14', duration: 460, ease: 'Quad.easeOut', hold: 120 },
        { y: '+=14', duration: 460, ease: 'Bounce.easeOut' },
      ],
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
      this.openPicker();
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
    // Chapter banner (block 5: bigger, brighter): red ribbon + the chapter's
    // goal icon flanked by two tiny stars (icons-only).
    this.add.image(GAME_WIDTH / 2, 156, 'img-ui-banner').setDisplaySize(310, 82).setDepth(4);
    this.add.sprite(GAME_WIDTH / 2, 150, CHAPTER_ICON[this.progress.chapter]).setDisplaySize(54, 54).setDepth(5);
    this.add.sprite(GAME_WIDTH / 2 - 62, 152, 'img-ui-star-sm').setDisplaySize(26, 26).setDepth(5);
    this.add.sprite(GAME_WIDTH / 2 + 62, 152, 'img-ui-star-sm').setDisplaySize(26, 26).setDepth(5);
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
      this.openPicker();
    });
  }

  /**
   * Pre-level booster picker (RM anatomy, near-zero text): level number +
   * goal-icon preview + three booster toggle slots (coin prices from
   * BOOSTER_PRICES) + big green play pill. Nothing is charged until the play
   * pill is tapped (cancel = tap the dim); the free streak booster
   * (adaptive.streakBonus) arrives pre-selected with a gold spark marker and
   * is never charged. Total boosters cap at 2 (core StartOptions cap),
   * streak bonus first.
   */
  private openPicker(): void {
    if (this.pickerOpen) return;
    this.pickerOpen = true;
    const chapter = this.progress.chapter;
    const levels = loadLevels(chapter);
    const idx = Math.min(this.progress.levelIndexByChapter[chapter], levels.length - 1);
    const def: LevelDef = levels[idx]!;
    const pack = chapterById(chapter).packId;
    const label = String(parseInt(def.id.replace(/^[a-z]+-/, ''), 10));
    const free = streakBonus(createAdaptive(window.localStorage).state().streak);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const openedAt = this.time.now;
    const close = (): void => {
      for (const o of objs) o.destroy();
      this.pickerOpen = false;
    };
    // Dim = cancel (input.topOnly keeps taps on the sheet from reaching it).
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(30)
      .setInteractive();
    dim.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.downTime > openedAt) close();
    });
    objs.push(dim);
    objs.push(this.add.image(360, 600, 'img-ui-panel-cream').setDisplaySize(560, 700).setDepth(31).setInteractive());
    objs.push(this.add.text(360, 330, label, TS.numberTinted(64, '#0e1e3d')).setOrigin(0.5).setDepth(32));
    // Goal preview row: same icon mapping as PlayScene's HUD.
    const goals = def.goals;
    goals.forEach((goal, i) => {
      const iconKey =
        goal.type === 'collect' ? pieceTextureKey({ kind: 'normal', color: goal.color }, pack)
        : goal.type === 'clearBoxes' ? 'img-ob-box1'
        : 'img-ob-ice';
      const cx = 360 + (i - (goals.length - 1) / 2) * 110;
      objs.push(this.add.sprite(cx, 432, iconKey).setDisplaySize(60, 60).setDepth(32));
      objs.push(this.add.text(cx, 490, String(goal.count), TS.numberTinted(28, '#0e1e3d')).setOrigin(0.5).setDepth(32));
    });
    // Booster toggle slots.
    const kinds: { kind: ShopBoosterKind; x: number; icon: string }[] = [
      { kind: 'rocketH', x: 240, icon: 'img-sp-rocketH' },
      { kind: 'tnt', x: 360, icon: 'img-sp-tnt' },
      { kind: 'lightball', x: 480, icon: 'img-sp-lightball' },
    ];
    const selected = new Set<ShopBoosterKind>();
    const rings = new Map<ShopBoosterKind, Phaser.GameObjects.Arc>();
    const SLOT_Y = 620;
    for (const k of kinds) {
      const circle = this.add.circle(k.x, SLOT_Y, 56, 0xffffff).setStrokeStyle(4, 0xb9c0cf).setDepth(32).setInteractive();
      const icon = this.add.sprite(k.x, SLOT_Y, k.icon).setDisplaySize(74, 74).setDepth(33);
      const ring = this.add.circle(k.x, SLOT_Y, 63).setStrokeStyle(7, PALETTE.gold).setDepth(33).setVisible(k.kind === free);
      rings.set(k.kind, ring);
      objs.push(circle, icon, ring);
      if (k.kind === free) {
        // Free streak booster: spark marker instead of a price, never charged.
        objs.push(this.add.sprite(k.x, SLOT_Y + 92, 'img-fx-sparkle-1').setDisplaySize(42, 42).setTint(PALETTE.gold).setDepth(32));
      } else {
        objs.push(this.add.sprite(k.x - 26, SLOT_Y + 92, 'img-ui-coin').setDisplaySize(16, 24).setDepth(32));
        objs.push(
          this.add.text(k.x - 10, SLOT_Y + 92, String(BOOSTER_PRICES[k.kind]), TS.numberTinted(26, '#0e1e3d')).setOrigin(0, 0.5).setDepth(32),
        );
      }
      const wiggle = (): void => {
        this.tweens.add({ targets: icon, x: k.x + 8, duration: 45, yoyo: true, repeat: 3 });
      };
      pressify(this, circle, icon);
      circle.on('pointerup', () => {
        if (k.kind === free) return; // locked in, already free
        if (selected.has(k.kind)) {
          selected.delete(k.kind);
          ring.setVisible(false);
          return;
        }
        // Cap 2 total incl. the free one; then affordability of the whole set.
        if (selected.size + (free !== null ? 1 : 0) >= 2) {
          wiggle();
          return;
        }
        let cost = BOOSTER_PRICES[k.kind];
        for (const sel of selected) cost += BOOSTER_PRICES[sel];
        if (cost > this.wallet.data().coins) {
          wiggle();
          return;
        }
        selected.add(k.kind);
        ring.setVisible(true);
        this.blips.ding();
      });
    }
    // Big green play pill: buys the selected boosters NOW, stages them for
    // PlayScene, and goes. Level number only (near-zero text).
    const pill = this.add.image(360, 850, 'img-ui-btn-pill-green').setDisplaySize(300, 96).setDepth(32).setInteractive();
    const pillTxt = this.add.text(360, 846, label, TS.number(44)).setOrigin(0.5).setDepth(33);
    objs.push(pill, pillTxt);
    pressify(this, pill, pillTxt);
    pill.on('pointerup', () => {
      const start: SpecialKind[] = free !== null ? [free] : [];
      for (const kind of selected) {
        if (buy(kind, this.wallet)) {
          this.journal.log('booster_buy', { kind });
          start.push(kind);
        }
      }
      setPendingBoosters(start.slice(0, 2));
      this.blips.ding();
      goto(this, 'play');
    });
  }
}
