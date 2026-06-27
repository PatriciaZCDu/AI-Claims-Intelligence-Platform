import "server-only";
import { cookies } from "next/headers";
import type { Role } from "./types";
import { ROLE_COOKIE, ROLES } from "./roles";

export { ROLE_COOKIE, ROLES, roleLabel } from "./roles";

const DEFAULT_ROLE: Role = "adjuster";

/** Read the active demo persona from the role cookie (Next 16: cookies() is async). */
export async function getRole(): Promise<Role> {
  const store = await cookies();
  const v = store.get(ROLE_COOKIE)?.value as Role | undefined;
  return v && ROLES.some((r) => r.value === v) ? v : DEFAULT_ROLE;
}

/**
 * Capability matrix — the RBAC rules the PRD calls for, enforced in route
 * handlers. In production these map to Supabase RLS policies per role.
 */
export const CAN = {
  createClaim: (r: Role) => r === "adjuster" || r === "senior_adjuster",
  adjusterReview: (r: Role) => r === "adjuster" || r === "senior_adjuster",
  seniorApprove: (r: Role) => r === "senior_adjuster",
  viewOps: (): boolean => true,
} as const;
