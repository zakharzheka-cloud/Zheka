import Phaser from 'phaser';
import { GAME, PLAYER, BULLET, ENEMY } from '../config';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Image;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private stars!: Phaser.GameObjects.Group;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private fireKey!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;

  private pointerActive = false;
  private pointerTargetX = 0;

  private lastFired = 0;
  private enemyDir = 1;
  private score = 0;
  private lives = PLAYER.startLives;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.score = 0;
    this.lives = PLAYER.startLives;
    this.enemyDir = 1;
    this.lastFired = 0;

    // NYC backdrop: night sky + skyline silhouette anchored to the street.
    this.add.image(GAME.width / 2, GAME.height / 2, 'sky').setDepth(-20);
    this.add.image(GAME.width / 2, GAME.height, 'skyline').setOrigin(0.5, 1).setDepth(-10);

    this.createStarfield();

    this.player = this.physics.add.image(GAME.width / 2, GAME.height - 60, 'player');
    this.player.setCollideWorldBounds(true);

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 40 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 60 });
    this.enemies = this.physics.add.group();
    this.spawnWave();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.scoreText = this.add
      .text(12, 10, 'SCORE 0', { fontFamily: 'monospace', fontSize: '18px', color: '#9fe0ff' })
      .setDepth(10);
    this.livesText = this.add
      .text(GAME.width - 12, 10, `LIVES ${this.lives}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ff9fb0',
      })
      .setOrigin(1, 0)
      .setDepth(10);

    this.setupTouchControls();
    this.showStartHint();

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.onPlayerHit, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.onPlayerHit, undefined, this);
  }

  // Touch: drag finger to move the ship; it auto-fires while held.
  private setupTouchControls(): void {
    this.pointerActive = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerActive = true;
      this.pointerTargetX = p.x;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.pointerTargetX = p.x;
    });
    this.input.on('pointerup', () => {
      this.pointerActive = false;
    });
  }

  // Fading hint so players know how to control the ship.
  private showStartHint(): void {
    const hint = this.add
      .text(GAME.width / 2, GAME.height - 130, 'Веди пальцем — корабель стріляє сам', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.tweens.add({ targets: hint, alpha: 0, delay: 2500, duration: 1200 });
  }

  update(time: number, delta: number): void {
    this.updateStarfield(delta);
    this.handlePlayerMovement();
    this.handleShooting(time);
    this.updateEnemies();
    this.updateEnemyFire();
    this.cullBullets();
  }

  // --- Player ---

  private handlePlayerMovement(): void {
    const left = this.cursors.left?.isDown || this.keyA.isDown;
    const right = this.cursors.right?.isDown || this.keyD.isDown;
    if (this.pointerActive) {
      // Follow the finger horizontally.
      const dx = this.pointerTargetX - this.player.x;
      if (Math.abs(dx) < 4) {
        this.player.setVelocityX(0);
      } else {
        this.player.setVelocityX(Phaser.Math.Clamp(dx * 12, -PLAYER.speed, PLAYER.speed));
      }
    } else if (left) {
      this.player.setVelocityX(-PLAYER.speed);
    } else if (right) {
      this.player.setVelocityX(PLAYER.speed);
    } else {
      this.player.setVelocityX(0);
    }
  }

  private handleShooting(time: number): void {
    const wantsToFire = this.fireKey.isDown || this.cursors.up?.isDown || this.pointerActive;
    if (wantsToFire && time > this.lastFired) {
      const bullet = this.bullets.get(this.player.x, this.player.y - 20) as
        | Phaser.Physics.Arcade.Image
        | null;
      if (bullet) {
        bullet.setActive(true).setVisible(true);
        bullet.setVelocityY(-BULLET.speed);
        this.lastFired = time + PLAYER.fireDelay;
      }
    }
  }

  // --- Enemies ---

  private spawnWave(): void {
    const totalWidth = (ENEMY.cols - 1) * ENEMY.hSpacing;
    const startX = (GAME.width - totalWidth) / 2;
    for (let row = 0; row < ENEMY.rows; row++) {
      for (let col = 0; col < ENEMY.cols; col++) {
        const x = startX + col * ENEMY.hSpacing;
        const y = ENEMY.marginTop + row * ENEMY.vSpacing;
        const enemy = this.enemies.create(x, y, 'enemy') as Phaser.Physics.Arcade.Image;
        enemy.setData('alive', true);
      }
    }
  }

  private updateEnemies(): void {
    const live = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    if (live.length === 0) {
      this.spawnWave();
      return;
    }

    let hitEdge = false;
    for (const e of live) {
      e.x += ENEMY.speedX * this.enemyDir * (1 / 60);
      if (e.x <= 16 || e.x >= GAME.width - 16) {
        hitEdge = true;
      }
    }
    if (hitEdge) {
      this.enemyDir *= -1;
      for (const e of live) {
        e.y += ENEMY.stepDown;
        if (e.y >= GAME.height - 90) {
          this.endGame();
          return;
        }
      }
    }
  }

  private updateEnemyFire(): void {
    const live = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    for (const e of live) {
      if (Math.random() < ENEMY.fireChance) {
        const b = this.enemyBullets.get(e.x, e.y + 16) as Phaser.Physics.Arcade.Image | null;
        if (b) {
          b.setActive(true).setVisible(true);
          b.setVelocityY(ENEMY.bulletSpeed);
        }
      }
    }
  }

  // --- Collisions ---

  private onBulletHitsEnemy: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bullet, enemy) => {
    const b = bullet as Phaser.Physics.Arcade.Image;
    const e = enemy as Phaser.Physics.Arcade.Image;
    this.killBullet(b);
    e.destroy();
    this.score += ENEMY.scorePerKill;
    this.scoreText.setText(`SCORE ${this.score}`);
    this.spawnExplosion(e.x, e.y);
  };

  private onPlayerHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, other) => {
    const o = other as Phaser.Physics.Arcade.Image;
    if (o.texture.key === 'enemyBullet') {
      this.killBullet(o);
    } else {
      o.destroy();
    }
    this.lives -= 1;
    this.livesText.setText(`LIVES ${Math.max(this.lives, 0)}`);
    this.cameras.main.shake(150, 0.01);
    this.spawnExplosion(this.player.x, this.player.y);
    if (this.lives <= 0) {
      this.endGame();
    }
  };

  // --- Helpers ---

  private killBullet(b: Phaser.Physics.Arcade.Image): void {
    b.setActive(false).setVisible(false);
    b.body!.stop();
    b.setPosition(-50, -50);
  }

  private cullBullets(): void {
    (this.bullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((b) => {
      if (b.active && b.y < -20) this.killBullet(b);
    });
    (this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[]).forEach((b) => {
      if (b.active && b.y > GAME.height + 20) this.killBullet(b);
    });
  }

  private spawnExplosion(x: number, y: number): void {
    const particles = this.add.particles(x, y, 'star', {
      speed: { min: 40, max: 160 },
      lifespan: 400,
      quantity: 12,
      scale: { start: 1.5, end: 0 },
      tint: [0xffffff, 0x9aa3b3, 0x6b7382], // feathers + steam
    });
    this.time.delayedCall(450, () => particles.destroy());
  }

  private endGame(): void {
    this.scene.start('GameOverScene', { score: this.score });
  }

  // --- Background ---

  // Falling snow over the city (replaces the old starfield).
  private createStarfield(): void {
    this.stars = this.add.group();
    for (let i = 0; i < 70; i++) {
      const flake = this.add.image(
        Phaser.Math.Between(0, GAME.width),
        Phaser.Math.Between(0, GAME.height),
        'snow',
      );
      flake.setDepth(-5);
      const scale = Phaser.Math.FloatBetween(0.4, 1.1);
      flake.setScale(scale);
      flake.setAlpha(Phaser.Math.FloatBetween(0.4, 0.9));
      flake.setData('speed', 30 + scale * 60);
      flake.setData('sway', Phaser.Math.FloatBetween(0.5, 1.5));
      flake.setData('phase', Phaser.Math.FloatBetween(0, Math.PI * 2));
      this.stars.add(flake);
    }
  }

  private updateStarfield(delta: number): void {
    const t = this.time.now / 1000;
    (this.stars.getChildren() as Phaser.GameObjects.Image[]).forEach((flake) => {
      flake.y += (flake.getData('speed') as number) * (delta / 1000);
      const sway = flake.getData('sway') as number;
      const phase = flake.getData('phase') as number;
      flake.x += Math.cos(t * sway + phase) * 0.4;
      if (flake.y > GAME.height) {
        flake.y = -4;
        flake.x = Phaser.Math.Between(0, GAME.width);
      }
    });
  }
}
