import Phaser from 'phaser';

/**
 * Generates all textures procedurally so the game needs no external assets.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.makePlayerTexture();
    this.makeEnemyTexture();
    this.makeBulletTexture('bullet', 0x6fd3ff);
    this.makeBulletTexture('enemyBullet', 0xff6b6b);
    this.makeStarTexture();

    this.scene.start('GameScene');
  }

  private makePlayerTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0x5ad1ff, 1);
    g.fillTriangle(16, 0, 0, 32, 32, 32);
    g.fillStyle(0xffffff, 1);
    g.fillRect(13, 18, 6, 10);
    g.generateTexture('player', 32, 32);
    g.destroy();
  }

  private makeEnemyTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xff7ad9, 1);
    g.fillRect(2, 8, 28, 16);
    g.fillRect(8, 2, 16, 10);
    g.fillStyle(0x2a0a2a, 1);
    g.fillRect(9, 12, 5, 5);
    g.fillRect(18, 12, 5, 5);
    g.generateTexture('enemy', 32, 28);
    g.destroy();
  }

  private makeBulletTexture(key: string, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, 4, 14, 2);
    g.generateTexture(key, 4, 14);
    g.destroy();
  }

  private makeStarTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('star', 4, 4);
    g.destroy();
  }
}
