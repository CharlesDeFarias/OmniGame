import Phaser from 'phaser';
import { PROFILE } from '../config/profile';
import { counterFor } from '../core/diner/dishes';
import { serveReady, startShift, tapIngredient, tickPatience } from '../core/diner/engine';
import type { DinerEvent, Ingredient, ShiftState } from '../core/diner/types';
import { createJournal, type Journal } from '../services/journal';
import { createPantry, type Pantry } from '../services/pantry';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, sfx, type Blips } from './audio';
import { buildBackground, fadeIn, goto, pressify } from './chrome';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PALETTE } from './palette';
import { TS } from './textStyles';

/** Ingredient -> procedural texture (flat Kenney language, theme.ts). */
const ING_TEXTURE: Record<Ingredient, string> = {
  'bun-bottom': 'ing-bun-bottom',
  patty: 'ing-patty',
  cheese: 'ing-cheese',
  lettuce: 'ing-lettuce',
  tomato: 'ing-tomato',
  'bun-top': 'ing-bun-top',
  plate: 'ing-plate',
  pancake: 'ing-pancake',
  butter: 'ing-butter',
  syrup: 'ing-syrup',
  cup: 'ing-cup',
  juice: 'ing-juice',
  straw: 'ing-straw',
};

const CUSTOMER_X = 175;
const CUSTOMER_Y = 560;
const BUBBLE_X = 430;
const BUBBLE_Y = 470;
const PLATE_X = 360;
const PLATE_Y = 880;
const LAYER_H = 34;
const COUNTER_Y = 1120;

/**
 * Diner cooking game (run 6, decision #62): Burger-Party-style order-stack
 * loop over the pure core in src/core/diner. Replaces the recipe flow as THE
 * cooking game; the old CookingScene stays in the codebase, unrouted.
 */
export class DinerScene extends Phaser.Scene {
  private state!: ShiftState;
  private journal!: Journal;
  private wallet!: Wallet;
  private pantry!: Pantry;
  private blips!: Blips;
  private busy = false;
  private over = false;
  private buildSprites: Phaser.GameObjects.Sprite[] = [];
  private customerSprite: Phaser.GameObjects.Sprite | null = null;
  private bubbleObjects: Phaser.GameObjects.GameObject[] = [];
  private counterObjects: Phaser.GameObjects.GameObject[] = [];
  private bell: Phaser.GameObjects.Sprite | null = null;
  private patienceBar: Phaser.GameObjects.Rectangle | null = null;
  private shieldIcon: Phaser.GameObjects.Sprite | null = null;
  private mistakePips: Phaser.GameObjects.Sprite[] = [];
  private coinText!: Phaser.GameObjects.Text;

  constructor() {
    super('diner');
  }

