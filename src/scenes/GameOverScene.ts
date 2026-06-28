import Phaser from 'phaser';
import { GAME } from '../config';

interface GameOverData {
  score: number;
}

export class GameOverScene extends Phaser.Scene {
  private finalScore = 0;

  constructor() {
    super('GameOverScene');
  }

  init(data: GameOverData): void {
    this.finalScore = data.score ?? 0;
  }

  create(): void {
    const cx = GAME.width / 2;

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
