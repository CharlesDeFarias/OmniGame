import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { PlayScene } from './PlayScene';

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
  scene: [PlayScene],
});