  create(): void {
    fadeIn(this);
    this.busy = false;
    this.over = false;
    this.buildSprites = [];
    this.bubbleObjects = [];
    this.counterObjects = [];
    this.customerSprite = null;
    this.bell = null;
    this.patienceBar = null;
    this.shieldIcon = null;
    this.mistakePips = [];
    this.journal = createJournal(window.localStorage, () => Date.now());
    this.wallet = createWallet(window.localStorage);
    this.pantry = createPantry(window.localStorage);
    this.blips = createBlips();
    this.blips.setMuted(window.localStorage.getItem('omnigame.muted.v1') === '1');
    this.input.on('pointerdown', () => this.blips.unlock());
    // Warm diner variant of the shared gradient.
    buildBackground(this, 0x4a2e4d, PALETTE.bgPlum, PALETTE.bgDeep);
    // Header: home left, coins right (same anatomy as the runner header).
    this.add.image(GAME_WIDTH / 2, 96, 'ui-panel').setDisplaySize(664, 128).setAlpha(0.45).setDepth(0);
    const home = this.add.sprite(78, 96, 'img-ui-home').setDisplaySize(68, 68).setDepth(1).setInteractive();
    pressify(this, home);
    home.on('pointerup', () => goto(this, 'hub'));
    this.add.sprite(530, 96, 'img-ui-coin').setDisplaySize(42, 42).setDepth(1);
    this.coinText = this.add.text(560, 96, String(this.wallet.data().coins), TS.number(32)).setOrigin(0, 0.5).setDepth(1);
    if (PROFILE.textTier !== 'none') {
      this.add.text(GAME_WIDTH / 2 - 60, 96, 'Diner', TS.number(40)).setOrigin(0.5).setDepth(1);
    }
    // Counter surface the build plate sits on.
    this.add.image(PLATE_X, PLATE_Y + 76, 'img-ui-panel-blue').setDisplaySize(520, 60).setDepth(1);
    // Shift start: shield consumed up front (abuse-proof, same rule as the old
    // recipe flow, queue #27); seed = clock (renderer boundary; core stays pure).
    const shield = this.pantry.consumeOne();
    this.state = startShift(Date.now() >>> 0, shield);
    this.journal.log('diner_shift_start', { shield });
    if (shield) {
      this.shieldIcon = this.add.sprite(628, 172, 'img-ui-heart').setDisplaySize(44, 44).setDepth(2);
    }
    this.buildCounter();
    this.welcomeCustomer();
  }

  override update(_time: number, deltaMs: number): void {
    if (this.over || this.state === undefined || this.state.status !== 'serving') return;
    this.state = tickPatience(this.state, deltaMs / 1000);
    const customer = this.state.customers[this.state.current];
    if (this.patienceBar !== null && customer !== undefined) {
      this.patienceBar.width = 150 * customer.patience;
      this.patienceBar.fillColor = customer.patience >= 0.3 ? 0x54b842 : 0xd8402e;
    }
  }

  /** Ingredient buttons for the CURRENT customer's dish family. */
  private buildCounter(): void {
    for (const o of this.counterObjects) o.destroy();
    this.counterObjects = [];
    const customer = this.state.customers[this.state.current];
    if (customer === undefined) return;
    const items = counterFor(customer.dish.family);
    const spacing = Math.min(116, 620 / items.length);
    const x0 = GAME_WIDTH / 2 - ((items.length - 1) / 2) * spacing;
    items.forEach((ing, i) => {
      const x = x0 + i * spacing;
      const base = this.add.sprite(x, COUNTER_Y, 'img-ui-btn-sq-blue').setDisplaySize(96, 96).setDepth(2).setInteractive();
      const icon = this.add.sprite(x, COUNTER_Y, ING_TEXTURE[ing]).setDisplaySize(66, 66).setDepth(3);
      pressify(this, base, icon);
      base.on('pointerup', () => this.tap(ing, base, icon));
      this.counterObjects.push(base, icon);
    });
  }

  /** Next customer walks in with their order bubble. */
  private welcomeCustomer(): void {
    const customer = this.state.customers[this.state.current];
    if (customer === undefined) return;
    for (const o of this.bubbleObjects) o.destroy();
    this.bubbleObjects = [];
    this.customerSprite?.destroy();
    // Customers alternate between the two toon townsfolk.
    const tex = this.state.current % 2 === 0 ? 'img-toon-cust-a' : 'img-toon-cust-b';
    const key = this.textures.exists(tex) ? tex : 'img-toon-bro-idle';
    this.customerSprite = this.add.sprite(-80, CUSTOMER_Y, key).setDisplaySize(150, 200).setDepth(2);
    this.tweens.add({ targets: this.customerSprite, x: CUSTOMER_X, duration: 420, ease: 'Quad.easeOut' });
    // Order bubble: the dish stack bottom-to-top, pictures only.
    const stack = customer.dish.stack;
    const bubbleH = 60 + stack.length * 44;
    this.bubbleObjects.push(
      this.add.image(BUBBLE_X, BUBBLE_Y, 'ui-bubble').setDisplaySize(190, bubbleH).setDepth(2),
    );
    stack.forEach((ing, i) => {
      this.bubbleObjects.push(
        this.add.sprite(BUBBLE_X, BUBBLE_Y + (stack.length - 1) * 22 - i * 44 - 6, ING_TEXTURE[ing]).setDisplaySize(46, 46).setDepth(3),
      );
    });
    // Patience: a smile-meter bar under the customer (tip only, never failure).
    this.bubbleObjects.push(
      this.add.rectangle(CUSTOMER_X, CUSTOMER_Y + 130, 154, 18, 0x0e1e3d, 0.7).setDepth(2),
    );
    this.patienceBar = this.add.rectangle(CUSTOMER_X - 75, CUSTOMER_Y + 130, 150, 12, 0x54b842).setOrigin(0, 0.5).setDepth(3);
    this.bubbleObjects.push(this.patienceBar);
    this.buildCounter();
  }

