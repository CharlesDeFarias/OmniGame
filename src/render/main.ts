import Phaser from 'phaser';
import { APP_IDENTITY } from '../config/appIdentity';
import { loadProgress } from '../services/progress';
import { createWallet } from '../services/wallet';
import { CareerScene } from './CareerScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PlayScene } from './PlayScene';

// Returning players land on the career hub; a fresh save boots straight into level 1.
// "Returning" = ANY progress: a level index moved in any chapter, any completed level,
// or coins in the wallet (covers chapter-replay resets, where indices return to 0).
// Phaser auto-starts the first scene in the array.
const progress = loadProgress(window.localStorage);
const returning =
  Object.values(progress.levelIndexByChapter).some((i) => i > 0) ||
  Object.keys(progress.completed).length > 0 ||
  createWallet(window.localStorage).data().coins > 0;

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
  scene: returning ? [CareerScene, PlayScene] : [PlayScene, CareerScene],
});
