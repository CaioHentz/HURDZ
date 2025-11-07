// Simple main menu scene
import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
    this.titleText = null;
    this.promptText = null;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // Background matches game theme
    this.cameras.main.setBackgroundColor('#FFFFF2');

    // Title: HURDZ!
    this.titleText = this.add.text(w / 2, h / 2 - 80, 'HURDZ!', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '36px',
      color: '#1F2D3D',
      stroke: '#419D78',
      strokeThickness: 2
    })
      .setOrigin(0.5, 0.5)
      .setDepth(10)
      .setScrollFactor(0);

    // Prompt
    this.promptText = this.add.text(w / 2, h / 2 + 10, 'Press [SPACE] to play', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '16px',
      color: '#419D78'
    })
      .setOrigin(0.5, 0.5)
      .setDepth(10)
      .setScrollFactor(0);

    // Gentle blink to draw attention
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1.0, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Start game on SPACE
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('MainScene'); // MainScene will launch UIScene itself
    });

    // Responsive layout
    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.titleText) this.titleText.setPosition(w / 2, h / 2 - 80);
    if (this.promptText) this.promptText.setPosition(w / 2, h / 2 + 10);
  }
}