  private tap(ing: Ingredient, btn: Phaser.GameObjects.Sprite, icon: Phaser.GameObjects.Sprite): void {
    if (this.busy || this.over) return;
    const r = tapIngredient(this.state, ing);
    this.state = r.state;
    for (const ev of r.events) this.handle(ev, btn, icon);
  }

  private handle(ev: DinerEvent, btn?: Phaser.GameObjects.Sprite, icon?: Phaser.GameObjects.Sprite): void {
    switch (ev.type) {
      case 'placed': {
        sfx(this, 'piece-drop', { volume: 0.7 });
        const target = { x: PLATE_X, y: PLATE_Y - ev.layer * LAYER_H };
        const from = icon ?? this.customerSprite;
        const sp = this.add
          .sprite(from?.x ?? PLATE_X, from?.y ?? PLATE_Y, ING_TEXTURE[ev.ingredient])
          .setDisplaySize(150, 150)
          .setDepth(4 + ev.layer);
        this.buildSprites.push(sp);
        this.tweens.add({ targets: sp, x: target.x, y: target.y, duration: 240, ease: 'Back.easeOut' });
        break;
      }
      case 'rejected': {
        sfx(this, 'lose-soft', { volume: 0.35 });
        if (btn !== undefined && icon !== undefined) {
          const x = btn.x;
          this.tweens.add({ targets: [btn, icon], x: x + 8, duration: 40, yoyo: true, repeat: 3, onComplete: () => { btn.setX(x); icon.setX(x); } });
        }
        if (ev.shielded && this.shieldIcon !== null) {
          const shield = this.shieldIcon;
          this.shieldIcon = null;
          this.tweens.add({ targets: shield, alpha: 0, scale: shield.scale * 1.6, duration: 350, onComplete: () => shield.destroy() });
        } else if (this.mistakePips.length < 12) {
          // Capped: past a dozen the row would march into the shield/coin HUD.
          const pip = this.add.sprite(84 + this.mistakePips.length * 34, 172, 'ui-pip').setTint(0xd8402e).setScale(1.3).setDepth(2);
          this.mistakePips.push(pip);
        }
        break;
      }
      case 'ready': {
        sfx(this, 'collect-ding', { volume: 0.8 });
        this.showBell();
        break;
      }
      case 'served': {
        // handled in serve()
        break;
      }
      case 'shiftEnd': {
        // handled in serve()
        break;
      }
    }
  }

