import Phaser from 'phaser';
import { APP_IDENTITY } from '../config/appIdentity';
import { CareerScene } from './CareerScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { CookingScene } from './CookingScene';
import { HubScene } from './HubScene';
import { PlayScene } from './PlayScene';
import { RunnerScene } from './RunnerScene';

// Rebrand hook (review-queue #8): index.html ships a neutral 'OmniGame' title
// and a dark fallback theme-color so nothing brand-specific flashes before JS
// runs; the real values come from the profile via APP_IDENTITY here.
document.title = APP_IDENTITY.name;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_IDENTITY.themeColor);

// Fredoka is loaded up front so Phaser's canvas text measures and renders with
// the real font from the first frame (canvas text does not re-render on CSS
// font-display swap). The 2.5s timeout race means a slow or missing font file
// never blocks boot -- Phaser just uses the fallback stack from textStyles.ts.
async function loadBrandFont(): Promise<void> {
  try {
    const face = new FontFace(
      'Fredoka',
      `url(${import.meta.env.BASE_URL}fonts/fredoka-latin.woff2)`,
      { weight: '300 700' },
    );
    document.fonts.add(face);
    await Promise.race([
      face.load(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Font is polish, not a dependency: boot with the fallback stack.
  }
}

// The hub is the front door for everyone (plan 8): Phaser auto-starts the first
// scene in the array. PlayScene's zero-text tutorial still triggers on its own
// fresh-save condition the first time the match-3 game is entered.
void loadBrandFont().then(() => new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: APP_IDENTITY.themeColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [HubScene, CareerScene, PlayScene, CookingScene, RunnerScene],
}));
