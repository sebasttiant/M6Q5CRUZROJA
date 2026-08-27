import { describe, expect, it } from "vitest";
import { createUserSchema, passwordSchema, setUserActiveSchema } from "@/features/users/schema";
import { loginSchema } from "@/features/auth/schema";

describe("user management schemas", () => {
  it("normalizes email and accepts manageable roles", () => {
    const result = createUserSchema.parse({ email: "  Person@Example.ORG ", password: "a-secure-passphrase", role: "ADMIN" });
    expect(result.email).toBe("person@example.org");
  });

  it("never accepts SUPERADMIN creation", () => {
    expect(createUserSchema.safeParse({ email: "person@example.org", password: "a-secure-passphrase", role: "SUPERADMIN" }).success).toBe(false);
  });

  it("requires passwords of at least twelve characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("twelve-chars").success).toBe(true);
  });

  it("parses activation explicitly instead of coercing arbitrary values", () => {
    expect(setUserActiveSchema.parse({ id: "cm12345678901234567890123", active: "false" }).active).toBe(false);
    expect(setUserActiveSchema.safeParse({ id: "cm12345678901234567890123", active: "yes" }).success).toBe(false);
  });

  it("validates and normalizes login input on the server", () => {
    expect(loginSchema.parse({ email: " PERSON@EXAMPLE.ORG ", password: "valid-input" }).email).toBe("person@example.org");
    expect(loginSchema.safeParse({ email: "invalid", password: "valid-input" }).success).toBe(false);
  });
});
