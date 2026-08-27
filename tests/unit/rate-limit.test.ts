import { beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit, resetRateLimits } from "@/lib/rate-limit";

const WINDOW = { limit: 3, windowMs: 60_000 };

describe("consumeRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows attempts up to the limit", () => {
    for (let attempt = 1; attempt <= WINDOW.limit; attempt += 1) {
      expect(consumeRateLimit("1.2.3.4", WINDOW, 0).allowed).toBe(true);
    }
  });

  it("blocks the attempt right after the limit", () => {
    for (let attempt = 1; attempt <= WINDOW.limit; attempt += 1) consumeRateLimit("1.2.3.4", WINDOW, 0);
    expect(consumeRateLimit("1.2.3.4", WINDOW, 0).allowed).toBe(false);
  });

  it("reports how long the caller has to wait", () => {
    for (let attempt = 1; attempt <= WINDOW.limit; attempt += 1) consumeRateLimit("1.2.3.4", WINDOW, 0);
    expect(consumeRateLimit("1.2.3.4", WINDOW, 15_000).retryAfterSeconds).toBe(45);
  });

  it("keeps separate budgets per key", () => {
    for (let attempt = 1; attempt <= WINDOW.limit; attempt += 1) consumeRateLimit("1.2.3.4", WINDOW, 0);
    expect(consumeRateLimit("5.6.7.8", WINDOW, 0).allowed).toBe(true);
  });

  it("lets the window slide so old attempts stop counting", () => {
    for (let attempt = 1; attempt <= WINDOW.limit; attempt += 1) consumeRateLimit("1.2.3.4", WINDOW, 0);
    expect(consumeRateLimit("1.2.3.4", WINDOW, WINDOW.windowMs).allowed).toBe(true);
  });

  it("frees only the attempts that already left the window", () => {
    consumeRateLimit("1.2.3.4", WINDOW, 0);
    consumeRateLimit("1.2.3.4", WINDOW, 30_000);
    consumeRateLimit("1.2.3.4", WINDOW, 40_000);
    // At 60s only the first attempt expired, so exactly one slot is free.
    expect(consumeRateLimit("1.2.3.4", WINDOW, 60_000).allowed).toBe(true);
    expect(consumeRateLimit("1.2.3.4", WINDOW, 60_000).allowed).toBe(false);
  });
});
