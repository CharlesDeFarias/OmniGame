import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, 200, 200, 0x3498db);
  }
}

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

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
  scene: [BootScene],
});
