"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PERSONNEL } from "@/lib/personnel";
import { roleLabel } from "@/lib/roles";
import type { Role } from "@/lib/types";

// Personas grouped by role so the picker reads as a roster of named people.
const GROUPS: Role[] = ["adjuster", "senior_adjuster", "ops_leader"];

export function RoleSwitcher({ initialUserId }: { initialUserId: string }) {
  const router = useRouter();
  const [userId, setUserId] = useState(initialUserId);
  const [pending, start] = useTransition();

  async function change(next: string) {
    setUserId(next);
    await fetch("/api/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: next }),
    });
    start(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">Acting as</span>
      <select
        aria-label="Acting as person"
        value={userId}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
      >
        {GROUPS.map((role) => (
          <optgroup key={role} label={roleLabel(role)}>
            {PERSONNEL.filter((p) => p.role === role).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
