import { describe, expect, it } from "vitest";
import { analysisScope, canAccessAnalysis, canManageUsers, USER_ROLE } from "@/lib/auth/authorization";

describe("role authorization", () => {
  it("allows only the superadministrator to manage users", () => {
    expect(canManageUsers({ id: "super", role: USER_ROLE.SUPERADMIN })).toBe(true);
    expect(canManageUsers({ id: "admin", role: USER_ROLE.ADMIN })).toBe(false);
    expect(canManageUsers({ id: "user", role: USER_ROLE.USER })).toBe(false);
  });

  it("limits regular users to their own analyses", () => {
    const user = { id: "user-1", role: USER_ROLE.USER };
    expect(analysisScope(user)).toEqual({ creatorId: "user-1" });
    expect(canAccessAnalysis(user, "user-1")).toBe(true);
    expect(canAccessAnalysis(user, "user-2")).toBe(false);
    expect(canAccessAnalysis(user, null)).toBe(false);
  });

  it("gives operational roles institution-wide analysis access", () => {
    expect(analysisScope({ id: "admin", role: USER_ROLE.ADMIN })).toEqual({});
    expect(canAccessAnalysis({ id: "admin", role: USER_ROLE.ADMIN }, null)).toBe(true);
  });
});
