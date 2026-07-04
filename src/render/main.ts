import Phaser from 'phaser';
import { APP_IDENTITY } from '../config/appIdentity';
import { CareerScene } from './CareerScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { CookingScene } from './CookingScene';
import { HubScene } from './HubScene';
import { PlayScene } from './PlayScene';

// The hub is the front door for everyone (plan 8): Phaser auto-starts the first
// scene in the array. PlayScene's zero-text tutorial still triggers on its own
// fresh-save condition the first time the match-3 game is entered.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: APP_IDENTITY.themeColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [HubScene, CareerScene, PlayScene, CookingScene],
});
