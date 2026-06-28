import type { Role } from "./types";

// Client-safe roster of demo personnel — the single source of truth shared by the
// persona switcher (browser) and the server. The fixed UUIDs are kept in sync with
// supabase/migrations/0002_personnel.sql and the seed (seed.sql can't import TS, so
// the IDs are duplicated there by design — standard for demo fixtures).

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
}

export const PERSONNEL: Person[] = [
  { id: "11111111-1111-1111-1111-111111111101", name: "Maya Chen", role: "adjuster", title: "Claims Adjuster" },
  { id: "11111111-1111-1111-1111-111111111102", name: "Daniel Osei", role: "adjuster", title: "Claims Adjuster" },
  { id: "11111111-1111-1111-1111-111111111103", name: "Sofia Marchetti", role: "adjuster", title: "Claims Adjuster" },
  { id: "11111111-1111-1111-1111-111111111104", name: "Ravi Patel", role: "adjuster", title: "Claims Adjuster" },
  { id: "22222222-2222-2222-2222-222222222201", name: "Theo Park", role: "senior_adjuster", title: "Senior Adjuster" },
  { id: "22222222-2222-2222-2222-222222222202", name: "Grace Whitfield", role: "senior_adjuster", title: "Senior Adjuster" },
  { id: "33333333-3333-3333-3333-333333333301", name: "Priya Nair", role: "ops_leader", title: "Operations Leader" },
];

export function personById(id: string | null | undefined): Person | undefined {
  return id ? PERSONNEL.find((p) => p.id === id) : undefined;
}

export function personName(id: string | null | undefined): string | null {
  return personById(id)?.name ?? null;
}

/** First active person for a role — used as the default persona / attribution fallback. */
export function defaultPersonFor(role: Role): Person {
  return PERSONNEL.find((p) => p.role === role) ?? PERSONNEL[0];
}
