export const GAME = {
  width: 480,
  height: 720,
  backgroundColor: '#0b0f1a',
} as const;

export const PLAYER = {
  speed: 320,
  fireDelay: 280, // ms between shots
  startLives: 3,
} as const;

export const BULLET = {
  speed: 520,
} as const;

export const ENEMY = {
  rows: 4,
  cols: 7,
  hSpacing: 56,
  vSpacing: 48,
  marginTop: 80,
  speedX: 40, // horizontal drift
  stepDown: 24, // descend on edge hit
  fireChance: 0.0008, // per enemy per frame
  bulletSpeed: 240,
  scorePerKill: 10,
} as const;
