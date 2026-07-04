import Phaser from 'phaser';
import { PROFILE } from '../config/profile';
import { CHAPTERS, chapterById, type ChapterId } from '../meta/chapters';
import { ROOMS, type RoomSlot } from '../meta/rooms';
import { RECIPES } from '../core/cooking/recipes';
import type { IngredientId } from '../core/cooking/types';
import { WARDROBE } from '../meta/wardrobe';
import { createCooking, type CookingProgress } from '../services/cooking';
import { createPantry, groceryListFor, GROCERY_PRICE, type Pantry } from '../services/pantry';
import { createFurnishing, type Furnishing } from '../services/furnishing';
import { createJournal, type Journal } from '../services/journal';
import { loadProgress, saveProgress, type ProgressData } from '../services/progress';
import { createTasks, type Tasks } from '../services/tasks';
import { createWallet, type Wallet } from '../services/wallet';
import { createWardrobe, type Wardrobe } from '../services/wardrobe';
import { createBlips, type Blips } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { TASK_ICON_TEXTURE } from './taskIcons';
import { makeAvatarTexture, makeTextures } from './theme';

const BAR_Y = 70;
const ROOM_TOP = 150;
const WALL_SPLIT = 510;
const ROOM_BOTTOM = 750;
const STRIP_Y = 830;

type BarKey = 'coins' | 'followers' | 'hearts' | 'level';

/** Wall band tint per chapter (floor band stays shared). */
const WALL_TINT: Record<ChapterId, number> = {
  kitchen: 0x3a2b52,
  dance: 0x4a2b62,
  gym: 0x2f4a45,
  vanity: 0x522b47,
};

const STRIP_ICON: Record<ChapterId, string> = {
  kitchen: 'ui-video',
  dance: 'ui-note',
  gym: 'ui-dumbbell',
  vanity: 'ui-heart',
};

