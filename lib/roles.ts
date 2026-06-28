import type { Role } from "./types";

// Client-safe role constants (no server-only imports) so the role switcher can
// use them in the browser. Server-only helpers live in lib/rbac.ts.

export const ROLE_COOKIE = "demo_role";
// Identity cookie — stores the selected personnel id. ROLE_COOKIE is kept as a
// legacy fallback so older sessions still resolve to a role.
export const USER_COOKIE = "demo_user";

export const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: "adjuster", label: "Claims Adjuster", blurb: "Reviews AI findings, owns the assessment" },
  { value: "senior_adjuster", label: "Senior Adjuster", blurb: "Approves high-value claims & estimates" },
  { value: "ops_leader", label: "Operations Leader", blurb: "Quality metrics & AI performance" },
];

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
