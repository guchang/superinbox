import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '@/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow first request immediately', async () => {
    const limiter = new RateLimiter(60, 5);
    const start = Date.now();
    await limiter.waitForSlot();
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('should exhaust burst capacity', async () => {
    const limiter = new RateLimiter(60, 2); // 60 RPM = 1 token per second, burst 2

    // First 2 should succeed immediately
    await limiter.waitForSlot();
    await limiter.waitForSlot();

    // 3rd should be rate limited - wait for next token
    const start = Date.now();
    await limiter.waitForSlot();
    const elapsed = Date.now() - start;

    // Should wait at least 900ms (1 second for next token at 60 RPM)
    expect(elapsed).toBeGreaterThan(900);
  });

  it('should refill tokens over time', async () => {
    const limiter = new RateLimiter(60, 2); // 1 token per second (60/60)

    // Exhaust burst
    await limiter.waitForSlot();
    await limiter.waitForSlot();

    // Wait for refill
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should have new token available
    const start = Date.now();
    await limiter.waitForSlot();
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('should throw on timeout', async () => {
    const limiter = new RateLimiter(60, 1); // Only 1 burst token

    // Exhaust token
    await limiter.waitForSlot();

    // Next request should timeout quickly
    await expect(
      limiter.waitForSlot(100) // 100ms timeout
    ).rejects.toThrow('Rate limiter timeout');
  });

  it('should return available tokens for monitoring', () => {
    const limiter = new RateLimiter(60, 10);
    const tokens = limiter.getAvailableTokens();
    expect(tokens).toBe(10);
  });

  it('should handle multiple rapid requests', async () => {
    const limiter = new RateLimiter(60, 3); // 3 burst tokens

    // Use all burst tokens
    const promises = [
      limiter.waitForSlot(),
      limiter.waitForSlot(),
      limiter.waitForSlot()
    ];

    await Promise.all(promises);

    // Should be exhausted now
    const tokens = limiter.getAvailableTokens();
    expect(tokens).toBeLessThan(1);
  });
});
