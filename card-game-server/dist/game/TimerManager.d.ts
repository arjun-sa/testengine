export declare class TimerManager {
    private interval;
    private currentTimer;
    start(durationSeconds: number, onTick: (remaining: number) => void, onExpired: () => void): void;
    stop(): void;
    getRemaining(): number;
}
//# sourceMappingURL=TimerManager.d.ts.map