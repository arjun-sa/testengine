export interface RateLimiterConfig {
  maxTokens: number;    // burst capacity
  refillRate: number;   // tokens per second
  violationThreshold: number;  // violations before disconnect
  violationWindowMs: number;   // window to count violations
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxTokens: 20,
  refillRate: 5,
  violationThreshold: 3,
  violationWindowMs: 60_000,
};

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private violations: number[] = [];
  private config: RateLimiterConfig;

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    this.violations.push(Date.now());
    return false;
  }

  shouldDisconnect(): boolean {
    const now = Date.now();
    this.violations = this.violations.filter(
      (t) => now - t < this.config.violationWindowMs
    );
    return this.violations.length >= this.config.violationThreshold;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.config.maxTokens,
      this.tokens + elapsed * this.config.refillRate
    );
    this.lastRefill = now;
  }
}
