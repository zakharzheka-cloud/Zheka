import Phaser from 'phaser';
import { GAME } from '../config';

interface GameOverData {
  score: number;
  best: number;
}

export class GameOverScene extends Phaser.Scene {
  private finalScore = 0;
  private bestScore = 0;

  constructor() {
    super('GameOverScene');
  }

  init(data: GameOverData): void {
    this.finalScore = data.score ?? 0;
    this.bestScore = data.best ?? 0;
  }

  create(): void {
    const cx = GAME.width / 2;

    this.add.image(cx, GAME.height / 2, 'sky').setDepth(-20);
    this.add.image(cx, GAME.height, 'skyline').setOrigin(0.5, 1).setDepth(-10).setAlpha(0.85);

    this.add
      .text(cx, GAME.height / 2 - 80, 'GAME OVER', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME.height / 2, `SCORE  ${this.finalScore}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#9fe0ff',
      })
      .setOrigin(0.5);

    const isRecord = this.finalScore >= this.bestScore && this.finalScore > 0;
    this.add
      .text(cx, GAME.height / 2 + 34, isRecord ? '★ NEW BEST ★' : `BEST  ${this.bestScore}`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: isRecord ? '#ffd400' : '#ffd98c',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, GAME.height / 2 + 80, 'Press SPACE to restart', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
