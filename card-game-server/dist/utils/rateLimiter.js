const DEFAULT_CONFIG = {
    maxTokens: 20,
    refillRate: 5,
    violationThreshold: 3,
    violationWindowMs: 60_000,
};
export class RateLimiter {
    tokens;
    lastRefill;
    violations = [];
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.tokens = this.config.maxTokens;
        this.lastRefill = Date.now();
    }
    consume() {
        this.refill();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return true;
        }
        this.violations.push(Date.now());
        return false;
    }
    shouldDisconnect() {
        const now = Date.now();
        this.violations = this.violations.filter((t) => now - t < this.config.violationWindowMs);
        return this.violations.length >= this.config.violationThreshold;
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.config.maxTokens, this.tokens + elapsed * this.config.refillRate);
        this.lastRefill = now;
    }
}
//# sourceMappingURL=rateLimiter.js.map