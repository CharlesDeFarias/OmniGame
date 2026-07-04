import Phaser from 'phaser';
import { applyInput, currentStep, expectedNext, startRecipe } from '../core/cooking/engine';
import { ALL_INGREDIENTS, RECIPES } from '../core/cooking/recipes';
import type { CookEvent, CookInput, CookingState, IngredientId, Recipe, Step } from '../core/cooking/types';
import { createCooking, type CookingProgress } from '../services/cooking';
import { createJournal, type Journal } from '../services/journal';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { makeTextures } from './theme';

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

  constructor() {
    super('cooking');
  }

  create(): void {
    makeTextures(this, 96);
    this.viewObjects = [];
    this.state = null;
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
        .text(560, 96, String(this.wallet.data().coins), {
          fontSize: '32px', fontStyle: 'bold', color: PALETTE.textOnDark, stroke: '#141428', strokeThickness: 6,
        })
        .setOrigin(0, 0.5)
        .setDepth(1),
    );
    const home = this.add.sprite(78, 96, 'ui-home').setDisplaySize(68, 68).setDepth(1).setInteractive();
    this.viewObjects.push(home);
    home.on('pointerup', () => {
      // Hub registers in the boot rework; fall back to career until then.
      this.scene.start('hub');
    });
    // 2x5 grid of recipe cards.
    RECIPES.forEach((recipe, i) => {
      const x = i % 2 === 0 ? 190 : 530;
      const y = 268 + Math.floor(i / 2) * 194;
      const unlocked = this.cooking.isUnlocked(i);
      const card = this.add
        .image(x, y, 'ui-panel')
        .setDisplaySize(316, 176)
        .setAlpha(unlocked ? 0.95 : 0.4)
        .setDepth(0);
      const dish = this.add.sprite(x - 80, y, `ing-${recipe.icon}`).setDisplaySize(96, 96).setDepth(1);
      this.viewObjects.push(card, dish);
      if (!unlocked) {
        dish.setTint(0x555566).setAlpha(0.55);
        this.viewObjects.push(this.add.sprite(x + 62, y, 'ui-lock').setDisplaySize(64, 64).setDepth(2));
        return;
      }
      const best = this.cooking.bestFor(recipe.id);
      for (let st = 0; st < 3; st++) {
        const starSp = this.add.sprite(x + 22 + st * 44, y, 'ui-star').setDisplaySize(38, 38).setDepth(1);
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
            x: x + Math.cos(ang) * 130,
            y: y + Math.sin(ang) * 90,
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
    this.justUnlocked = null;
  }

  // --- PLAY view ---

  private startPlay(index: number): void {
    this.recipeIndex = index;
    this.wrongLogs = 0;
    const recipe = RECIPES[index]!;
    this.state = startRecipe(recipe);
    this.journal.log('recipe_start', { id: recipe.id });
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
      this.time.delayedCall(750, () => this.showPlating(doneEvent.stars, doneEvent.mistakes));
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
      .text(GAME_WIDTH / 2 - 8, 850, String(this.wallet.data().coins), {
        fontSize: '36px', fontStyle: 'bold', color: PALETTE.textOnDark, stroke: '#141428', strokeThickness: 6,
      })
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
