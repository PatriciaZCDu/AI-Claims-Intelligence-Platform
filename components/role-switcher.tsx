"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { personById, defaultPersonFor } from "@/lib/personnel";
import { ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";

// Role-level switch: the UI only ever shows the three role labels. Under the hood we
// POST the default personnel id for the chosen role (the API still sets the identity
// cookie by personnel id, so "My queue" resolves to that role's assigned claims) —
// no individual names or person ids are ever rendered.

export function RoleSwitcher({ initialUserId }: { initialUserId: string }) {
  const router = useRouter();
  const initialRole: Role = personById(initialUserId)?.role ?? "adjuster";
  const [role, setRole] = useState<Role>(initialRole);
  const [pending, start] = useTransition();

  async function change(nextRole: Role) {
    setRole(nextRole);
    await fetch("/api/role", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: defaultPersonFor(nextRole).id }),
    });
    start(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">Acting as</span>
      <select
        aria-label="Acting as role"
        value={role}
        disabled={pending}
        onChange={(e) => change(e.target.value as Role)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
