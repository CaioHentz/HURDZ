// Phaser 3 top-down shooter main gameplay scene
import Phaser from 'phaser';
import {
  getState,
  getComputedStats,
  addCoins,
  addKills
} from '../state.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.player = null;
    this.cursors = null;
    this.wasd = null;
    this.bullets = null;
    this.zombies = null;
    this.fireTimer = null;
    this.spawnTimer = null;
    this.bloodEmitter = null;
    this.hurtCooldown = 0;
    this.runKills = 0;
    this.hp = 0;
    this.stats = null;
    this.background = null;
    this.gameOverFlag = false;
  }

  preload() {
    // No external assets: generate simple placeholder textures
    this.createPlaceholderTextures();
  }

  create() {
    // World/background
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor('#FFFFF2');
    // Launch UI overlay scene
    this.scene.launch('UIScene');

    // Physics groups
    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 400,
      runChildUpdate: false
    });
    this.zombies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 200,
      runChildUpdate: false
    });

    // Player
    this.player = this.physics.add.image(w / 2, h / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(1);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Stats and HP
    this.stats = getComputedStats();
    this.hp = this.stats.maxHP;
    this.runKills = 0;

    // Timers and difficulty
    this.resetFireTimer();

    // Difficulty settings (escalate over time)
    this.difficulty = {
      level: 0,
      spawnDelay: 1400,     // ms between spawns
      spawnCount: 1,        // zombies per spawn tick
      zombieHpBase: 12,     // base HP
      zombieHpRange: 8,     // extra HP range
      zombieSpeedBase: 70,  // base speed
      speedRange: 50,       // extra speed range
      fastChance: 0.03,     // chance for fast variant
      tankChance: 0.015     // chance for tank variant
    };

    // Spawn loop based on current difficulty
    this.spawnTimer = this.time.addEvent({
      delay: this.difficulty.spawnDelay,
      loop: true,
      callback: () => this.spawnZombie()
    });

    // Difficulty increases every 30 seconds
    this.diffTimer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: () => this.increaseDifficulty()
    });

    // Collisions
    this.physics.add.overlap(this.bullets, this.zombies, (bullet, zombie) => {
      this.handleBulletHit(bullet, zombie);
    });

    this.physics.add.overlap(this.player, this.zombies, (player, zombie) => {
      this.handlePlayerHit(zombie);
    });

    // Particles
    this.bloodEmitter = this.add.particles(0, 0, 'blood', {
      speed: { min: 60, max: 120 },
      lifespan: 300,
      quantity: 8,
      scale: { min: 0.6, max: 1.2 },
      gravityY: 0,
      on: false
    });

    // Camera stays static, HUD scene will render on top
    this.events.emit('hud-init', this.getHUDPayload());

    // Kill milestones configuration
    this.killMilestoneTargets = [10, 100, 1000, 5000, 10000, 100000, 1000000];
    this.killMilestonesShown = new Set();

    // Easter egg: type "cbum" to spawn a massive zombie
    this.easter = { buffer: '', secret: 'cbum' };
    this.input.keyboard.on('keydown', (ev) => {
      const k = ev.key ? ev.key.toLowerCase() : '';
      if (/^[a-z]$/.test(k)) {
        const s = this.easter.secret;
        this.easter.buffer = (this.easter.buffer + k).slice(-s.length);
        if (this.easter.buffer === s) {
          this.spawnMassiveZombie();
          this.easter.buffer = '';
        }
      }
    });

  }

  update(time, delta) {
    if (!this.player.active) return;

    // Movement
    const speed = this.stats.playerSpeed;
    const vx = (this.cursors.left.isDown || this.wasd.left.isDown ? -1 : 0) +
               (this.cursors.right.isDown || this.wasd.right.isDown ? 1 : 0);
    const vy = (this.cursors.up.isDown || this.wasd.up.isDown ? -1 : 0) +
               (this.cursors.down.isDown || this.wasd.down.isDown ? 1 : 0);

    let normX = vx, normY = vy;
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      normX /= len; normY /= len;
    }
    this.player.setVelocity(normX * speed, normY * speed);

    // Aim at pointer
    const pointer = this.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.cameras.main);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    this.player.setRotation(angle);

    // Zombies chase player
    this.zombies.children.iterate((z) => {
      if (!z) return;
      const dzx = this.player.x - z.x;
      const dzy = this.player.y - z.y;
      const l = Math.hypot(dzx, dzy);
      if (l > 0) {
        const s = z.data.get('speed') || 100;
        z.setVelocity((dzx / l) * s, (dzy / l) * s);
        z.setRotation(Phaser.Math.Angle.Between(z.x, z.y, this.player.x, this.player.y));
      }
    });

    // Hurt cooldown tick
    if (this.hurtCooldown > 0) {
      this.hurtCooldown -= delta;
    }
  }

  // ----- Gameplay helpers -----

  resetFireTimer() {
    if (this.fireTimer) this.fireTimer.remove(false);
    this.stats = getComputedStats();
    this.fireTimer = this.time.addEvent({
      delay: this.stats.fireInterval,
      loop: true,
      callback: () => this.fire()
    });
    this.events.emit('hud-update', this.getHUDPayload());
  }

  // Increase difficulty over time: more zombies, faster spawn rate, stronger/faster zombies
  increaseDifficulty() {
    if (!this.difficulty) return;
    this.difficulty.level += 1;

    // Increase zombies per tick every 2 levels up to 4
    if (this.difficulty.level % 2 === 0 && this.difficulty.spawnCount < 4) {
      this.difficulty.spawnCount += 1;
    }

    // Reduce delay between spawns down to a minimum
    this.difficulty.spawnDelay = Math.max(500, Math.round(this.difficulty.spawnDelay * 0.92));

    // Make zombies tougher and faster
    this.difficulty.zombieHpBase += 2;
    this.difficulty.zombieHpRange += 1;
    this.difficulty.zombieSpeedBase += 3;
    this.difficulty.speedRange += 2;

    // Increase rare variant chances
    this.difficulty.fastChance = Math.min(0.25, this.difficulty.fastChance + 0.02);
    this.difficulty.tankChance = Math.min(0.15, this.difficulty.tankChance + 0.01);

    // Recreate spawn timer to apply new delay
    if (this.spawnTimer) this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.difficulty.spawnDelay,
      loop: true,
      callback: () => this.spawnZombie()
    });

    // Update HUD
    this.events.emit('hud-update', this.getHUDPayload());

    // Announcement: difficulty increased
    this.playMakeItHarderSfx();
    const msg = this.add.text(this.scale.width / 2, this.scale.height / 2 - 200, 'MAKE IT HARDER!', {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '24px',
      color: '#D1495B',
      stroke: '#1F2D3D',
      strokeThickness: 2
    })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0.95);

    this.time.delayedCall(2000, () => {
      if (msg && msg.active) msg.destroy();
    });
  }

  fire() {
    if (!this.player.active) return;

    // Determine direction to current pointer location
    const pointer = this.input.activePointer;
    const worldPoint = pointer.positionToCamera(this.cameras.main);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);

    const bulletSpeed = this.stats.bulletSpeed;
    const pelletCount = this.stats.pelletCount;
    const spreadDeg = this.stats.spreadDeg;

    for (let i = 0; i < pelletCount; i++) {
      const spread = Phaser.Math.DegToRad((Math.random() - 0.5) * spreadDeg);
      const a = angle + spread;
      const bx = this.player.x + Math.cos(a) * 24;
      const by = this.player.y + Math.sin(a) * 24;

      const bullet = this.bullets.get(bx, by, 'bullet');
      if (!bullet) continue;
      bullet.setActive(true).setVisible(true);
      bullet.setDepth(1);
      bullet.setRotation(a);
      bullet.body.setCircle(4);
      const vx = Math.cos(a) * bulletSpeed;
      const vy = Math.sin(a) * bulletSpeed;
      bullet.setVelocity(vx, vy);
      bullet.data = bullet.data || new Phaser.Data.DataManager(bullet);
      bullet.data.set('damage', this.stats.damage);

      // Auto-destroy based on weapon lifetime
      const life = (this.stats && this.stats.bulletLifetime) ? this.stats.bulletLifetime : 1200;
      this.time.delayedCall(life, () => {
        if (bullet.active) bullet.destroy();
      });
    }

    // Shot sound (softer)
    this.playShot();
  }

  spawnZombie() {
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 20;

    const d = this.difficulty || {
      spawnCount: 1,
      zombieHpBase: 12,
      zombieHpRange: 8,
      zombieSpeedBase: 70,
      speedRange: 50
    };

    // Spawn N zombies at random edges per tick
    for (let i = 0; i < d.spawnCount; i++) {
      const side = Phaser.Math.Between(0, 3);
      let zx = 0, zy = 0;
      switch (side) {
        case 0: // top
          zx = Phaser.Math.Between(margin, w - margin);
          zy = margin;
          break;
        case 1: // bottom
          zx = Phaser.Math.Between(margin, w - margin);
          zy = h - margin;
          break;
        case 2: // left
          zx = margin;
          zy = Phaser.Math.Between(margin, h - margin);
          break;
        case 3: // right
          zx = w - margin;
          zy = Phaser.Math.Between(margin, h - margin);
          break;
      }

      // Decide variant based on difficulty chances
      const roll = Math.random();
      let key = 'zombie';
      let speedMult = 1;
      let hpMult = 1;
      let bodyRadius = 10;
      // Per-variant contact damage characteristics
      let dmgMin = 6, dmgMax = 12, hitCd = 350;

      if (roll < (d.tankChance || 0)) {
        // Tank variant: slower, much more HP
        key = 'zombie_tank';
        speedMult = 0.6;
        hpMult = 10.0;
        bodyRadius = 14;
      } else if (roll < (d.tankChance || 0) + (d.fastChance || 0)) {
        // Fast variant: smaller, faster, lower damage but higher rate
        key = 'zombie_fast';
        speedMult = 1.6;
        hpMult = 0.6;
        bodyRadius = 6;
        dmgMin = 3;
        dmgMax = 6;
        hitCd = 200;
      }

      const z = this.zombies.get(zx, zy, key);
      if (!z) continue;
      z.setActive(true).setVisible(true);
      z.setDepth(0);
      z.data = z.data || new Phaser.Data.DataManager(z);

      // Escalating stats
      const speedMin = d.zombieSpeedBase;
      const speedMax = d.zombieSpeedBase + d.speedRange;
      const hpMin = d.zombieHpBase;
      const hpMax = d.zombieHpBase + d.zombieHpRange;

      const speed = Phaser.Math.Between(speedMin, speedMax) * speedMult;
      const hp = Math.max(1, Math.round(Phaser.Math.Between(hpMin, hpMax) * hpMult));

      z.data.set('speed', speed);
      z.data.set('hp', hp);
      z.data.set('dmgMin', dmgMin);
      z.data.set('dmgMax', dmgMax);
      z.data.set('hitCooldown', hitCd);
      z.body.setCircle(bodyRadius);
    }
  }

  // Easter egg: spawn a massive, very slow zombie with 30x HP
  spawnMassiveZombie() {
    const w = this.scale.width;
    const h = this.scale.height;
    const margin = 20;

    // Pick a random edge position
    const side = Phaser.Math.Between(0, 3);
    let zx = 0, zy = 0;
    switch (side) {
      case 0: zx = Phaser.Math.Between(margin, w - margin); zy = margin; break;         // top
      case 1: zx = Phaser.Math.Between(margin, w - margin); zy = h - margin; break;     // bottom
      case 2: zx = margin; zy = Phaser.Math.Between(margin, h - margin); break;         // left
      case 3: zx = w - margin; zy = Phaser.Math.Between(margin, h - margin); break;     // right
    }

    const z = this.zombies.get(zx, zy, 'zombie_massive');
    if (!z) return;
    z.setActive(true).setVisible(true);
    z.setScale(3);
    z.setDepth(0);
    z.data = z.data || new Phaser.Data.DataManager(z);

    const d = this.difficulty || {
      zombieHpBase: 12,
      zombieHpRange: 8,
      zombieSpeedBase: 70,
      speedRange: 50
    };

    // Base ranges from difficulty
    const speedMin = d.zombieSpeedBase;
    const speedMax = d.zombieSpeedBase + d.speedRange;
    const hpMin = d.zombieHpBase;
    const hpMax = d.zombieHpBase + d.zombieHpRange;

    // Massive stats: very slow, huge health
    const speed = Phaser.Math.Between(speedMin, speedMax) * 0.3;
    const hp = Math.max(1, Math.round(Phaser.Math.Between(hpMin, hpMax) * 30));

    z.data.set('speed', speed);
    z.data.set('hp', hp);
    // Keep default contact damage and cooldown (use scene defaults)
    z.body.setCircle(66);

    // Small audio cue
    this.playTone(180, 120, 0.05, 'triangle', 900);
  }

  // Kill milestone announcement
  showKillMilestone(k) {
    const w = this.scale.width;
    const h = this.scale.height;
    const msg = this.add.text(w / 2, h / 2 - 160, `Milestone: ${k} Kills`, {
      fontFamily: `'Press Start 2P','VT323',monospace`,
      fontSize: '22px',
      color: '#6A4C93',
      stroke: '#1F2D3D',
      strokeThickness: 2
    })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(9999)
      .setAlpha(0.95);

    // Fade and destroy after 2 seconds
    this.time.delayedCall(2000, () => {
      if (msg && msg.active) msg.destroy();
    });
  }

  checkKillMilestone(total) {
    for (const target of this.killMilestoneTargets || []) {
      if (total >= target && !this.killMilestonesShown.has(target)) {
        this.killMilestonesShown.add(target);
        this.showKillMilestone(target);
        break; // show one at a time if multiple thresholds passed at once
      }
    }
  }

  handleBulletHit(bullet, zombie) {
    if (!bullet.active || !zombie.active) return;
    const dmg = bullet.data?.get('damage') || 10;
    let hp = zombie.data.get('hp') || 0;
    hp -= dmg;
    if (hp <= 0) {
      // Death
      this.bloodEmitter.emitParticleAt(zombie.x, zombie.y);
      this.playKillImpact();
      zombie.destroy();
      bullet.destroy();
      this.runKills += 1;
      addKills(1);
      this.checkKillMilestone(getState().totalKills);
      addCoins(10);
      this.events.emit('hud-update', this.getHUDPayload());
    } else {
      zombie.data.set('hp', hp);
      bullet.destroy();
      // slight hit effect?
      this.playHitImpact();
      this.bloodEmitter.emitParticleAt(zombie.x, zombie.y);
    }
  }

  handlePlayerHit(zombie) {
    if (this.hurtCooldown > 0) return;
    const zData = zombie?.data;
    const dmin = zData?.get('dmgMin') ?? 6;
    const dmax = zData?.get('dmgMax') ?? 12;
    const hitCd = zData?.get('hitCooldown') ?? 350;
    this.hurtCooldown = hitCd; // ms
    const dmg = Phaser.Math.Between(dmin, dmax);
    this.hp = Math.max(0, this.hp - dmg);
    this.cameras.main.flash(100, 200, 40, 40);
    this.playTone(260, 100, 0.08);
    this.events.emit('hud-update', this.getHUDPayload());
    if (this.hp <= 0) {
      this.gameOver();
    }
  }

  gameOver() {
    // Prevent multiple game-over triggers
    if (this.gameOverFlag) return;
    this.gameOverFlag = true;

    // Stop timers and disable player
    if (this.fireTimer) this.fireTimer.paused = true;
    if (this.spawnTimer) this.spawnTimer.paused = true;

    // Stop zombie movement
    this.zombies.children.iterate((z) => {
      if (z && z.body) z.setVelocity(0, 0);
    });

    // Disable player movement
    this.player.setActive(false).setVisible(true).setVelocity(0, 0);

    // Pause the main gameplay scene to halt updates/physics
    this.scene.pause();

    // Emit event for UI scene
    this.events.emit('game-over', {
      coins: getState().coins,
      totalKills: getState().totalKills,
      runKills: this.runKills
    });
  }

  restartRun() {
    // Clear entities
    this.bullets.clear(true, true);
    this.zombies.clear(true, true);

    // Reset stats and timers
    this.stats = getComputedStats();
    this.hp = this.stats.maxHP;
    this.runKills = 0;
    this.gameOverFlag = false;

    // Reset difficulty to initial
    this.difficulty = {
      level: 0,
      spawnDelay: 1400,
      spawnCount: 1,
      zombieHpBase: 12,
      zombieHpRange: 8,
      zombieSpeedBase: 70,
      speedRange: 50,
      fastChance: 0.03,
      tankChance: 0.015
    };

    // Recreate timers
    if (this.fireTimer) this.fireTimer.paused = false;
    this.resetFireTimer();

    if (this.spawnTimer) this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.difficulty.spawnDelay,
      loop: true,
      callback: () => this.spawnZombie()
    });

    if (this.diffTimer) this.diffTimer.remove(false);
    this.diffTimer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: () => this.increaseDifficulty()
    });

    // Reset player position/state
    this.player.setActive(true).setVisible(true).setPosition(this.scale.width / 2, this.scale.height / 2);

    this.events.emit('hud-update', this.getHUDPayload());
  }

  // HUD payload
  getHUDPayload() {
    const s = this.stats;
    return {
      hp: this.hp,
      maxHP: s.maxHP,
      coins: getState().coins,
      kills: getState().totalKills,
      runKills: this.runKills,
      weapon: s.weapon,
      fireInterval: s.fireInterval
    };
  }

  // ----- Utility: generate placeholder textures -----
  createPlaceholderTextures() {
    // Player: simple triangle pointer
    const gPlayer = this.make.graphics({ x: 0, y: 0, add: false });
    gPlayer.fillStyle(0x419D78, 1);
    gPlayer.fillPoints(
      [
        new Phaser.Math.Vector2(16, 8),
        new Phaser.Math.Vector2(6, 14),
        new Phaser.Math.Vector2(6, 2)
      ],
      true
    );
    gPlayer.lineStyle(2, 0x1F2D3D, 1);
    gPlayer.strokeTriangle(16, 8, 6, 14, 6, 2);
    gPlayer.generateTexture('player', 20, 16);
    gPlayer.destroy();

    // Bullet: small rectangle
    const gBullet = this.make.graphics({ x: 0, y: 0, add: false });
    gBullet.fillStyle(0xD1495B, 1);
    gBullet.fillRect(0, 0, 8, 3);
    gBullet.generateTexture('bullet', 8, 3);
    gBullet.destroy();

    // Zombie: circle with eyes
    const gZombie = this.make.graphics({ x: 0, y: 0, add: false });
    gZombie.fillStyle(0x55aa55, 1);
    gZombie.fillCircle(12, 12, 12);
    gZombie.fillStyle(0x222222, 1);
    gZombie.fillCircle(8, 10, 2);
    gZombie.fillCircle(16, 10, 2);
    gZombie.generateTexture('zombie', 24, 24);
    gZombie.destroy();

    // Fast zombie: smaller, distinct color
    const gFast = this.make.graphics({ x: 0, y: 0, add: false });
    gFast.fillStyle(0x2AA1FF, 1);
    gFast.fillCircle(10, 10, 10);
    gFast.fillStyle(0x1F2D3D, 1);
    gFast.fillCircle(6, 8, 2);
    gFast.fillCircle(13, 8, 2);
    gFast.generateTexture('zombie_fast', 20, 20);
    gFast.destroy();

    // Tank zombie: larger, distinct color
    const gTank = this.make.graphics({ x: 0, y: 0, add: false });
    gTank.fillStyle(0xAA8844, 1);
    gTank.fillCircle(16, 16, 16);
    gTank.fillStyle(0x2A2A2A, 1);
    gTank.fillCircle(10, 14, 3);
    gTank.fillCircle(20, 14, 3);
    gTank.generateTexture('zombie_tank', 32, 32);
    gTank.destroy();

    // Massive zombie (easter egg): much larger, distinct color
    const gMass = this.make.graphics({ x: 0, y: 0, add: false });
    gMass.fillStyle(0x6A4C93, 1); // purple-ish
    gMass.fillCircle(22, 22, 22);
    gMass.fillStyle(0x2A2A2A, 1);
    gMass.fillCircle(14, 18, 4);
    gMass.fillCircle(30, 18, 4);
    gMass.generateTexture('zombie_massive', 44, 44);
    gMass.destroy();

    // Blood particle: red square
    const gBlood = this.make.graphics({ x: 0, y: 0, add: false });
    gBlood.fillStyle(0xaa2222, 1);
    gBlood.fillRect(0, 0, 4, 4);
    gBlood.generateTexture('blood', 4, 4);
    gBlood.destroy();

    // Grass tile
    const gGrass = this.make.graphics({ x: 0, y: 0, add: false });
    gGrass.fillStyle(0x0f140f, 1);
    gGrass.fillRect(0, 0, 32, 32);
    // random speckles
    gGrass.fillStyle(0x152015, 1);
    for (let i = 0; i < 40; i++) {
      gGrass.fillRect(Phaser.Math.Between(0, 31), Phaser.Math.Between(0, 31), 1, 1);
    }
    gGrass.generateTexture('grass', 32, 32);
    gGrass.destroy();
  }

  // ----- Simple WebAudio tones (no external assets) -----
  playTone(freq = 440, durationMs = 80, volume = 0.05, type = 'sine', cutoffHz = null) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = this.sound.context || (this.sound && this.sound.audioContext) || (AudioCtx ? new AudioCtx() : null);
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      let nodeChain = osc;

      osc.type = type;
      osc.frequency.value = freq;

      // Optional softening filter
      if (cutoffHz) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoffHz;
        nodeChain.connect(filter);
        nodeChain = filter;
      }

      // Envelope
      gain.gain.value = 0;
      nodeChain.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      const dur = durationMs / 1000;

      // Attack/decay envelope for softer tones
      const attack = Math.min(0.01, dur * 0.2);
      const decayStart = now + attack;
      const releaseStart = now + Math.max(0, dur - 0.02);

      osc.start(now);
      gain.gain.linearRampToValueAtTime(volume, decayStart);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.35), releaseStart);
      osc.stop(now + dur);
    } catch {
      // ignore
    }
  }

  // Softer shot sound: triangle wave, slightly randomized pitch, gentle lowpass
  playShot() {
    try {
      const base = 500 + (Math.random() * 40 - 20); // slight pitch variance
      this.playTone(base, 70, 0.03, 'triangle', 1500);
    } catch {
      // ignore
    }
  }

  // Difficulty announcement sound: short two-tone chime
  playMakeItHarderSfx() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = this.sound.context || (this.sound && this.sound.audioContext) || (AudioCtx ? new AudioCtx() : null);
      if (!ctx) return;

      const play = (freq, startOffsetMs, durMs, vol) => {
        const now = ctx.currentTime + startOffsetMs / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // mild filter for pleasant tone
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;

        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = 0;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        const dur = durMs / 1000;
        const attack = Math.min(0.015, dur * 0.3);
        const decayStart = now + attack;
        const releaseStart = now + Math.max(0, dur - 0.03);

        osc.start(now);
        gain.gain.linearRampToValueAtTime(vol, decayStart);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.4), releaseStart);
        osc.stop(now + dur);
      };

      // two-note chime
      play(740, 0, 140, 0.035);   // F#5
      play(880, 120, 160, 0.03);  // A5
    } catch {
      // ignore
    }
  }

  // Satisfying hit impact: quick thump + click
  playHitImpact() {
    try {
      // low thump
      this.playTone(320 + (Math.random()*20-10), 60, 0.035, 'triangle', 1200);
      // high click shortly after
      this.playTone(950 + (Math.random()*30-15), 40, 0.025, 'sine', 2000);
    } catch {
      // ignore
    }
  }

  // Satisfying kill impact: deeper thump + subtle second tone
  playKillImpact() {
    try {
      this.playTone(220 + (Math.random()*20-10), 90, 0.04, 'triangle', 1000);
      this.playTone(520, 70, 0.02, 'sine', 1800);
    } catch {
      // ignore
    }
  }
}
