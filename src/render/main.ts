import Phaser from 'phaser';
import { APP_IDENTITY } from '../config/appIdentity';
import { CareerScene } from './CareerScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { CookingScene } from './CookingScene';
import { DinerScene } from './DinerScene';
import { JetpackScene } from './JetpackScene';
import { HubScene } from './HubScene';
import { MapScene } from './MapScene';
import { PlayScene } from './PlayScene';
import { PreloadScene } from './PreloadScene';
import { RunnerScene } from './RunnerScene';

// Rebrand hook (review-queue #8): index.html ships a neutral 'OmniGame' title
// and a dark fallback theme-color so nothing brand-specific flashes before JS
// runs; the real values come from the profile via APP_IDENTITY here.
document.title = APP_IDENTITY.name;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_IDENTITY.themeColor);

// Splash handoff (plan 9): index.html ships the splash with a neutral
// 'OmniGame' title; the profile name lands here synchronously, long before the
// first frame the user can read. Profile swap stays a one-file operation.
const splash = document.getElementById('splash');
const splashTitle = splash?.querySelector('.splash-title') ?? null;
if (splashTitle !== null) splashTitle.textContent = APP_IDENTITY.name;

// Brand fonts are loaded up front so Phaser's canvas text measures and renders
// with the real faces from the first frame (canvas text does not re-render on
// CSS font-display swap). Fredoka is the body face; Lilita One is the chunky
// display face for big numbers and headlines (RM-feel pass). The 2.5s timeout
// race means a slow or missing font file never blocks boot -- Phaser just uses
// the fallback stack from textStyles.ts (allSettled: one failed font never
// blocks the other).
async function loadBrandFonts(): Promise<void> {
  try {
    const faces = [
      new FontFace(
        'Fredoka',
        `url(${import.meta.env.BASE_URL}fonts/fredoka-latin.woff2)`,
        { weight: '300 700' },
      ),
      new FontFace(
        'Lilita One',
        `url(${import.meta.env.BASE_URL}fonts/lilita-latin.woff2)`,
        { weight: '400' },
      ),
    ];
    for (const face of faces) document.fonts.add(face);
    await Promise.race([
      Promise.allSettled(faces.map((face) => face.load())),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    reportFontStatus(faces);
  } catch {
    // Fonts are polish, not a dependency: boot with the fallback stack.
  }
}

/** Diagnostic (match-3 MVP pass): a silent font failure makes every screen
 *  render in the fallback stack and "the font looks bad" with no other
 *  symptom. Checks the actual FontFace objects — document.fonts.check() has
 *  false-negative quirks for canvas-only fonts. */
function reportFontStatus(faces: FontFace[]): void {
  for (const face of faces) {
    if (face.status !== 'loaded') {
      console.warn(`[fonts] ${face.family} status=${face.status} — text is rendering in the fallback stack`);
    }
  }
}

// PreloadScene boots first (RM-look milestone): it loads the CC0 art packs
// behind a progress bar, bakes the procedural textures once, then fades into
// the hub -- which stays the front door for everyone (plan 8). PlayScene's zero-text tutorial still triggers on its own
// fresh-save condition the first time the match-3 game is entered.
void loadBrandFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    backgroundColor: APP_IDENTITY.themeColor,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    // CookingScene + RunnerScene stay registered but unrouted (decision #62:
    // old flows preserved); the hub routes to the diner and jetpack instead.
    scene: [PreloadScene, HubScene, MapScene, CareerScene, PlayScene, DinerScene, JetpackScene, CookingScene, RunnerScene],
  });
  // Lift the splash curtain once the game is READY (the hub's create() runs
  // the same tick and opens with a camera fade from the same #0e1e3d, so the
  // handoff reads as one continuous fade).
  game.events.once(Phaser.Core.Events.READY, () => {
    if (splash === null) return;
    splash.classList.add('splash-hide');
    window.setTimeout(() => splash.remove(), 350);
  });
  // Dev handle for texture/state inspection during art passes (harmless in prod).
  (window as unknown as { __game?: Phaser.Game }).__game = game;
});
