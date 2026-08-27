import { beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

const NOW = Date.UTC(2026, 7, 26, 12, 0, 0);

describe("session tokens", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  });

  it("accepts a signed token during its 12-hour lifetime", () => {
    const token = createSessionToken("user-1", 3, NOW);
    expect(verifySessionToken(token, NOW + (12 * 60 * 60 * 1000) - 1_000)).toEqual({ userId: "user-1", sessionVersion: 3 });
  });

  it("rejects a token at expiration", () => {
    const token = createSessionToken("user-1", 3, NOW);
    expect(verifySessionToken(token, NOW + (12 * 60 * 60 * 1000))).toBeNull();
  });

  it("rejects legacy tokens without a session version", () => {
    expect(verifySessionToken("v1.dXNlci0x.1787745600.1787788800.invalid", NOW)).toBeNull();
    expect(verifySessionToken("user-1.legacy-signature", NOW)).toBeNull();
  });

  it("rejects tampered expiration timestamps", () => {
    const token = createSessionToken("user-1", 3, NOW);
    const parts = token.split(".");
    parts[4] = String(Number(parts[4]) + 60 * 60);
    expect(verifySessionToken(parts.join("."), NOW)).toBeNull();
  });

  it("rejects tampered session versions", () => {
    const token = createSessionToken("user-1", 3, NOW);
    const parts = token.split(".");
    parts[2] = "4";
    expect(verifySessionToken(parts.join("."), NOW)).toBeNull();
  });
});