  private showBell(): void {
    this.bell?.destroy();
    const bell = this.add.sprite(560, PLATE_Y - 40, 'img-ui-ok').setDisplaySize(110, 110).setDepth(6).setInteractive();
    this.bell = bell;
    pressify(this, bell);
    this.tweens.add({ targets: bell, scale: bell.scale * 1.1, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    bell.on('pointerup', () => void this.serve());
    if (PROFILE.textTier !== 'none') {
      this.bubbleObjects.push(this.add.text(560, PLATE_Y + 36, 'Serve!', TS.label(24)).setOrigin(0.5).setDepth(6));
    }
  }

  private async serve(): Promise<void> {
    if (this.busy || this.over) return;
    this.busy = true;
    // Detach the bar before state advances: serveReady moves `current`, and
    // the update() loop would repaint the DEPARTING customer's bar with the
    // NEXT customer's patience during the leave animation.
    this.patienceBar = null;
    const r = serveReady(this.state);
    this.state = r.state;
    const served = r.events.find((e): e is Extract<DinerEvent, { type: 'served' }> => e.type === 'served');
    const end = r.events.find((e): e is Extract<DinerEvent, { type: 'shiftEnd' }> => e.type === 'shiftEnd');
    if (served === undefined) {
      this.busy = false;
      return;
    }
    this.bell?.destroy();
    this.bell = null;
    this.journal.log('diner_serve', { customer: served.customer, tipped: served.tipped, mistakes: this.state.customers[served.customer]?.mistakes ?? 0 });
    sfx(this, 'win-fanfare', { volume: 0.5 });
    // The stack slides to the customer; coins fly to the counter.
    const slide = [...this.buildSprites];
    this.buildSprites = [];
    for (const sp of slide) {
      this.tweens.add({ targets: sp, x: CUSTOMER_X + 60, alpha: 0, duration: 380, ease: 'Quad.easeIn', onComplete: () => sp.destroy() });
    }
    const pips = served.tipped ? 5 : 3;
    for (let i = 0; i < pips; i++) {
      const pip = this.add.sprite(CUSTOMER_X + 40, CUSTOMER_Y, 'ui-pip').setTint(0xf1c40f).setScale(1.4).setDepth(8);
      this.tweens.add({ targets: pip, x: 530, y: 96, scale: 0.5, duration: 480, delay: i * 70, ease: 'Cubic.easeIn', onComplete: () => pip.destroy() });
    }
    sfx(this, 'coin-clink');
    // Customer cheers off-screen.
    if (this.customerSprite !== null) {
      const leaving = this.customerSprite;
      this.customerSprite = null;
      this.tweens.add({ targets: leaving, x: GAME_WIDTH + 90, duration: 480, delay: 220, ease: 'Quad.easeIn', onComplete: () => leaving.destroy() });
    }
    await new Promise<void>((resolve) => this.time.delayedCall(650, () => resolve()));
    if (end !== undefined) {
      this.finishShift(end.stars, end.mistakes);
    } else {
      this.welcomeCustomer();
      this.busy = false;
    }
  }

  private finishShift(stars: 1 | 2 | 3, mistakes: number): void {
    this.over = true;
    this.wallet.earnCooking(stars);
    this.journal.log('diner_shift_end', { stars, mistakes, coins: 30 + 10 * stars });
    this.coinText.setText(String(this.wallet.data().coins));
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setDepth(10);
    sfx(this, 'win-fanfare');
    for (let i = 0; i < 3; i++) {
      const x = GAME_WIDTH / 2 + (i - 1) * 150;
      const slot = this.add.sprite(x, 470, 'img-ui-star').setDisplaySize(120, 112).setDepth(11).setTint(0x555566);
      if (i < stars) {
        slot.clearTint();
        slot.setScale(0);
        this.tweens.add({ targets: slot, displayWidth: 120, displayHeight: 112, duration: 280, delay: 250 + i * 200, ease: 'Back.easeOut' });
        sfx(this, 'star-pop', { rate: 1 + i * 0.08, delay: (250 + i * 200) / 1000 });
      }
    }
    const again = this.add.sprite(GAME_WIDTH / 2 - 90, 700, 'img-ui-retry').setDisplaySize(120, 120).setDepth(11).setInteractive();
    const homeBtn = this.add.sprite(GAME_WIDTH / 2 + 90, 700, 'img-ui-home').setDisplaySize(120, 120).setDepth(11).setInteractive();
    pressify(this, again);
    pressify(this, homeBtn);
    again.once('pointerup', () => this.scene.restart());
    homeBtn.once('pointerup', () => goto(this, 'hub'));
  }
}
