export interface RateLimiterConfig {
    maxTokens: number;
    refillRate: number;
    violationThreshold: number;
    violationWindowMs: number;
}
export declare class RateLimiter {
    private tokens;
    private lastRefill;
    private violations;
    private config;
    constructor(config?: Partial<RateLimiterConfig>);
    consume(): boolean;
    shouldDisconnect(): boolean;
    private refill;
}
//# sourceMappingURL=rateLimiter.d.ts.map