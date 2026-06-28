// Minimal typed wrapper around the Telegram WebApp SDK.
// The game also runs fine in a normal browser (all calls are no-ops there).

interface TgHaptic {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
}

interface TgCloudStorage {
  setItem(key: string, value: string, cb?: (err: unknown, ok?: boolean) => void): void;
  getItem(key: string, cb: (err: unknown, value?: string) => void): void;
}

interface TgWebApp {
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  disableVerticalSwipes?(): void;
  requestFullscreen?(): void;
  HapticFeedback?: TgHaptic;
  CloudStorage?: TgCloudStorage;
}

function tg(): TgWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

/** Call once on startup to set up the Mini App chrome. */
export function initTelegram(bgColor: string): void {
  const app = tg();
  if (!app) return;
  app.ready();
  app.expand();
  app.setBackgroundColor(bgColor);
  app.setHeaderColor(bgColor);
  // Stop the swipe-to-close gesture from firing while the player drags.
  app.disableVerticalSwipes?.();
}

export function hapticHit(): void {
  tg()?.HapticFeedback?.impactOccurred('light');
}

export function hapticHurt(): void {
  tg()?.HapticFeedback?.notificationOccurred('error');
}

const HISCORE_KEY = 'hiscore';

/** Persist the high score in Telegram CloudStorage (falls back to localStorage). */
export function saveHiScore(score: number): void {
  const app = tg();
  if (app?.CloudStorage) {
    app.CloudStorage.setItem(HISCORE_KEY, String(score));
  } else {
    try {
      localStorage.setItem(HISCORE_KEY, String(score));
    } catch {
      /* ignore */
    }
  }
}

export function loadHiScore(cb: (score: number) => void): void {
  const app = tg();
  if (app?.CloudStorage) {
    app.CloudStorage.getItem(HISCORE_KEY, (_err, value) => cb(Number(value) || 0));
  } else {
    let v = 0;
    try {
      v = Number(localStorage.getItem(HISCORE_KEY)) || 0;
    } catch {
      /* ignore */
    }
    cb(v);
  }
}
