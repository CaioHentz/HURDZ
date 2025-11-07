// Phaser 3 UI/HUD overlay scene
import Phaser from 'phaser';
import {
  UPGRADE_TYPES,
  getUpgradeCost,
  canUpgrade,
  applyUpgrade,
  getState,
  isWeaponUnlocked,
  unlockWeapon,
  selectWeapon,
  getSelectedWeapon
} from '../state.js';

export class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
    this.hud = {
      hpText: null,
      coinsText: null,
      killsText: null,
      weaponText: null,
      signatureText: null
    };
    this.overlay = {
      container: null,
      bg: null,
      title: null,
      statsText: null,
      buttons: [],
      restartBtn: null,
      shotgunBtn: null
    };

    // Pause menu overlay
    this.pauseOverlay = {
      container: null,
      title: null,
      resumeBtn: null,
      restartBtn: null
    };
    this.hudData = {
      hp: 0,
      maxHP: 0,
      coins: 0,
      kills: 0,
      runKills: 0,
      weapon: 'pistol',
      fireInterval: 0
    };
    this.ambientStarted = false;
    this.ambientTimer = null;
  }

  create() {
    const main = this.scene.get('MainScene');
    // Listen to events from MainScene
    main.events.on('hud-init', (payload) => this.updateHUD(payload));
    main.events.on('hud-update', (payload) => this.updateHUD(payload));
    main.events.on('game-over', (payload) => this.showGameOver(payload));

    // Top-left HUD texts
    this.hud.hpText = this.add.text(12, 10, '♥ Vida: 0/0', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '14px',
      color: '#1F2D3D'
    }).setDepth(1000).setScrollFactor(0);
    this.hud.coinsText = this.add.text(12, 32, '💰 0', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '14px',
      color: '#B8860B'
    }).setDepth(1000).setScrollFactor(0);
    this.hud.killsText = this.add.text(12, 54, '☠️ 0', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '14px',
      color: '#8B0000'
    }).setDepth(1000).setScrollFactor(0);
    this.hud.weaponText = this.add.text(12, 76, '🔫 Pistol', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '14px',
      color: '#0D3B66'
    }).setDepth(1000).setScrollFactor(0);

    // Bottom-right signature
    this.hud.signatureText = this.add.text(this.scale.width - 12, this.scale.height - 12, 'v0.1.0-alpha - Caio Hentz - 2025', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '10px',
      color: '#1F2D3D'
    }).setOrigin(1, 1).setDepth(1000).setScrollFactor(0).setAlpha(0.85);

    // Create hidden game-over overlay
    this.buildOverlay();

    // Start ambient music when user interacts (browser autoplay policies)
    this.input.once('pointerdown', () => this.startAmbient());
    this.scale.on('resize', () => this.layout());
    this.layout();

    // Build pause overlay and bind ESC to toggle pause
    this.buildPauseOverlay();
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
  }

  // ----- HUD -----
  updateHUD(payload) {
    // Merge hud data and refresh texts
    this.hudData = { ...this.hudData, ...payload };
    const d = this.hudData;
    if (this.hud.hpText) this.hud.hpText.setText(`♥ Vida: ${Math.max(0, Math.floor(d.hp))}/${d.maxHP}`);
    if (this.hud.coinsText) this.hud.coinsText.setText(`💰 ${getState().coins}`);
    if (this.hud.killsText) this.hud.killsText.setText(`☠️ ${getState().totalKills}`);
    if (this.hud.weaponText) {
      const w = d.weapon || getSelectedWeapon();
      const rate = d.fireInterval ? `${d.fireInterval}ms` : '';
      this.hud.weaponText.setText(`🔫 ${w} ${rate ? '(' + rate + ')' : ''}`);
    }
  }

  // ----- Overlay -----
  buildOverlay() {
    const w = this.scale.width;
    const h = this.scale.height;

    const container = this.add.container(0, 0).setDepth(2000).setVisible(false);
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.6).setOrigin(0);
    bg.setInteractive(); // block clicks from passing through to gameplay
    container.add(bg);

    const title = this.add.text(w / 2, h / 2 - 160, 'GAME OVER', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '28px',
      color: '#ff6666'
    }).setOrigin(0.5, 0.5);
    container.add(title);

    const statsText = this.add.text(w / 2, h / 2 - 110, '', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '14px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5, 0.5);
    container.add(statsText);

    // Upgrade buttons
    const buttons = [];
    const mkBtn = (x, y, label, callback) => {
      const btnContainer = this.add.container(x, y);
      const rect = this.add.rectangle(0, 0, 260, 36, 0x222222, 0.9).setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.5);
      const txt = this.add.text(0, 0, label, {
        fontFamily: `'Press Start 2P','VT323',monospace`,
        fontSize: '12px',
        color: '#eaeaea'
      }).setOrigin(0.5);
      btnContainer.add([rect, txt]);
      btnContainer.setSize(260, 36);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(0x2a2a2a, 1));
      rect.on('pointerout', () => rect.setFillStyle(0x222222, 0.9));
      rect.on('pointerdown', () => {
        callback();
        this.refreshOverlayButtons();
      });
      container.add(btnContainer);
      return { container: btnContainer, rect, txt, updateLabel: (s) => txt.setText(s) };
    };

    const cx = w / 2;
    const rowY = (i) => h / 2 - 40 + i * 44;

    // Damage
    const damageBtn = mkBtn(cx, rowY(0), 'Upgrade Damage', () => this.tryUpgrade('damage'));
    // Fire rate
    const fireBtn = mkBtn(cx, rowY(1), 'Upgrade Fire Rate', () => this.tryUpgrade('fireRate'));
    // Speed
    const speedBtn = mkBtn(cx, rowY(2), 'Upgrade Speed', () => this.tryUpgrade('speed'));

    buttons.push(damageBtn, fireBtn, speedBtn);

    // Shotgun unlock/select
    const shotgunBtn = mkBtn(cx, rowY(3), 'Unlock Shotgun', () => this.toggleShotgun());
    container.add(shotgunBtn.container);

    // Restart button
    const restartBtn = mkBtn(cx, rowY(5), 'Restart', () => this.restartRun());
    restartBtn.rect.setFillStyle(0x334433, 0.95);
    container.add(restartBtn.container);

    this.overlay = {
      container,
      bg,
      title,
      statsText,
      buttons,
      restartBtn,
      shotgunBtn
    };
  }

  refreshOverlayButtons() {
    const s = getState();
    // Update upgrade labels with cost and affordability
    for (const b of this.overlay.buttons) {
      // Determine type by label content
      let type = 'damage';
      if (b.container && b.container.list && b.container.list[1]) {
        const label = b.container.list[1].text.toLowerCase();
        if (label.includes('fire')) type = 'fireRate';
        if (label.includes('speed')) type = 'speed';
      }
      const cost = getUpgradeCost(type);
      const can = canUpgrade(type);
      const lvl = s.upgrades[type] || 0;
      const label = `${this.prettyName(type)} Lv.${lvl} — Cost: ${cost} ${can ? '' : '(Insuficiente)'}`;
      b.updateLabel(label);
      b.rect.setStrokeStyle(2, can ? 0x88ff88 : 0xff8888, 0.7);
    }

    // Shotgun button state
    const shotgunUnlocked = isWeaponUnlocked('shotgun');
    const selectedWeapon = getSelectedWeapon();
    if (shotgunUnlocked) {
      const sel = selectedWeapon === 'shotgun' ? ' (Selected)' : '';
      this.overlay.shotgunBtn.updateLabel(`Shotgun Unlocked${sel} — Click to ${selectedWeapon === 'shotgun' ? 'use Pistol' : 'use Shotgun'}`);
      this.overlay.shotgunBtn.rect.setStrokeStyle(2, 0x88ff88, 0.7);
    } else {
      const cost = 200;
      const can = s.coins >= cost;
      this.overlay.shotgunBtn.updateLabel(`Unlock Shotgun — Cost: ${cost} ${can ? '' : '(Insuficiente)'}`);
      this.overlay.shotgunBtn.rect.setStrokeStyle(2, can ? 0x88ff88 : 0xff8888, 0.7);
    }
  }

  prettyName(type) {
    switch (type) {
      case 'damage': return 'Damage';
      case 'fireRate': return 'Fire Rate';
      case 'speed': return 'Speed';
      default: return type;
    }
  }

  tryUpgrade(type) {
    const ok = applyUpgrade(type);
    if (ok) {
      // Immediately refresh labels and HUD so player sees coins deducted and level increased
      this.refreshOverlayButtons();
      this.updateHUD({});
      if (this.overlay?.statsText) {
        const s = getState();
        const lines = [
          `Run Kills: ${this.hudData.runKills || 0}`,
          `Total Kills: ${s.totalKills}`,
          `Coins: ${s.coins}`
        ];
        this.overlay.statsText.setText(lines.join('\n'));
      }
    } else {
      // Visual feedback when insufficient coins
      this.cameras.main.flash(120, 180, 40, 40);
    }
  }

  toggleShotgun() {
    const s = getState();
    if (isWeaponUnlocked('shotgun')) {
      // Toggle selection
      if (getSelectedWeapon() === 'shotgun') selectWeapon('pistol');
      else selectWeapon('shotgun');
    } else {
      const cost = 200;
      unlockWeapon('shotgun', cost);
    }
  }

  showGameOver(payload) {
    // Update stats text
    const s = getState();
    const lines = [
      `Run Kills: ${payload.runKills || 0}`,
      `Total Kills: ${s.totalKills}`,
      `Coins: ${s.coins}`
    ];
    this.overlay.statsText.setText(lines.join('\n'));

    // Show
    this.overlay.container.setVisible(true);
    this.refreshOverlayButtons();
  }

  hideOverlay() {
    this.overlay.container.setVisible(false);
  }

  restartRun() {
    const main = this.scene.get('MainScene');
    if (main) {
      // If gameplay scene is paused (e.g., after game over), resume it before restarting
      if (this.scene.isPaused('MainScene')) {
        this.scene.resume('MainScene');
      }
      this.hideOverlay();
      if (main.restartRun) main.restartRun();
    }
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (this.overlay.bg) {
      this.overlay.bg.setSize(w, h);
    }
    if (this.overlay.title) this.overlay.title.setPosition(w / 2, h / 2 - 160);
    if (this.overlay.statsText) this.overlay.statsText.setPosition(w / 2, h / 2 - 110);

    // Reposition buttons relative to center
    const cx = w / 2;
    const rowY = (i) => h / 2 - 40 + i * 44;
    const [damageBtn, fireBtn, speedBtn] = this.overlay.buttons;
    if (damageBtn) damageBtn.container.setPosition(cx, rowY(0));
    if (fireBtn) fireBtn.container.setPosition(cx, rowY(1));
    if (speedBtn) speedBtn.container.setPosition(cx, rowY(2));
    if (this.overlay.shotgunBtn) this.overlay.shotgunBtn.container.setPosition(cx, rowY(3));
    if (this.overlay.restartBtn) this.overlay.restartBtn.container.setPosition(cx, rowY(5));

    // Position signature in bottom-right
    if (this.hud.signatureText) this.hud.signatureText.setPosition(w - 12, h - 10);
  }

  // ----- Pause overlay -----
  buildPauseOverlay() {
    const w = this.scale.width;
    const h = this.scale.height;

    const container = this.add.container(0, 0).setDepth(2500).setVisible(false);
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.4).setOrigin(0);
    bg.setInteractive(); // absorb clicks while paused
    container.add(bg);

    const title = this.add.text(w / 2, h / 2 - 130, 'PAUSED', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '24px',
      color: '#99ccff'
    }).setOrigin(0.5, 0.5);
    container.add(title);

    const mkBtn = (x, y, label, callback, color = 0x222222) => {
      const btn = this.add.container(x, y);
      const rect = this.add.rectangle(0, 0, 220, 36, color, 0.9).setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.5);
      const txt = this.add.text(0, 0, label, {
        fontFamily: `'Press Start 2P','VT323',monospace`,
        fontSize: '12px',
        color: '#eaeaea'
      }).setOrigin(0.5);
      btn.add([rect, txt]);
      btn.setSize(220, 36);
      rect.setInteractive({ useHandCursor: true });
      rect.on('pointerover', () => rect.setFillStyle(color === 0x334433 ? 0x3a553a : 0x2a2a2a, 1));
      rect.on('pointerout', () => rect.setFillStyle(color, 0.9));
      rect.on('pointerdown', callback);
      container.add(btn);
      return { container: btn, rect, txt };
    };

    const cx = w / 2;
    const resumeBtn = mkBtn(cx, h / 2 - 40, 'Resume (Esc)', () => this.togglePause(), 0x334433);
    const restartBtn = mkBtn(cx, h / 2 + 10, 'Restart Run', () => {
      // Ensure main scene resumes then restart
      const main = this.scene.get('MainScene');
      if (main) {
        if (this.scene.isPaused('MainScene')) this.scene.resume('MainScene');
        this.hidePause();
        main.restartRun();
      }
    });

    this.pauseOverlay = { container, title, resumeBtn, restartBtn };

    // Keep layout responsive
    this.scale.on('resize', (size) => {
      bg.setSize(size.width, size.height);
      title.setPosition(size.width / 2, size.height / 2 - 130);
      resumeBtn.container.setPosition(size.width / 2, size.height / 2 - 40);
      restartBtn.container.setPosition(size.width / 2, size.height / 2 + 10);
    });
  }

  showPause() {
    // Pause main gameplay scene and show overlay
    if (!this.scene.isPaused('MainScene')) {
      this.scene.pause('MainScene');
    }
    if (this.pauseOverlay?.container) {
      this.pauseOverlay.container.setVisible(true);
    }
  }

  hidePause() {
    if (this.pauseOverlay?.container) {
      this.pauseOverlay.container.setVisible(false);
    }
  }

  togglePause() {
    // If game over overlay is visible, ignore pause toggles
    if (this.overlay?.container?.visible) return;

    if (this.scene.isPaused('MainScene')) {
      this.scene.resume('MainScene');
      this.hidePause();
    } else {
      this.showPause();
    }
  }

  // ----- Ambient background "music" (procedural) -----
  startAmbient() {
    if (this.ambientStarted) return;
    this.ambientStarted = true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = this.sound.context || (this.sound && this.sound.audioContext) || (AudioCtx ? new AudioCtx() : null);
      if (!ctx) return;
      const playNote = (freq, durMs, vol = 0.02) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = vol;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        osc.start(now);
        osc.stop(now + durMs / 1000);
        gain.gain.setTargetAtTime(0, now + Math.max(0, durMs - 50) / 1000, 0.02);
      };
      // Simple loop with mellow pattern
      const pattern = [220, 246, 196, 174, 196, 246];
      let i = 0;
      this.ambientTimer = setInterval(() => {
        playNote(pattern[i % pattern.length], 280, 0.015);
        i++;
      }, 420);
    } catch {
      // ignore
    }
  }

  shutdown() {
    if (this.ambientTimer) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}
