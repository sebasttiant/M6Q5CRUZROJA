export interface RateLimitWindow {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Sliding window counter held in process memory. It protects the public report form from
 * casual scripted abuse; it is not shared across replicas and does not survive a restart.
 */
const attempts = new Map<string, number[]>();

/** Keeps the map from growing without bound when many distinct keys go quiet. */
const MAX_TRACKED_KEYS = 10_000;

export function consumeRateLimit(key: string, window: RateLimitWindow, now: number = Date.now()): RateLimitResult {
  const since = now - window.windowMs;
  const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > since);

  if (recent.length >= window.limit) {
    const oldest = recent[0];
    attempts.set(key, recent);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + window.windowMs - now) / 1000)) };
  }

  recent.push(now);
  if (!attempts.has(key) && attempts.size >= MAX_TRACKED_KEYS) pruneEmptyKeys(since);
  attempts.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

function pruneEmptyKeys(since: number): void {
  for (const [key, timestamps] of attempts) {
    if (timestamps.every((timestamp) => timestamp <= since)) attempts.delete(key);
  }
}

export function resetRateLimits(): void {
  attempts.clear();
}
