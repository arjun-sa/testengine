import { logger } from '../utils/logger.js';

export class TimerManager {
  private interval: ReturnType<typeof setInterval> | null = null;
  private currentTimer = 0;

  start(
    durationSeconds: number,
    onTick: (remaining: number) => void,
    onExpired: () => void
  ): void {
    this.stop();
    this.currentTimer = durationSeconds;

    this.interval = setInterval(() => {
      this.currentTimer--;
      onTick(this.currentTimer);

      if (this.currentTimer <= 0) {
        this.stop();
        onExpired();
      }
    }, 1000);

    logger.debug({ duration: durationSeconds }, 'Timer started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getRemaining(): number {
    return this.currentTimer;
  }
}
