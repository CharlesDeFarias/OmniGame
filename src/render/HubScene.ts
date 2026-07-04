import Phaser from 'phaser';
import { createWallet, type Wallet } from '../services/wallet';
import { createBlips, type Blips } from './audio';
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

  constructor() {
    super('hub');
  }

  create(): void {
    makeTextures(this, 96);
    this.wallet = createWallet(window.localStorage);
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
}
