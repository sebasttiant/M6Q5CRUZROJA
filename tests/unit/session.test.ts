import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const NOW = Date.UTC(2026, 7, 26, 12, 0, 0);

describe("session tokens", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  });

  it("accepts a signed token during its 12-hour lifetime", () => {
    const token = createSessionToken("user-1", NOW);
    expect(verifySessionToken(token, NOW + (12 * 60 * 60 * 1000) - 1_000)).toBe("user-1");
  });

  it("rejects a token at expiration", () => {
    const token = createSessionToken("user-1", NOW);
    expect(verifySessionToken(token, NOW + (12 * 60 * 60 * 1000))).toBeNull();
  });

  it("invalidates legacy tokens without signed timestamps", () => {
    expect(verifySessionToken("user-1.legacy-signature", NOW)).toBeNull();
  });

  it("rejects tampered expiration timestamps", () => {
    const token = createSessionToken("user-1", NOW);
    const parts = token.split(".");
    parts[3] = String(Number(parts[3]) + 60 * 60);
    expect(verifySessionToken(parts.join("."), NOW)).toBeNull();
  });
});
