import Phaser from 'phaser';
import { GAME } from '../config';

/**
 * Generates all textures procedurally so the game needs no external assets.
 * Theme: New York City at night (Times Square neon).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.makeSkyTexture();
    this.makeSkylineTexture();
    this.makeTaxiTexture();
    this.makePigeonTexture();
    this.makeBulletTexture('bullet', 0xfff2b0); // headlight beam
    this.makeBulletTexture('enemyBullet', 0xb9c2cf); // pigeon dropping
    this.makeStarTexture();
    this.makeSnowTexture();

    this.scene.start('GameScene');
  }

  /** Vertical night-sky gradient: deep navy at top, purple light-pollution glow near the horizon. */
  private makeSkyTexture(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x070b1f, 0x070b1f, 0x2a1747, 0x3a1f3f, 1);
    g.fillRect(0, 0, GAME.width, GAME.height);
    g.generateTexture('sky', GAME.width, GAME.height);
    g.destroy();
  }

  /**
   * Skyline silhouette with lit windows and a few neon billboards.
   * Drawn once into a single texture placed at the bottom of the scene.
   */
  private makeSkylineTexture(): void {
    const h = 300;
    const g = this.add.graphics();
    const rnd = new Phaser.Math.RandomDataGenerator(['nyc-skyline']);

    // Buildings across the width, varying heights.
    let x = -10;
    while (x < GAME.width + 10) {
      const w = rnd.between(34, 64);
      const bh = rnd.between(120, 260);
      const top = h - bh;
      g.fillStyle(0x0c1124, 1);
      g.fillRect(x, top, w, bh);

      // Lit windows grid.
      for (let wy = top + 8; wy < h - 6; wy += 12) {
        for (let wx = x + 5; wx < x + w - 5; wx += 11) {
          if (rnd.frac() < 0.55) {
            const warm = rnd.frac() < 0.8;
            g.fillStyle(warm ? 0xffd98c : 0x9fd0ff, rnd.between(60, 100) / 100);
            g.fillRect(wx, wy, 5, 6);
          }
        }
      }
      x += w + rnd.between(2, 10);
    }

    // Landmark spire (Empire State-ish) near center.
    const sx = GAME.width / 2;
    g.fillStyle(0x0c1124, 1);
    g.fillRect(sx - 22, h - 285, 44, 285);
    g.fillRect(sx - 12, h - 320, 24, 40);
    g.fillRect(sx - 3, h - 345, 6, 30);
    g.fillStyle(0xffe39a, 1);
    g.fillCircle(sx, h - 347, 3);

    // Neon billboards (Times Square pops of colour).
    const neon = [0xff2d95, 0x00e5ff, 0xffb300, 0x7cff5a];
    for (let i = 0; i < 6; i++) {
      const bx = rnd.between(10, GAME.width - 50);
      const by = rnd.between(60, 200);
      g.fillStyle(neon[i % neon.length], 0.85);
      g.fillRoundedRect(bx, by, rnd.between(20, 40), rnd.between(12, 22), 3);
    }

    g.generateTexture('skyline', GAME.width, h);
    g.destroy();
  }

  /** Top-down NYC yellow cab (player). */
  private makeTaxiTexture(): void {
    const g = this.add.graphics();
    // Body
    g.fillStyle(0xffd400, 1);
    g.fillRoundedRect(4, 2, 24, 36, 6);
    // Windshield (front, pointing up)
    g.fillStyle(0x16202e, 1);
    g.fillRoundedRect(8, 6, 16, 8, 3);
    // Rear window
    g.fillRoundedRect(8, 26, 16, 8, 3);
    // Checker stripe
    g.fillStyle(0x111111, 1);
    for (let i = 0; i < 5; i++) {
      g.fillRect(6 + i * 4, 18, 2, 4);
    }
    // Roof TAXI light
    g.fillStyle(0xfff3b0, 1);
    g.fillRoundedRect(12, 16, 8, 4, 1);
    // Headlights (front)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 4, 2);
    g.fillCircle(24, 4, 2);
    g.generateTexture('player', 32, 40);
    g.destroy();
  }

  /** Pigeon enemy (descending flock). */
  private makePigeonTexture(): void {
    const g = this.add.graphics();
    // Body
    g.fillStyle(0x8a93a3, 1);
    g.fillEllipse(16, 16, 24, 16);
    // Wings
    g.fillStyle(0x6b7382, 1);
    g.fillTriangle(4, 10, 2, 22, 14, 16);
    g.fillTriangle(28, 10, 30, 22, 18, 16);
    // Head
    g.fillStyle(0x9aa3b3, 1);
    g.fillCircle(16, 9, 6);
    // Eyes
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(13, 8, 1.4);
    g.fillCircle(19, 8, 1.4);
    // Beak
    g.fillStyle(0xff9f43, 1);
    g.fillTriangle(15, 11, 17, 11, 16, 15);
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

  private makeSnowTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('snow', 6, 6);
    g.destroy();
  }
}
