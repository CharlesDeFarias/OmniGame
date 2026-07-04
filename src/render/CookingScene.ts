import Phaser from 'phaser';
import { applyInput, currentStep, expectedNext, starsForMistakes, startRecipe } from '../core/cooking/engine';
import { ALL_INGREDIENTS, RECIPES } from '../core/cooking/recipes';
import { applyServe, startServing, type ServeEvent, type ServingState } from '../core/cooking/serving';
import type { CookEvent, CookInput, CookingState, IngredientId, Recipe, Step } from '../core/cooking/types';
import { createCooking, type CookingProgress } from '../services/cooking';
import { createJournal, type Journal } from '../services/journal';
import { createPantry, type Pantry } from '../services/pantry';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { makeTextures } from './theme';
import { TS } from './textStyles';

/** FNV-1a over the id string: pantry layouts and distractor picks are deterministic per recipe. */
const hashStr = (v: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/** mulberry32 — tiny deterministic PRNG (no Math.random anywhere in cooking). */
const mulberry = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffled = <T,>(arr: readonly T[], seedStr: string): T[] => {
  const rnd = mulberry(hashStr(seedStr));
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
};

/** 4-6 wrong-but-plausible pantry items, fixed per recipe id. */
const distractorsFor = (recipe: Recipe, required: readonly IngredientId[]): IngredientId[] => {
  const pool = ALL_INGREDIENTS.filter((id) => !required.includes(id));
  const count = 4 + (hashStr(recipe.id) % 3);
  return shuffled(pool, `${recipe.id}:distractors`).slice(0, count);
};

const uniq = <T,>(arr: readonly T[]): T[] => [...new Set(arr)];

const inputKey = (input: CookInput): string => `${input.kind}:${input.id}`;

const WRONG_LOG_CAP = 3;

/**
 * Relaxed cooking game (plan 8, decisions #44/#48): recipe list + assembly play.
 * Near-zero text: icons carry all meaning; the only glyphs on screen are numbers.
 */
export class CookingScene extends Phaser.Scene {
  private journal!: Journal;
  private wallet!: Wallet;
  private cooking!: CookingProgress;
  private pantry!: Pantry;
  private blips!: Blips;
  private viewObjects: Phaser.GameObjects.GameObject[] = [];
  private state: CookingState | null = null;
  private recipeIndex = 0;
  private wrongLogs = 0;
  private justUnlocked: number | null = null;
  private transitioning = false;
  private hand: Phaser.GameObjects.Sprite | null = null;
  private idleTimer: Phaser.Time.TimerEvent | null = null;
  private targets = new Map<string, Phaser.GameObjects.Sprite>();
  private bowl: Phaser.GameObjects.Sprite | null = null;
  private plate: Phaser.GameObjects.Sprite | null = null;
  private stackCount = 0;
  private protectedRun = false;
  private serving: ServingState | null = null;
  private custHeads: Phaser.GameObjects.Sprite[] = [];
  private servingWrongLogs = 0;

  constructor() {
    super('cooking');
  }

  create(): void {
    makeTextures(this, 96);
    this.viewObjects = [];
    this.state = null;
    this.serving = null;
    this.justUnlocked = null;
    // Stage bands, same studio feel as PlayScene.
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.125, GAME_WIDTH, GAME_HEIGHT * 0.25, PALETTE.bgPlum, 0.8)
      .setDepth(-2);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.875, GAME_WIDTH, GAME_HEIGHT * 0.25, PALETTE.bgDeep, 0.9)
      .setDepth(-2);
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.cooking = createCooking(window.localStorage);
    this.pantry = createPantry(window.localStorage);
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Hand + timers must not leak into the next scene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clearView());
    this.journal.log('cooking_open', {});
    this.showList();
  }

  private clearView(): void {
    this.killHand();
    if (this.idleTimer !== null) {
      this.idleTimer.remove();
      this.idleTimer = null;
    }
    for (const o of this.viewObjects) o.destroy();
    this.viewObjects = [];
    this.targets.clear();
    this.custHeads = [];
    this.bowl = null;
    this.plate = null;
    this.transitioning = false;
  }

  private killHand(): void {
    if (this.hand !== null) {
      this.tweens.killTweensOf(this.hand);
      this.hand.destroy();
      this.hand = null;
    }
  }

  /** Simplified single-target pointing hand: bobs over (x, y) until killed. */
  private hoverHand(x: number, y: number): void {
    this.killHand();
    const hand = this.add.sprite(x + 22, y + 34, 'ui-hand').setDepth(9).setAlpha(0);
    this.hand = hand;
    this.viewObjects.push(hand);
    this.tweens.add({ targets: hand, alpha: 0.95, duration: 250 });
    this.tweens.add({ targets: hand, y: y + 18, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Hand over the engine's first expected input (tutorial + idle hint share this). */
  private hoverExpected(): void {
    if (this.state === null || this.transitioning) return;
    const exp = expectedNext(this.state)[0];
    if (exp === undefined) return;
    const target = this.targets.get(inputKey(exp));
    if (target !== undefined) this.hoverHand(target.x, target.y);
  }

  private armIdleHint(): void {
    if (this.idleTimer !== null) this.idleTimer.remove();
    this.idleTimer = this.time.delayedCall(6000, () => {
      this.idleTimer = null;
      this.hoverExpected();
    });
  }

  // --- LIST view ---

  private showList(): void {
    this.clearView();
    this.state = null;
    // Gold-framed header: pan logo center, coin display right, home left.
    this.viewObjects.push(
      this.add.image(GAME_WIDTH / 2, 96, 'ui-panel').setDisplaySize(664, 128).setAlpha(0.45).setDepth(0),
      this.add.sprite(GAME_WIDTH / 2, 96, 'ui-pan-card').setDisplaySize(92, 92).setDepth(1),
      this.add.sprite(530, 96, 'ui-coin').setDisplaySize(44, 44).setDepth(1),
      this.add
        .text(560, 96, String(this.wallet.data().coins), TS.number(32))
        .setOrigin(0, 0.5)
        .setDepth(1),
    );
    const home = this.add.sprite(78, 96, 'ui-home').setDisplaySize(68, 68).setDepth(1).setInteractive();
    this.viewObjects.push(home);
    home.on('pointerup', () => {
      // Hub registers in the boot rework; fall back to career until then.
      this.scene.start('hub');
    });
    // 3x6 grid: 15 recipe cards + the serving card in the last cell (the old 2x5
    // grid can't hold 16 cells on screen — smaller cards, same reading order).
    const cellPos = (i: number): { x: number; y: number } => ({
      x: 130 + (i % 3) * 230,
      y: 250 + Math.floor(i / 3) * 162,
    });
    RECIPES.forEach((recipe, i) => {
      const { x, y } = cellPos(i);
      const unlocked = this.cooking.isUnlocked(i);
      const card = this.add
        .image(x, y, 'ui-panel')
        .setDisplaySize(218, 148)
        .setAlpha(unlocked ? 0.95 : 0.4)
        .setDepth(0);
      const dish = this.add.sprite(x - 56, y, `ing-${recipe.icon}`).setDisplaySize(70, 70).setDepth(1);
      this.viewObjects.push(card, dish);
      if (!unlocked) {
        dish.setTint(0x555566).setAlpha(0.55);
        this.viewObjects.push(this.add.sprite(x + 44, y, 'ui-lock').setDisplaySize(48, 48).setDepth(2));
        return;
      }
      const best = this.cooking.bestFor(recipe.id);
      for (let st = 0; st < 3; st++) {
        const starSp = this.add.sprite(x + 10 + st * 34, y, 'ui-star').setDisplaySize(28, 28).setDepth(1);
        if (st >= best) starSp.setTint(0x555566).setAlpha(0.6);
        this.viewObjects.push(starSp);
      }
      card.setInteractive();
      card.on('pointerup', () => {
        if (this.transitioning) return;
        this.startPlay(i);
      });
      // Freshly unlocked card sparkles once (deterministic radial burst).
      if (this.justUnlocked === i) {
        for (let p = 0; p < 10; p++) {
          const ang = (p * Math.PI * 2) / 10;
          const pip = this.add.sprite(x, y, 'ui-pip').setTint(PALETTE.gold).setScale(1.3).setDepth(3);
          this.viewObjects.push(pip);
          this.tweens.add({
            targets: pip,
            x: x + Math.cos(ang) * 95,
            y: y + Math.sin(ang) * 65,
            alpha: 0,
            scale: 0.3,
            duration: 620,
            delay: 150 + p * 30,
            ease: 'Quad.easeOut',
            onComplete: () => pip.destroy(),
          });
        }
        this.tweens.add({ targets: card, scaleX: card.scaleX * 1.05, scaleY: card.scaleY * 1.05, duration: 260, yoyo: true, repeat: 2 });
      }
    });
    this.buildServingCard(cellPos(RECIPES.length));
    this.justUnlocked = null;
  }

  /** Serving-mode card (decision #53): plate + 3 order pips; locked shows a lock and a '5' badge. */
  private buildServingCard(pos: { x: number; y: number }): void {
    const { x, y } = pos;
    const unlocked = this.cooking.servingUnlocked();
    const card = this.add
      .image(x, y, 'ui-panel')
      .setDisplaySize(218, 148)
      .setAlpha(unlocked ? 0.95 : 0.4)
      .setDepth(0);
    const plate = this.add.sprite(x - 56, y, 'ui-plate').setDisplaySize(74, 74).setDepth(1);
    this.viewObjects.push(card, plate);
    for (let i = 0; i < 3; i++) {
      const pip = this.add.sprite(x + 14 + i * 30, y, 'ui-pip').setScale(1.5).setDepth(1);
      if (!unlocked) pip.setAlpha(0.4);
      this.viewObjects.push(pip);
    }
    if (!unlocked) {
      plate.setTint(0x555566).setAlpha(0.55);
      // Lock + '5' badge: five completed recipes open the diner (number-only text).
      this.viewObjects.push(
        this.add.sprite(x + 44, y - 30, 'ui-lock').setDisplaySize(44, 44).setDepth(2),
        this.add.sprite(x + 44, y + 26, 'ui-levelbadge').setDisplaySize(38, 38).setDepth(2),
        this.add
          .text(x + 44, y + 28, '5', TS.number(24))
          .setOrigin(0.5)
          .setDepth(3),
      );
      return;
    }
    card.setInteractive();
    card.on('pointerup', () => {
      if (this.transitioning) return;
      this.startServingView();
    });
  }

  // --- SERVING view (decision #53) ---

  private startServingView(): void {
    // Orders come from recipes she has actually completed (best >= 1): every dish a
    // customer asks for is one she already knows (judgment call — gentler than the
    // raw unlocked list, and servingUnlocked() guarantees at least 5 of them).
    const ids = RECIPES.filter((r) => this.cooking.bestFor(r.id) > 0).map((r) => r.id);
    // Wall-clock seed for round-to-round variety; the round itself is pure and
    // deterministic per seed via the core's seeded RNG (no Math.random anywhere).
    const seed = Date.now() & 0x7fffffff;
    this.serving = startServing(ids, seed);
    this.servingWrongLogs = 0;
    if (this.serving.done) {
      // Defensive: empty completed list should be unreachable behind the unlock gate.
      this.serving = null;
      this.showList();
      return;
    }
    this.journal.log('serving_start', { orders: this.serving.orders, seed });
    this.buildServing();
  }

  /** Full rebuild at the start of each order: customer row + this order's pantry + bowl. */
  private buildServing(): void {
    this.clearView();
    this.state = null;
    const sv = this.serving;
    if (sv === null) return;
    const home = this.add.sprite(60, 62, 'ui-home').setDisplaySize(56, 56).setAlpha(0.85).setDepth(1).setInteractive();
    this.viewObjects.push(home);
    home.on('pointerup', () => {
      if (this.transitioning) return;
      this.serving = null;
      this.showList();
    });
    // Customer row: three heads, each with a speech bubble showing the ordered dish.
    // Done orders dim with a check; the current one wears a gold ring and bobs.
    this.custHeads = [];
    sv.orders.forEach((orderId, i) => {
      const recipe = RECIPES.find((r) => r.id === orderId);
      if (recipe === undefined) return;
      const x = 150 + i * 210;
      const head = this.add.sprite(x, 215, `cust-${i}`).setDisplaySize(110, 110).setDepth(1);
      const bubble = this.add.sprite(x + 62, 118, 'ui-bubble').setDisplaySize(104, 104).setDepth(1);
      const dishIcon = this.add.sprite(x + 62, 108, `ing-${recipe.icon}`).setDisplaySize(52, 52).setDepth(2);
      this.custHeads.push(head);
      this.viewObjects.push(head, bubble, dishIcon);
      if (i < sv.orderIndex) {
        bubble.setAlpha(0.35);
        dishIcon.setAlpha(0.45);
        this.viewObjects.push(this.add.sprite(x + 40, 250, 'ui-check').setDisplaySize(40, 40).setDepth(2));
      } else if (i === sv.orderIndex) {
        const ring = this.add.circle(x, 215, 62).setStrokeStyle(5, PALETTE.gold).setDepth(2);
        this.viewObjects.push(ring);
        this.tweens.add({ targets: head, y: 207, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        head.setAlpha(0.55);
        bubble.setAlpha(0.55);
        dishIcon.setAlpha(0.6);
      }
    });
    const orderId = sv.orders[sv.orderIndex]!;
    const recipe = RECIPES.find((r) => r.id === orderId)!;
    // Bowl the order fills into, like the gather view.
    const bowl = this.add.sprite(GAME_WIDTH / 2, 1090, 'ui-bowl').setDisplaySize(230, 230).setDepth(2);
    this.bowl = bowl;
    this.viewObjects.push(bowl);
    // Pantry: the order's full gather set + the recipe's usual distractors, shuffled
    // deterministically per order slot (seed string, not Math.random).
    const required = [...sv.needed];
    const items = shuffled(
      [...required, ...distractorsFor(recipe, required)],
      `serving:${recipe.id}:${sv.orderIndex}:pantry`,
    );
    items.forEach((id, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 165 + col * 195;
      const y = 380 + row * 152;
      const tile = this.add.image(x, y, 'ui-tile').setDisplaySize(138, 138).setAlpha(0.1).setDepth(0);
      const icon = this.add.sprite(x, y, `ing-${id}`).setDisplaySize(102, 102).setDepth(1).setInteractive();
      this.viewObjects.push(tile, icon);
      icon.on('pointerup', () => this.handleServe(id, icon, bowl));
    });
  }

  /** Serve taps funnel here: core decides, renderer reacts (mirrors handleInput). */
  private handleServe(id: IngredientId, icon: Phaser.GameObjects.Sprite, bowl: Phaser.GameObjects.Sprite): void {
    if (this.serving === null || this.transitioning) return;
    const res = applyServe(this.serving, id);
    this.serving = res.state;
    if (!res.correct) {
      // Same gentle refusal as cooking: wiggle only, no sad sound.
      this.tweens.add({ targets: icon, x: icon.x + 9, duration: 45, yoyo: true, repeat: 3 });
      if (this.servingWrongLogs < WRONG_LOG_CAP) {
        this.servingWrongLogs += 1;
        this.journal.log('serving_wrong', { order: this.serving.orderIndex });
      }
      return;
    }
    this.blips.match();
    icon.disableInteractive().setAlpha(0.3);
    const fly = this.add.sprite(icon.x, icon.y, `ing-${id}`).setDisplaySize(88, 88).setDepth(5);
    this.viewObjects.push(fly);
    this.tweens.add({
      targets: fly,
      x: bowl.x,
      y: bowl.y - 24,
      scale: fly.scale * 0.5,
      duration: 430,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        fly.destroy();
        this.tweens.add({ targets: bowl, scaleX: bowl.scaleX * 1.07, scaleY: bowl.scaleY * 1.07, duration: 110, yoyo: true });
      },
    });
    const doneEvent = res.events.find((e): e is Extract<ServeEvent, { type: 'servingDone' }> => e.type === 'servingDone');
    const orderDone = res.events.some((e) => e.type === 'orderDone');
    if (orderDone) {
      this.transitioning = true;
      // Customer beams: happy hop + a check pop over their head.
      const head = this.custHeads[Math.max(0, this.serving.orderIndex - 1)];
      if (head !== undefined) {
        this.tweens.killTweensOf(head);
        this.tweens.add({ targets: head, y: head.y - 26, duration: 180, yoyo: true, repeat: 2, ease: 'Quad.easeOut' });
        const check = this.add.sprite(head.x + 40, head.y + 35, 'ui-check').setDisplaySize(44, 44).setScale(0).setDepth(3);
        this.viewObjects.push(check);
        this.tweens.add({ targets: check, scale: 44 / 96, duration: 240, ease: 'Back.easeOut' });
      }
      this.blips.ding();
      this.sparkle(bowl.x, bowl.y);
      if (doneEvent !== undefined) {
        this.time.delayedCall(950, () => this.showServingResult(doneEvent.stars, doneEvent.mistakes));
      } else {
        this.time.delayedCall(950, () => this.buildServing());
      }
    }
  }

  /** Round finished: pay out (earnCooking reused), journal, stars + coins ceremony. */
  private showServingResult(stars: 1 | 2 | 3, mistakes: number): void {
    this.clearView();
    this.serving = null;
    // Payout + journal first, celebration after (interruptions can't lose the round).
    this.wallet.earnCooking(stars);
    this.journal.log('serving_done', { stars, mistakes });
    this.blips.win();
    // The three customers, all beaming over a shared plate.
    for (let i = 0; i < 3; i++) {
      const head = this.add.sprite(GAME_WIDTH / 2 + (i - 1) * 170, 470, `cust-${i}`).setDisplaySize(120, 120).setDepth(2);
      this.viewObjects.push(head);
      this.tweens.add({ targets: head, y: 455, duration: 420, yoyo: true, repeat: -1, delay: i * 130, ease: 'Sine.easeInOut' });
    }
    this.viewObjects.push(this.add.sprite(GAME_WIDTH / 2, 640, 'ui-plate').setDisplaySize(320, 320).setDepth(1));
    for (let i = 0; i < 3; i++) {
      const slot = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 150, 250, 'ui-star')
        .setDisplaySize(104, 104)
        .setTint(0x555566)
        .setDepth(2);
      this.viewObjects.push(slot);
    }
    for (let i = 0; i < stars; i++) {
      const st = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 150, 250, 'ui-star')
        .setDisplaySize(104, 104)
        .setScale(0)
        .setDepth(3);
      this.viewObjects.push(st);
      this.tweens.add({ targets: st, scale: 104 / 96, duration: 260, delay: 350 + i * 240, ease: 'Back.easeOut' });
    }
    const coinIcon = this.add.sprite(GAME_WIDTH / 2 - 40, 850, 'ui-coin').setDisplaySize(48, 48).setDepth(2);
    const coinText = this.add
      .text(GAME_WIDTH / 2 - 8, 850, String(this.wallet.data().coins), TS.number(36))
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.viewObjects.push(coinIcon, coinText);
    for (let i = 0; i < 6; i++) {
      const pip = this.add
        .sprite(GAME_WIDTH / 2 + (i - 2.5) * 40, 640, 'ui-pip')
        .setTint(0xf1c40f)
        .setScale(1.6)
        .setDepth(5);
      this.viewObjects.push(pip);
      this.tweens.add({
        targets: pip,
        x: coinIcon.x,
        y: coinIcon.y,
        scale: 0.5,
        duration: 520,
        delay: 400 + i * 80,
        ease: 'Cubic.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
    // Serve again + back to the list.
    const retry = this.add.sprite(GAME_WIDTH / 2 - 120, 1070, 'ui-retry').setDisplaySize(120, 120).setDepth(2).setInteractive();
    const list = this.add.sprite(GAME_WIDTH / 2 + 120, 1070, 'ui-home').setDisplaySize(120, 120).setDepth(2).setInteractive();
    this.viewObjects.push(retry, list);
    retry.once('pointerup', () => this.startServingView());
    list.once('pointerup', () => this.showList());
  }

  // --- PLAY view ---

  private startPlay(index: number): void {
    this.recipeIndex = index;
    this.wrongLogs = 0;
    const recipe = RECIPES[index]!;
    // Star protection (decision #52): a fully stocked pantry is consumed the moment
    // cooking starts (all-or-nothing inside consumeFor) and buys one free mistake.
    this.protectedRun = this.pantry.consumeFor(recipe);
    this.state = startRecipe(recipe);
    this.journal.log('recipe_start', { id: recipe.id, protected: this.protectedRun });
    this.buildStep();
  }

  private buildStep(): void {
    this.clearView();
    if (this.state === null) return;
    const step = currentStep(this.state);
    if (step === null) return;
    const recipe = this.state.recipe;
    // Header: recipe icon + step-progress pips; small home escapes back to the list.
    this.viewObjects.push(
      this.add.image(GAME_WIDTH / 2, 110, 'ui-panel').setDisplaySize(240, 130).setAlpha(0.45).setDepth(0),
      this.add.sprite(GAME_WIDTH / 2, 110, `ing-${recipe.icon}`).setDisplaySize(88, 88).setDepth(1),
    );
    const n = recipe.steps.length;
    for (let i = 0; i < n; i++) {
      const pip = this.add
        .sprite(GAME_WIDTH / 2 + (i - (n - 1) / 2) * 44, 208, 'ui-pip')
        .setScale(1.6)
        .setDepth(1);
      if (i < this.state.stepIndex) pip.setTint(PALETTE.gold);
      else if (i === this.state.stepIndex) {
        this.tweens.add({ targets: pip, scale: 2.1, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else pip.setTint(0x555566).setAlpha(0.7);
      this.viewObjects.push(pip);
    }
    const home = this.add.sprite(60, 62, 'ui-home').setDisplaySize(56, 56).setAlpha(0.85).setDepth(1).setInteractive();
    this.viewObjects.push(home);
    home.on('pointerup', () => {
      if (this.transitioning) return;
      this.showList();
    });
    if (this.protectedRun) {
      // Shield-ish indicator: cream-filled heart pinned to the header panel's corner.
      // Rendered ONLY when the pantry actually consumed stock for this run; reuses
      // ui-heart with a flat cream fill so no new texture is needed (judgment call).
      this.viewObjects.push(
        this.add.sprite(GAME_WIDTH / 2 + 96, 60, 'ui-heart').setDisplaySize(44, 44).setTintFill(PALETTE.cream).setDepth(2),
      );
    }
    if (step.type === 'gather') this.buildGather(step);
    else if (step.type === 'sequence') this.buildSequence(step);
    else this.buildAssemble(step);
    // Tutorial (first recipe only): hand points at the expected target right away.
    if (this.recipeIndex === 0) this.hoverExpected();
    else if (step.type === 'sequence') this.armIdleHint();
  }

  /** Pantry grid of required + distractor ingredients; correct taps fly into the bowl. */
  private buildGather(step: Extract<Step, { type: 'gather' }>): void {
    const recipe = this.state!.recipe;
    const bowl = this.add.sprite(GAME_WIDTH / 2, 1060, 'ui-bowl').setDisplaySize(250, 250).setDepth(2);
    this.bowl = bowl;
    this.viewObjects.push(bowl);
    const items = shuffled([...step.ingredients, ...distractorsFor(recipe, step.ingredients)], `${recipe.id}:pantry`);
    items.forEach((id, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 165 + col * 195;
      const y = 350 + row * 172;
      const tile = this.add.image(x, y, 'ui-tile').setDisplaySize(158, 158).setAlpha(0.1).setDepth(0);
      const icon = this.add.sprite(x, y, `ing-${id}`).setDisplaySize(116, 116).setDepth(1).setInteractive();
      this.viewObjects.push(tile, icon);
      if (!this.targets.has(`ingredient:${id}`)) this.targets.set(`ingredient:${id}`, icon);
      icon.on('pointerup', () => {
        this.handleInput({ kind: 'ingredient', id }, icon, () => {
          this.blips.match();
          icon.disableInteractive().setAlpha(0.3);
          const fly = this.add.sprite(icon.x, icon.y, `ing-${id}`).setDisplaySize(96, 96).setDepth(5);
          this.viewObjects.push(fly);
          this.tweens.add({
            targets: fly,
            x: bowl.x,
            y: bowl.y - 26,
            scale: fly.scale * 0.5,
            duration: 430,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              fly.destroy();
              this.tweens.add({ targets: bowl, scaleX: bowl.scaleX * 1.07, scaleY: bowl.scaleY * 1.07, duration: 110, yoyo: true });
            },
          });
        });
      });
    });
  }

  /** Only this step's actions, shuffled; tapped in recipe order. */
  private buildSequence(step: Extract<Step, { type: 'sequence' }>): void {
    const recipe = this.state!.recipe;
    const bowl = this.add.sprite(GAME_WIDTH / 2, 570, 'ui-bowl').setDisplaySize(300, 300).setDepth(2);
    this.bowl = bowl;
    this.viewObjects.push(bowl);
    const actions = shuffled(uniq(step.actions), `${recipe.id}:seq:${this.state!.stepIndex}`);
    const spacing = actions.length > 3 ? 165 : 185;
    actions.forEach((id, i) => {
      const x = GAME_WIDTH / 2 + (i - (actions.length - 1) / 2) * spacing;
      const badge = this.add.sprite(x, 960, `act-${id}`).setDisplaySize(150, 150).setDepth(1).setInteractive();
      this.viewObjects.push(badge);
      this.targets.set(`action:${id}`, badge);
      badge.on('pointerup', () => {
        this.handleInput({ kind: 'action', id }, badge, () => {
          this.blips.ding();
          this.tweens.add({ targets: badge, scaleX: badge.scaleX * 1.25, scaleY: badge.scaleY * 1.25, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
          this.tweens.add({ targets: bowl, y: bowl.y - 22, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
          // Dim the badge once this action has no further use in the step.
          const st = this.state;
          if (st !== null && !st.done) {
            const cur = currentStep(st);
            if (cur === null || cur.type !== 'sequence' || !cur.actions.slice(st.seqDone).includes(id)) {
              badge.setAlpha(0.35);
            }
          }
        });
      });
    });
  }

  /** Layer icons tapped in order stack onto the plate with a slight y-offset. */
  private buildAssemble(step: Extract<Step, { type: 'assemble' }>): void {
    const recipe = this.state!.recipe;
    const plate = this.add.sprite(GAME_WIDTH / 2, 620, 'ui-plate').setDisplaySize(430, 430).setDepth(1);
    this.plate = plate;
    this.viewObjects.push(plate);
    this.stackCount = 0;
    const remaining = new Map<IngredientId, number>();
    for (const id of step.layers) remaining.set(id, (remaining.get(id) ?? 0) + 1);
    const row = shuffled(uniq(step.layers), `${recipe.id}:asm:${this.state!.stepIndex}`);
    const spacing = row.length > 4 ? 118 : 145;
    row.forEach((id, i) => {
      const x = GAME_WIDTH / 2 + (i - (row.length - 1) / 2) * spacing;
      const icon = this.add.sprite(x, 1010, `ing-${id}`).setDisplaySize(108, 108).setDepth(1).setInteractive();
      this.viewObjects.push(icon);
      this.targets.set(`ingredient:${id}`, icon);
      icon.on('pointerup', () => {
        this.handleInput({ kind: 'ingredient', id }, icon, () => {
          this.blips.match();
          const layer = this.add
            .sprite(icon.x, icon.y, `ing-${id}`)
            .setDisplaySize(120, 120)
            .setDepth(2 + this.stackCount * 0.01);
          this.viewObjects.push(layer);
          this.tweens.add({
            targets: layer,
            x: plate.x,
            y: plate.y - 14 - this.stackCount * 16,
            duration: 380,
            ease: 'Back.easeOut',
          });
          this.stackCount += 1;
          const left = (remaining.get(id) ?? 1) - 1;
          remaining.set(id, left);
          if (left <= 0) icon.setAlpha(0.35);
        });
      });
    });
  }

  /**
   * All taps funnel here: engine decides, renderer reacts. Wrong taps get a wiggle
   * only — no sound (judgment call: lose() reads as sad, match tones read as success;
   * relaxed design wants gentle, not punishing).
   */
  private handleInput(input: CookInput, sprite: Phaser.GameObjects.Sprite, onCorrect: () => void): void {
    if (this.state === null || this.transitioning) return;
    if (this.idleTimer !== null) {
      this.idleTimer.remove();
      this.idleTimer = null;
    }
    const res = applyInput(this.state, input);
    this.state = res.state;
    if (!res.correct) {
      this.tweens.add({ targets: sprite, x: sprite.x + 9, duration: 45, yoyo: true, repeat: 3 });
      if (this.wrongLogs < WRONG_LOG_CAP) {
        this.wrongLogs += 1;
        this.journal.log('cooking_wrong', { id: this.state.recipe.id, step: this.state.stepIndex });
      }
      // Tutorial hand stays up on a wrong tap; idle hint re-arms.
      if (this.recipeIndex !== 0) this.armIdleHint();
      return;
    }
    this.killHand();
    onCorrect();
    const doneEvent = res.events.find((e): e is Extract<CookEvent, { type: 'recipeDone' }> => e.type === 'recipeDone');
    if (doneEvent !== undefined) {
      this.transitioning = true;
      // Protected runs forgive one mistake in the star math (raw mistake count still
      // shown/journaled); recordCompletion itself is unchanged.
      const stars = this.protectedRun
        ? starsForMistakes(Math.max(0, doneEvent.mistakes - 1))
        : doneEvent.stars;
      this.time.delayedCall(750, () => this.showPlating(stars, doneEvent.mistakes));
      return;
    }
    if (res.events.some((e) => e.type === 'stepDone')) {
      this.transitioning = true;
      this.sparkle(GAME_WIDTH / 2, this.bowl?.y ?? this.plate?.y ?? GAME_HEIGHT / 2);
      this.time.delayedCall(700, () => this.buildStep());
      return;
    }
    if (this.recipeIndex === 0) this.hoverExpected();
    else if (currentStep(this.state)?.type === 'sequence') this.armIdleHint();
  }

  /** Brief gold radial burst marking a finished step (deterministic angles). */
  private sparkle(x: number, y: number): void {
    for (let p = 0; p < 12; p++) {
      const ang = (p * Math.PI * 2) / 12;
      const pip = this.add.sprite(x, y, 'ui-pip').setTint(PALETTE.gold).setScale(1.4).setDepth(6);
      this.viewObjects.push(pip);
      this.tweens.add({
        targets: pip,
        x: x + Math.cos(ang) * 120,
        y: y + Math.sin(ang) * 120,
        alpha: 0,
        scale: 0.3,
        duration: 450,
        delay: p * 12,
        ease: 'Quad.easeOut',
        onComplete: () => pip.destroy(),
      });
    }
  }

  // --- Plating / finish ---

  private showPlating(stars: 1 | 2 | 3, mistakes: number): void {
    this.clearView();
    const recipe = RECIPES[this.recipeIndex]!;
    this.state = null;
    // Payout + persistence first: interruptions can't lose a finished recipe.
    const result = this.cooking.recordCompletion(recipe.id, this.recipeIndex, stars, this.wallet);
    if (result.unlockedNext) this.justUnlocked = this.recipeIndex + 1;
    this.journal.log('recipe_done', { id: recipe.id, stars, mistakes });
    this.blips.win();
    this.viewObjects.push(
      this.add.sprite(GAME_WIDTH / 2, 560, 'ui-plate').setDisplaySize(470, 470).setDepth(1),
      this.add.sprite(GAME_WIDTH / 2, 530, `ing-${recipe.icon}`).setDisplaySize(190, 190).setDepth(2),
    );
    // Camera flash.
    const flash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 1)
      .setDepth(12);
    this.viewObjects.push(flash);
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
    // Star pop: 3 slots, earned ones land gold with a pip burst.
    for (let i = 0; i < 3; i++) {
      const slot = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 150, 250, 'ui-star')
        .setDisplaySize(104, 104)
        .setTint(0x555566)
        .setDepth(2);
      this.viewObjects.push(slot);
    }
    for (let i = 0; i < stars; i++) {
      const st = this.add
        .sprite(GAME_WIDTH / 2 + (i - 1) * 150, 250, 'ui-star')
        .setDisplaySize(104, 104)
        .setScale(0)
        .setDepth(3);
      this.viewObjects.push(st);
      this.tweens.add({ targets: st, scale: 104 / 96, duration: 260, delay: 350 + i * 240, ease: 'Back.easeOut' });
    }
    // Coin display + pips flying to it (payout already in the wallet).
    const coinIcon = this.add.sprite(GAME_WIDTH / 2 - 40, 850, 'ui-coin').setDisplaySize(48, 48).setDepth(2);
    const coinText = this.add
      .text(GAME_WIDTH / 2 - 8, 850, String(this.wallet.data().coins), TS.number(36))
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.viewObjects.push(coinIcon, coinText);
    for (let i = 0; i < 6; i++) {
      const pip = this.add
        .sprite(GAME_WIDTH / 2 + (i - 2.5) * 40, 600, 'ui-pip')
        .setTint(0xf1c40f)
        .setScale(1.6)
        .setDepth(5);
      this.viewObjects.push(pip);
      this.tweens.add({
        targets: pip,
        x: coinIcon.x,
        y: coinIcon.y,
        scale: 0.5,
        duration: 520,
        delay: 400 + i * 80,
        ease: 'Cubic.easeIn',
        onComplete: () => pip.destroy(),
      });
    }
    // Replay + back-to-list.
    const retry = this.add.sprite(GAME_WIDTH / 2 - 120, 1070, 'ui-retry').setDisplaySize(120, 120).setDepth(2).setInteractive();
    const list = this.add.sprite(GAME_WIDTH / 2 + 120, 1070, 'ui-home').setDisplaySize(120, 120).setDepth(2).setInteractive();
    this.viewObjects.push(retry, list);
    retry.once('pointerup', () => this.startPlay(this.recipeIndex));
    list.once('pointerup', () => this.showList());
  }
}