/** Influencer career hub: currency bar, furnishable room per chapter, chapter strip, wardrobe, play button. */
export class CareerScene extends Phaser.Scene {
  private wallet!: Wallet;
  private furnishing!: Furnishing;
  private wardrobe!: Wardrobe;
  private tasks!: Tasks;
  private cooking!: CookingProgress;
  private pantry!: Pantry;
  private progress!: ProgressData;
  private journal!: Journal;
  private blips!: Blips;
  private barTexts: Record<BarKey, Phaser.GameObjects.Text> | null = null;
  private wallRect!: Phaser.GameObjects.Rectangle;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private stripObjects: Phaser.GameObjects.GameObject[] = [];
  private pickerObjects: Phaser.GameObjects.GameObject[] = [];
  private videoObjects: Phaser.GameObjects.GameObject[] = [];
  private wardrobeObjects: Phaser.GameObjects.GameObject[] = [];
  private assignObjects: Phaser.GameObjects.GameObject[] = [];
  private groceryObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('career');
  }

  create(): void {
    makeTextures(this, 96);
    // Scene instances persist across start/stop: reset per-run refs.
    this.barTexts = null;
    this.roomObjects = [];
    this.stripObjects = [];
    this.pickerObjects = [];
    this.videoObjects = [];
    this.wardrobeObjects = [];
    this.assignObjects = [];
    this.groceryObjects = [];
    // Fresh services from storage each create (cheap; shared state lives in localStorage).
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.furnishing = createFurnishing(window.localStorage);
    this.wardrobe = createWardrobe(window.localStorage);
    this.tasks = createTasks(window.localStorage);
    this.cooking = createCooking(window.localStorage);
    this.pantry = createPantry(window.localStorage);
    this.progress = loadProgress(window.localStorage);
    // Safety: never leave the player parked on a chapter their level no longer unlocks.
    if (this.wallet.level() < chapterById(this.progress.chapter).unlockLevel) {
      this.progress.chapter = 'kitchen';
      saveProgress(window.localStorage, this.progress);
    }
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Room backdrop: wall band (tinted per chapter) + floor band.
    this.wallRect = this.add
      .rectangle(GAME_WIDTH / 2, (ROOM_TOP + WALL_SPLIT) / 2, GAME_WIDTH, WALL_SPLIT - ROOM_TOP, WALL_TINT[this.progress.chapter])
      .setDepth(-1);
    this.add
      .rectangle(GAME_WIDTH / 2, (WALL_SPLIT + ROOM_BOTTOM) / 2, GAME_WIDTH, ROOM_BOTTOM - WALL_SPLIT, 0x2a2a3e)
      .setDepth(-1);
    // Studio motif: big soft ring light glowing behind the room view band.
    this.add
      .image(GAME_WIDTH / 2, (ROOM_TOP + ROOM_BOTTOM) / 2, 'ui-ringlight')
      .setDisplaySize(640, 640)
      .setAlpha(0.5)
      .setDepth(-0.5);
    this.buildBar();
    this.drawRoom();
    this.buildChapterStrip();
    // Home button back to the hub (plan 8). The literal top-left corner is the
    // currency bar's coin panel, so "top-left" means top-left of the room view;
    // the hanger moves one slot down to make space (judgment call).
    const home = this.add
      .sprite(64, ROOM_TOP + 56, 'ui-home')
      .setDisplaySize(64, 64)
      .setDepth(2)
      .setInteractive();
    home.on('pointerup', () => {
      if (this.overlayOpen()) return;
      this.scene.start('hub');
    });
    // Wardrobe shop button: hanger, below the home button.
    const hanger = this.add
      .sprite(64, ROOM_TOP + 156, 'ui-hanger')
      .setDisplaySize(64, 64)
      .setDepth(2)
      .setInteractive();
    hanger.on('pointerup', () => this.openWardrobe());
    // Grocery shop button (decision #52): basket right below the hanger — the
    // clipboard moves one slot further down (judgment call, same column rhythm).
    const basket = this.add
      .sprite(64, ROOM_TOP + 256, 'ui-basket')
      .setDisplaySize(64, 64)
      .setDepth(2)
      .setInteractive();
    basket.on('pointerup', () => this.openGrocery());
    const play = this.add
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT - 220, 'ui-play')
      .setScale(2.8)
      .setDepth(2)
      .setInteractive();
    this.tweens.add({ targets: play, scale: 3.0, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    play.on('pointerup', () => {
      if (this.overlayOpen()) return;
      this.scene.start('play');
    });
    this.buildClipboardButton();
    this.maybeFilmVideo();
    this.rewardCompletedTasks();
  }

  private overlayOpen(): boolean {
    return (
      this.pickerObjects.length > 0 ||
      this.videoObjects.length > 0 ||
      this.wardrobeObjects.length > 0 ||
      this.assignObjects.length > 0 ||
      this.groceryObjects.length > 0
    );
  }

  private activeChapter(): ChapterId {
    return this.progress.chapter;
  }

  private buildBar(): void {
    const items: { icon: string; k: BarKey }[] = [
      { icon: 'ui-coin', k: 'coins' },
      { icon: 'ui-follower', k: 'followers' },
      { icon: 'ui-heart', k: 'hearts' },
      { icon: 'ui-levelbadge', k: 'level' },
    ];
    const texts = {} as Record<BarKey, Phaser.GameObjects.Text>;
    items.forEach((it, i) => {
      const x = 90 + i * 180;
      this.add.image(x, BAR_Y, 'ui-panel').setDisplaySize(168, 84).setAlpha(0.3).setDepth(1);
      this.add.sprite(x - 44, BAR_Y, it.icon).setDisplaySize(44, 44).setDepth(2);
      texts[it.k] = this.add
        .text(x - 14, BAR_Y, '', { fontSize: '30px', fontStyle: 'bold', color: PALETTE.textOnDark, stroke: '#141428', strokeThickness: 6 })
        .setOrigin(0, 0.5)
        .setDepth(2);
    });
    this.barTexts = texts;
    this.refreshBar();
  }

  private refreshBar(): void {
    if (this.barTexts === null) return;
    const d = this.wallet.data();
    this.barTexts.coins.setText(String(d.coins));
    this.barTexts.followers.setText(String(d.followers));
    this.barTexts.hearts.setText(String(d.hearts));
    this.barTexts.level.setText(String(this.wallet.level()));
  }

  /** Two rows of three slot anchors: back row against the wall, front row on the floor. */
  private slotAnchor(i: number): { x: number; y: number } {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return { x: 150 + col * 210, y: row === 0 ? 430 : 630 };
  }

  private drawRoom(): void {
    for (const o of this.roomObjects) o.destroy();
    this.roomObjects = [];
    const chapter = this.activeChapter();
    const furnished = this.furnishing.state().rooms[chapter];
    const coins = this.wallet.data().coins;
    ROOMS[chapter].forEach((slot, i) => {
      const { x, y } = this.slotAnchor(i);
      const styleId = furnished[slot.id];
      if (styleId !== undefined) {
        this.roomObjects.push(
          this.add.sprite(x, y, `${slot.textureBase}-${styleId}`).setDisplaySize(140, 140).setDepth(1),
        );
        return;
      }
      const price = slot.choices[0]?.price ?? 0;
      const marker = this.add
        .sprite(x, y, 'ui-slot')
        .setDisplaySize(140, 140)
        .setAlpha(0.6)
        .setDepth(1)
        .setInteractive();
      marker.on('pointerup', () => this.openPicker(slot));
      const tagIcon = this.add.sprite(x - 28, y + 96, 'ui-coin').setDisplaySize(34, 34).setDepth(1);
      const tagTxt = this.add
        .text(x - 6, y + 96, String(price), { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5)
        .setDepth(1);
      this.roomObjects.push(marker, tagIcon, tagTxt);
      if (coins >= price) {
        this.tweens.add({
          targets: marker,
          scaleX: marker.scaleX * 1.08,
          scaleY: marker.scaleY * 1.08,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  private openPicker(slot: RoomSlot): void {
    if (this.overlayOpen()) return;
    const chapter = this.activeChapter();
    const objs = this.pickerObjects;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(10)
      .setInteractive();
    dim.on('pointerup', () => this.closePicker());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(660, 360).setDepth(11));
    slot.choices.forEach((choice, i) => {
      const x = GAME_WIDTH / 2 + (i - 1) * 210;
      const y = GAME_HEIGHT / 2 - 24;
      const sp = this.add
        .sprite(x, y, `${slot.textureBase}-${choice.styleId}`)
        .setDisplaySize(150, 150)
        .setDepth(12)
        .setInteractive();
      const icon = this.add.sprite(x - 26, y + 112, 'ui-coin').setDisplaySize(32, 32).setDepth(12);
      const txt = this.add
        .text(x - 4, y + 112, String(choice.price), { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
        .setOrigin(0, 0.5)
        .setDepth(12);
      objs.push(sp, icon, txt);
      sp.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (this.furnishing.furnish(chapter, slot.id, choice.styleId, this.wallet)) {
            this.journal.log('furnish', { chapter, slot: slot.id, style: choice.styleId });
            this.closePicker();
            this.drawRoom();
            this.refreshBar();
            this.maybeFilmVideo();
          } else {
            this.tweens.add({ targets: sp, x: sp.x + 9, duration: 45, yoyo: true, repeat: 3 });
          }
        },
      );
    });
  }

  private closePicker(): void {
    for (const o of this.pickerObjects) o.destroy();
    this.pickerObjects = [];
  }

  /** Functional chapter strip: unlocked chapters tap-to-switch, locked ones dim with a level badge. */
  private buildChapterStrip(): void {
    for (const o of this.stripObjects) o.destroy();
    this.stripObjects = [];
    const xs = [135, 285, 435, 585];
    const lvl = this.wallet.level();
    CHAPTERS.forEach((ch, i) => {
      const x = xs[i]!;
      const unlocked = lvl >= ch.unlockLevel;
      const active = ch.id === this.activeChapter();
      const bg = this.add.circle(x, STRIP_Y, 44, 0x2c2c54, unlocked ? 0.9 : 0.45).setDepth(1);
      const icon = this.add
        .sprite(x, STRIP_Y, STRIP_ICON[ch.id])
        .setDisplaySize(unlocked ? 56 : 48, unlocked ? 56 : 48)
        .setDepth(2);
      this.stripObjects.push(bg, icon);
      if (!unlocked) {
        icon.setTint(0x555566).setAlpha(0.7);
        const badge = this.add.sprite(x + 30, STRIP_Y + 28, 'ui-levelbadge').setDisplaySize(36, 36).setDepth(3);
        const num = this.add
          .text(x + 30, STRIP_Y + 30, String(ch.unlockLevel), { fontSize: '22px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(4);
        this.stripObjects.push(badge, num);
        return;
      }
      if (active) {
        const ring = this.add.circle(x, STRIP_Y, 48).setStrokeStyle(5, PALETTE.gold).setDepth(2);
        this.tweens.add({ targets: ring, alpha: 0.7, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.stripObjects.push(ring);
      }
      // Newly-unlocked chapter: add looping pulse cue
      if (!active && ch.unlockLevel === lvl) {
        this.tweens.add({ targets: icon, scale: icon.scale * 1.15, duration: 500, yoyo: true, repeat: -1 });
      }
      bg.setInteractive();
      bg.on('pointerup', () => {
        if (this.overlayOpen()) return;
        this.switchChapter(ch.id);
      });
    });
  }

  private switchChapter(id: ChapterId): void {
    if (this.activeChapter() === id) return;
    this.progress.chapter = id;
    saveProgress(window.localStorage, this.progress);
    this.journal.log('chapter_switch', { chapter: id });
    this.wallRect.setFillStyle(WALL_TINT[id]);
    this.drawRoom();
    this.buildChapterStrip();
    this.maybeFilmVideo();
  }

  // --- Wardrobe shop (plan 6.5 coin sink, decision #36) ---

  /** Ensures avatar textures exist for a wardrobe outfit; returns the key prefix. */
  private wardrobeAvatarPrefix(id: string, color: number, poses: readonly (0 | 1 | 2)[]): string {
    const prefix = `avatar-w${id}`;
    for (const pose of poses) {
      const key = `${prefix}-p${pose}`;
      if (!this.textures.exists(key)) makeAvatarTexture(this, key, color, pose);
    }
    return prefix;
  }

  private openWardrobe(): void {
    if (this.overlayOpen()) return;
    this.buildWardrobe();
  }

  /** 6 outfits in 2 rows of 3: price tag when unowned, check when owned, gold ring when equipped. */
  private buildWardrobe(): void {
    for (const o of this.wardrobeObjects) o.destroy();
    this.wardrobeObjects = [];
    const objs = this.wardrobeObjects;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(10)
      .setInteractive();
    dim.on('pointerup', () => this.closeWardrobe());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(680, 660).setDepth(11));
    const state = this.wardrobe.state();
    WARDROBE.forEach((item, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = GAME_WIDTH / 2 + (col - 1) * 210;
      const y = GAME_HEIGHT / 2 - 155 + row * 310;
      const prefix = this.wardrobeAvatarPrefix(item.id, item.outfitColor, [0]);
      const owned = state.owned.includes(item.id);
      const equipped = state.equipped === item.id;
      const sp = this.add.sprite(x, y, `${prefix}-p0`).setDisplaySize(170, 170).setDepth(12).setInteractive();
      objs.push(sp);
      if (equipped) {
        objs.push(this.add.circle(x, y, 94).setStrokeStyle(5, 0xf1c40f).setDepth(12));
      }
      if (owned) {
        objs.push(
          this.add
            .text(x, y + 112, '✓', { fontSize: '36px', fontStyle: 'bold', color: '#2ecc71' })
            .setOrigin(0.5)
            .setDepth(12),
        );
      } else {
        objs.push(this.add.sprite(x - 28, y + 112, 'ui-coin').setDisplaySize(32, 32).setDepth(12));
        objs.push(
          this.add
            .text(x - 6, y + 112, String(item.price), { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' })
            .setOrigin(0, 0.5)
            .setDepth(12),
        );
      }
      sp.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (owned) {
            if (this.wardrobe.equip(item.id)) {
              this.journal.log('wardrobe_equip', { outfit: item.id });
              this.blips.ding();
              this.buildWardrobe();
            }
          } else if (this.wardrobe.buy(item.id, this.wallet)) {
            this.journal.log('wardrobe_buy', { outfit: item.id, price: item.price });
            this.blips.ding();
            this.refreshBar();
            this.buildWardrobe();
          } else {
            this.tweens.add({ targets: sp, x: sp.x + 9, duration: 45, yoyo: true, repeat: 3 });
          }
        },
      );
    });
  }

  private closeWardrobe(): void {
    for (const o of this.wardrobeObjects) o.destroy();
    this.wardrobeObjects = [];
  }

  // --- Grocery shop (decision #52) ---

  /** Unique gather-set ingredients across all UNLOCKED recipes that are currently stocked. */
  private stockedItems(): IngredientId[] {
    const unlocked = RECIPES.slice(0, this.cooking.data().unlocked);
    const seen = new Set<IngredientId>();
    for (const recipe of unlocked) {
      for (const step of recipe.steps) {
        if (step.type !== 'gather') continue;
        for (const id of step.ingredients) seen.add(id);
      }
    }
    return [...seen].filter((id) => this.pantry.stockOf(id) > 0).sort();
  }

  private openGrocery(): void {
    if (this.overlayOpen()) return;
    this.buildGrocery();
  }

  /**
   * Picture shopping list: the groceryListFor items (icon + coin price, tap to buy)
   * followed by already-stocked items wearing a count badge. Stocked items remain
   * tappable — buying spare units means more protected runs (judgment call).
   * Empty list -> big happy check. Near-zero text: only price/count numbers.
   */
  private buildGrocery(): void {
    for (const o of this.groceryObjects) o.destroy();
    this.groceryObjects = [];
    const objs = this.groceryObjects;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      .setDepth(10)
      .setInteractive();
    dim.on('pointerup', () => this.closeGrocery());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(660, 780).setDepth(11));
    objs.push(this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 310, 'ui-basket').setDisplaySize(96, 96).setDepth(12));
    const unlocked = RECIPES.slice(0, this.cooking.data().unlocked);
    const need = groceryListFor(unlocked, this.pantry);
    const stocked = this.stockedItems();
    const cellX = (col: number): number => GAME_WIDTH / 2 + (col - 1.5) * 152;
    const gridTop = GAME_HEIGHT / 2 - 180;
    let row = 0;
    if (need.length === 0) {
      // Everything on the list is stocked: happy check with a little pop.
      const check = this.add.sprite(GAME_WIDTH / 2, gridTop + 10, 'ui-check').setDisplaySize(150, 150).setDepth(12);
      objs.push(check);
      this.tweens.add({ targets: check, scaleX: check.scaleX * 1.12, scaleY: check.scaleY * 1.12, duration: 420, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      row = 1;
    }
    const cells: { id: IngredientId; isStocked: boolean }[] = [
      ...need.map((id) => ({ id, isStocked: false })),
      ...stocked.map((id) => ({ id, isStocked: true })),
    ].slice(0, 12);
    cells.forEach((cell, i) => {
      const col = i % 4;
      const y = gridTop + (row + Math.floor(i / 4)) * 178;
      const x = cellX(col);
      const icon = this.add.sprite(x, y, `ing-${cell.id}`).setDisplaySize(96, 96).setDepth(12).setInteractive();
      objs.push(icon);
      objs.push(this.add.sprite(x - 22, y + 68, 'ui-coin').setDisplaySize(28, 28).setDepth(12));
      objs.push(
        this.add
          .text(x - 2, y + 68, String(GROCERY_PRICE), { fontSize: '26px', fontStyle: 'bold', color: '#ffffff' })
          .setOrigin(0, 0.5)
          .setDepth(12),
      );
      if (cell.isStocked) {
        // Small count badge, top-right of the icon.
        objs.push(this.add.circle(x + 42, y - 40, 20, 0x2ecc71).setDepth(13));
        objs.push(
          this.add
            .text(x + 42, y - 40, String(this.pantry.stockOf(cell.id)), { fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
            .setOrigin(0.5)
            .setDepth(14),
        );
      }
      icon.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (this.pantry.buyItem(cell.id, this.wallet)) {
            this.journal.log('grocery_buy', { id: cell.id });
            this.blips.ding();
            this.refreshBar();
            this.buildGrocery();
          } else {
            // Broke: gentle wiggle, no sound (matches picker/wardrobe refusal feel).
            this.tweens.add({ targets: icon, x: icon.x + 9, duration: 45, yoyo: true, repeat: 3 });
          }
        },
      );
    });
    // Buy-the-whole-list button: gold-ringed basket at the panel foot (only when
    // something is left to buy). Buys as many list items as coins allow.
    if (need.length > 0) {
      const allBg = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 310, 46, 0x2c2c54, 0.95).setDepth(12).setInteractive();
      const allRing = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 310, 46).setStrokeStyle(4, 0xf5c542).setDepth(13);
      const allIcon = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 310, 'ui-basket').setDisplaySize(52, 52).setDepth(13);
      objs.push(allBg, allRing, allIcon);
      allBg.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          let bought = 0;
          for (const id of need) {
            if (!this.pantry.buyItem(id, this.wallet)) break;
            this.journal.log('grocery_buy', { id });
            bought += 1;
          }
          if (bought > 0) {
            this.blips.ding();
            this.refreshBar();
            this.buildGrocery();
          } else {
            this.tweens.add({ targets: [allIcon, allRing], x: '+=9', duration: 45, yoyo: true, repeat: 3 });
          }
        },
      );
    }
  }

  private closeGrocery(): void {
    for (const o of this.groceryObjects) o.destroy();
    this.groceryObjects = [];
  }

  // --- Film-a-video milestone ---

  /** Fires once per room, only when the ACTIVE chapter's room is fully furnished. */
  private maybeFilmVideo(): void {
    const chapter = this.activeChapter();
    if (!this.furnishing.isRoomComplete(chapter)) return;
    if (this.furnishing.hasFilmedVideo(chapter)) return;
    if (this.videoObjects.length > 0) return;
    this.startVideoFlow();
  }

  /** Outfit choice -> pose choice -> tap-beat -> payout. Zero text; all depth 30+. */
  private startVideoFlow(): void {
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setDepth(30)
      .setInteractive();
    const cam = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.18, 'ui-video').setDisplaySize(110, 110).setDepth(31);
    this.videoObjects.push(dim, cam);
    // Base outfits, plus the equipped wardrobe outfit as a 4th option when present.
    const prefixes = ['avatar-o0', 'avatar-o1', 'avatar-o2'];
    const equipped = this.wardrobe.state().equipped;
    const equippedColor = this.wardrobe.equippedColor();
    if (equipped !== null && equippedColor !== null) {
      prefixes.push(this.wardrobeAvatarPrefix(equipped, equippedColor, [0, 1, 2]));
    }
    this.videoChoice(prefixes.map((p) => `${p}-p0`), (pick) => {
      const prefix = prefixes[pick]!;
      this.videoChoice(
        [`${prefix}-p0`, `${prefix}-p1`, `${prefix}-p2`],
        (pose) => {
          cam.destroy();
          this.startTapBeat(prefix, pose as 0 | 1 | 2);
        },
      );
    });
  }

  /** Big tappable sprites side by side (3 or 4); picking destroys the row and advances. */
  private videoChoice(keys: string[], onPick: (i: number) => void): void {
    const objs: Phaser.GameObjects.Sprite[] = [];
    const n = keys.length;
    const spacing = n > 3 ? 165 : 210;
    const size = n > 3 ? 160 : 190;
    keys.forEach((k, i) => {
      const sp = this.add
        .sprite(GAME_WIDTH / 2 + (i - (n - 1) / 2) * spacing, GAME_HEIGHT * 0.5, k)
        .setDisplaySize(size, size)
        .setDepth(31)
        .setInteractive();
      objs.push(sp);
      this.videoObjects.push(sp);
      this.tweens.add({
        targets: sp,
        scaleX: sp.scaleX * 1.05,
        scaleY: sp.scaleY * 1.05,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 130,
      });
      sp.on(
        'pointerup',
        (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          for (const o of objs) o.destroy();
          onPick(i);
        },
      );
    });
  }

  /** 8 beats at 100bpm; taps within +-250ms of a beat ding gold. Skip = perf 1. Never fails. */
  private startTapBeat(avatarPrefix: string, pose: 0 | 1 | 2): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    // Filming under the ring light: slow-spinning studio ring behind the avatar.
    const ringlight = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT * 0.52, 'ui-ringlight')
      .setDisplaySize(360, 360)
      .setAlpha(0.6)
      .setDepth(30.5);
    this.tweens.add({ targets: ringlight, angle: 360, duration: 12000, repeat: -1 });
    const avatar = this.add
      .sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.52, `${avatarPrefix}-p${pose}`)
      .setDisplaySize(240, 240)
      .setDepth(31);
    const note = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT * 0.24, 'ui-note').setDisplaySize(90, 90).setDepth(31);
    const skip = this.add
      .sprite(GAME_WIDTH - 70, GAME_HEIGHT * 0.1, 'ui-play')
      .setDisplaySize(64, 64)
      .setTint(0x888899)
      .setDepth(31)
      .setInteractive();
    objs.push(avatar, note, skip, ringlight);
    this.videoObjects.push(avatar, note, skip, ringlight);

    const period = 600; // 100 bpm
    const beats = 8;
    const hitWindow = 250;
    const startAt = this.time.now + period;
    const beatTimes = Array.from({ length: beats }, (_, i) => startAt + i * period);
    const claimed = new Array<boolean>(beats).fill(false);
    let hits = 0;
    let done = false;

    const onTap = (p: Phaser.Input.Pointer): void => {
      if (done) return;
      if (skip.getBounds().contains(p.x, p.y)) return;
      const now = this.time.now;
      for (let i = 0; i < beats; i++) {
        if (claimed[i] !== true && Math.abs(now - (beatTimes[i] ?? 0)) <= hitWindow) {
          claimed[i] = true;
          hits += 1;
          this.blips.ding();
          const flash = this.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xf1c40f, 0.28)
            .setDepth(33);
          this.videoObjects.push(flash);
          this.tweens.add({ targets: flash, alpha: 0, duration: 200, onComplete: () => flash.destroy() });
          break;
        }
      }
    };
    this.input.on('pointerdown', onTap);

    const timer = this.time.addEvent({
      delay: period,
      repeat: beats - 1,
      callback: () => {
        this.blips.beat();
        this.tweens.add({ targets: note, scaleX: note.scaleX * 1.25, scaleY: note.scaleY * 1.25, duration: 130, yoyo: true });
        const ring = this.add.circle(note.x, note.y, 62).setStrokeStyle(6, 0xffffff).setDepth(32);
        this.videoObjects.push(ring);
        this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 550, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
      },
    });

    const finish = (perf: 0 | 1 | 2): void => {
      if (done) return;
      done = true;
      timer.remove();
      this.input.off('pointerdown', onTap);
      for (const o of objs) o.destroy();
      this.videoPayout(perf);
    };
    skip.on(
      'pointerup',
      (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        finish(1);
      },
    );
    this.time.delayedCall(period * beats + hitWindow + 100, () => {
      finish(hits >= 6 ? 2 : hits >= 3 ? 1 : 0);
    });
  }

  /** Camera flash, earn (scaled by the chapter payout multiplier), persist, pips fly, confetti, close. */
  private videoPayout(perf: 0 | 1 | 2): void {
    const chapter = this.activeChapter();
    const flash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1)
      .setDepth(35);
    this.videoObjects.push(flash);
    this.tweens.add({ targets: flash, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    this.wallet.earnVideo(perf, chapterById(chapter).payoutMultiplier);
    this.furnishing.markVideoFilmed(chapter);
    this.journal.log('video_filmed', { room: chapter, perf });
    // Follower and heart pips fly to their bar slots (bar item x = 90 + i * 180, icon at x - 44).
    const flights: { tint: number; x: number }[] = [
      { tint: 0x3498db, x: 90 + 1 * 180 - 44 },
      { tint: 0xe74c3c, x: 90 + 2 * 180 - 44 },
    ];
    flights.forEach((f, fi) => {
      for (let i = 0; i < 6; i++) {
        const pip = this.add
          .sprite(GAME_WIDTH / 2 + (i - 2.5) * 40, GAME_HEIGHT * 0.5, 'ui-pip')
          .setTint(f.tint)
          .setScale(1.8)
          .setDepth(34);
        this.videoObjects.push(pip);
        this.tweens.add({
          targets: pip,
          x: f.x,
          y: BAR_Y,
          scale: 0.5,
          duration: 550,
          delay: 200 + fi * 120 + i * 80,
          ease: 'Cubic.easeIn',
          onComplete: () => pip.destroy(),
        });
      }
    });
    this.time.delayedCall(1000, () => this.refreshBar());
    // Confetti celebration (same fire-and-forget pattern as chapter complete).
    const tints = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22];
    for (let i = 0; i < 24; i++) {
      const pip = this.add
        .sprite(Math.random() * GAME_WIDTH, -40 - Math.random() * 160, 'ui-pip')
        .setTint(tints[i % tints.length]!)
        .setScale(1.4 + Math.random())
        .setDepth(33);
      this.videoObjects.push(pip);
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
    this.time.delayedCall(2600, () => this.endVideoFlow());
  }

  private endVideoFlow(): void {
    for (const o of this.videoObjects) o.destroy();
    this.videoObjects = [];
    this.refreshBar();
  }
  // --- Manager assignments (decision #50) ---

  /** Pulsing clipboard under the home/hanger column, only while assignments are pending. */
  private buildClipboardButton(): void {
    if (!PROFILE.features.managerTasks) return;
    if (this.tasks.pending().length === 0) return;
    const clip = this.add
      .sprite(64, ROOM_TOP + 356, 'ui-clipboard')
      .setDisplaySize(64, 64)
      .setDepth(2)
      .setInteractive();
    this.tweens.add({
      targets: clip,
      scaleX: clip.scaleX * 1.12,
      scaleY: clip.scaleY * 1.12,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    clip.on('pointerup', () => this.openAssignments());
  }

  /** Player-facing assignment view: zero text — clipboard title + big bright pending icons; dim tap closes. */
  private openAssignments(): void {
    if (this.overlayOpen()) return;
    this.journal.log('assignments_viewed', {});
    const objs = this.assignObjects;
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(40)
      .setInteractive();
    dim.on('pointerup', () => this.closeAssignments());
    objs.push(dim);
    objs.push(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'ui-panel').setDisplaySize(620, 540).setDepth(41));
    objs.push(this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, 'ui-clipboard').setDisplaySize(130, 130).setDepth(42));
    const pending = this.tasks.pending().slice(0, 5);
    pending.forEach((task, i) => {
      const x = GAME_WIDTH / 2 + (i - (pending.length - 1) / 2) * 115;
      const sp = this.add
        .sprite(x, GAME_HEIGHT / 2 + 60, TASK_ICON_TEXTURE[task.icon])
        .setDisplaySize(92, 92)
        .setDepth(42);
      objs.push(sp);
      this.tweens.add({
        targets: sp,
        scaleX: sp.scaleX * 1.1,
        scaleY: sp.scaleY * 1.1,
        duration: 550,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 130,
      });
    });
  }

  private closeAssignments(): void {
    for (const o of this.assignObjects) o.destroy();
    this.assignObjects = [];
  }

  /**
   * Pays every done-but-unrewarded manager task. markRewarded runs before any
   * visuals, so the payout can never double-fire even if the scene restarts
   * mid-celebration. Judgment call: one combined celebration (single confetti
   * burst + one pip flight per task) instead of sequential ceremonies — repeat
   * scene entries stay snappy and the pattern matches videoPayout.
   */
  private rewardCompletedTasks(): void {
    if (!PROFILE.features.managerTasks) return;
    const due = this.tasks.unrewarded();
    if (due.length === 0) return;
    for (const task of due) {
      this.tasks.markRewarded(task.id);
      this.wallet.earnTask();
      this.journal.log('task_rewarded', { icon: task.icon });
    }
    this.blips.ding();
    // The rewarded icons pop in the room view, then fade.
    due.forEach((task, ti) => {
      const sp = this.add
        .sprite(GAME_WIDTH / 2 + (ti - (due.length - 1) / 2) * 130, (ROOM_TOP + ROOM_BOTTOM) / 2, TASK_ICON_TEXTURE[task.icon])
        .setDisplaySize(110, 110)
        .setDepth(34)
        .setAlpha(0);
      this.tweens.chain({
        targets: sp,
        tweens: [
          { alpha: 1, scale: sp.scale * 1.2, duration: 260, delay: ti * 140, ease: 'Back.easeOut' },
          { alpha: 0, y: sp.y - 60, duration: 450, delay: 700, ease: 'Quad.easeIn' },
        ],
        onComplete: () => sp.destroy(),
      });
    });
    // Heart pips fly to the hearts bar slot (bar item x = 90 + i * 180, icon at x - 44).
    const heartX = 90 + 2 * 180 - 44;
    for (let i = 0; i < 5 * due.length && i < 15; i++) {
      const pip = this.add
        .sprite(GAME_WIDTH / 2 + (i % 5 - 2) * 44, (ROOM_TOP + ROOM_BOTTOM) / 2 + 120, 'ui-pip')
        .setTint(0xe74c3c)
        .setScale(1.8)
        .setDepth(34);
      this.tweens.add({
        targets: pip,
        x: heartX,
        y: BAR_Y,
        scale: 0.5,
        duration: 550,
        delay: 300 + i * 90,
        ease: 'Cubic.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
    // Confetti, fire-and-forget like videoPayout's.
    const tints = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22];
    const count = Math.min(18 + 6 * due.length, 36);
    for (let i = 0; i < count; i++) {
      const pip = this.add
        .sprite(Math.random() * GAME_WIDTH, -40 - Math.random() * 160, 'ui-pip')
        .setTint(tints[i % tints.length]!)
        .setScale(1.4 + Math.random())
        .setDepth(33);
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
    this.time.delayedCall(1100, () => this.refreshBar());
  }
}
