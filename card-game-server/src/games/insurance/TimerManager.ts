import { logger } from '../../utils/logger.js';

export class TimerManager {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentTimer = 0;
  private paused = false;
  private onTickFn: ((remaining: number) => void) | null = null;
  private onExpiredFn: (() => void) | null = null;

  start(
    durationSeconds: number,
    onTick: (remaining: number) => void,
    onExpired: () => void
  ): void {
    this.stop();
    this.currentTimer = durationSeconds;
    this.onTickFn = onTick;
    this.onExpiredFn = onExpired;
    this.paused = false;

    this.startInterval();
    logger.debug({ duration: durationSeconds }, 'Timer started');
  }

  private startInterval(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.paused) return;

      this.currentTimer--;
      if (this.onTickFn) this.onTickFn(this.currentTimer);

      if (this.currentTimer <= 0) {
        const expired = this.onExpiredFn;
        this.stop();
        if (expired) expired();
      }
    }, 1000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.onTickFn = null;
    this.onExpiredFn = null;
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  getRemaining(): number {
    return this.currentTimer;
  }
}
