import { logger } from '../utils/logger.js';
export class TimerManager {
    interval = null;
    currentTimer = 0;
    start(durationSeconds, onTick, onExpired) {
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
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    getRemaining() {
        return this.currentTimer;
    }
}
//# sourceMappingURL=TimerManager.js.map