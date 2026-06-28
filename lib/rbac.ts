import "server-only";
import { cookies } from "next/headers";
import type { Role } from "./types";
import { ROLE_COOKIE, USER_COOKIE, ROLES } from "./roles";
import { PERSONNEL, personById, defaultPersonFor, type Person } from "./personnel";

export { ROLE_COOKIE, USER_COOKIE, ROLES, roleLabel } from "./roles";

const DEFAULT_ROLE: Role = "adjuster";

/**
 * Resolve the active demo persona. Prefers the identity cookie (a personnel id);
 * falls back to the legacy role cookie, mapping it to the first person of that role.
 * Next 16: cookies() is async.
 */
export async function getActor(): Promise<Person> {
  const store = await cookies();
  const byId = personById(store.get(USER_COOKIE)?.value);
  if (byId) return byId;

  const legacyRole = store.get(ROLE_COOKIE)?.value as Role | undefined;
  const role = legacyRole && ROLES.some((r) => r.value === legacyRole) ? legacyRole : DEFAULT_ROLE;
  return defaultPersonFor(role);
}

/** The active persona's role. */
export async function getRole(): Promise<Role> {
  return (await getActor()).role;
}

/**
 * Capability matrix — the RBAC rules the PRD calls for, enforced in route
 * handlers. In production these map to Supabase RLS policies per role.
 */
export const CAN = {
  createClaim: (r: Role) => r === "adjuster" || r === "senior_adjuster",
  adjusterReview: (r: Role) => r === "adjuster" || r === "senior_adjuster",
  seniorApprove: (r: Role) => r === "senior_adjuster",
  // The entire Operations section — metrics, AI stats — is the Operations Leader's domain.
  viewOps: (r: Role) => r === "ops_leader",
  // Per-adjuster performance is strictly ops-leader-only.
  viewAdjusterStats: (r: Role) => r === "ops_leader",
  // Seniors (and ops) may see the individual adjuster's review info on a claim.
  viewAdjusterInfo: (r: Role) => r === "senior_adjuster" || r === "ops_leader",
} as const;

export { PERSONNEL };
