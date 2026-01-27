/**
 * Token Bucket Rate Limiter
 * Prevents exceeding LLM API RPM limits
 */

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private rpm: number,        // Requests per minute
    private burst: number        // Burst capacity (allow short bursts)
  ) {
    this.tokens = burst;
    this.lastRefill = Date.now();
  }

  /**
   * Wait for an available token (blocking)
   * Throws if wait time exceeds timeout
   */
  async waitForSlot(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.tokens < 1) {
      this.refill();

      if (this.tokens < 1) {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(`Rate limiter timeout after ${timeoutMs}ms`);
        }

        // Wait 100ms before retry
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.tokens--;
  }

  /**
   * Refill tokens based on elapsed time
   * Tokens are discrete (integers), so we floor the result
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    const elapsedMinutes = elapsedMs / 60000;

    // Calculate tokens to add (floor to get integer count)
    const tokensToAdd = Math.floor(elapsedMinutes * this.rpm);

    if (tokensToAdd > 0) {
      // Refill up to burst capacity
      this.tokens = Math.min(this.burst, this.tokens + tokensToAdd);
      // Only update lastRefill when we actually add tokens
      // Calculate how much time was consumed for the added tokens
      const timeConsumedMs = (tokensToAdd / this.rpm) * 60000;
      this.lastRefill += timeConsumedMs;
    }
  }

  /**
   * Get current available tokens (for monitoring)
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
