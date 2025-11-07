// Entry point for Phaser + Vite
import Phaser from 'phaser';
import { MainScene } from './scenes/MainScene.js';
import { UIScene } from './scenes/UIScene.js';
import { MenuScene } from './scenes/MenuScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#FFFFF2',
  width: 960,
  height: 540,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  scene: [MenuScene, MainScene, UIScene]
};

new Phaser.Game(config);
