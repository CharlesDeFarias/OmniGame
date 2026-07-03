import Phaser from 'phaser';
import { loadProgress } from '../services/progress';
import { CareerScene } from './CareerScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PlayScene } from './PlayScene';

// Returning players land on the career hub; a fresh save boots straight into level 1.
// Phaser auto-starts the first scene in the array.
const returning = loadProgress(window.localStorage).levelIndexByChapter.kitchen > 0;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: returning ? [CareerScene, PlayScene] : [PlayScene, CareerScene],
});
