import type { Prisma, UserRole } from "@prisma/client";

export const USER_ROLE = {
  SUPERADMIN: "SUPERADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
} as const satisfies Record<UserRole, UserRole>;

export interface AuthorizedUser {
  id: string;
  role: UserRole;
}

export function canManageUsers(user: AuthorizedUser): boolean {
  return user.role === USER_ROLE.SUPERADMIN;
}

export function analysisScope(user: AuthorizedUser): Prisma.AnalysisWhereInput {
  return user.role === USER_ROLE.USER ? { creatorId: user.id } : {};
}

export function canAccessAnalysis(user: AuthorizedUser, creatorId: string | null): boolean {
  return user.role !== USER_ROLE.USER || creatorId === user.id;
}
