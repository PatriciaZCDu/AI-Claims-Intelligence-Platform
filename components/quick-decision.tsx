"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

type Variant = "primary" | "secondary" | "danger";
type Action = { label: string; decision: string; variant?: Variant; confirm?: string };

export function QuickDecision({
  claimId,
  endpoint = "review",
  actions,
}: {
  claimId: string;
  endpoint?: "review" | "senior";
  actions: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    // Terminal/destructive actions (e.g. deny) confirm before firing.
    if (action.confirm && !window.confirm(action.confirm)) return;
    setBusy(action.decision);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: action.decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to submit decision.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.decision}
            variant={a.variant ?? "secondary"}
            disabled={busy !== null}
            onClick={() => act(a)}
          >
            {busy === a.decision ? "…" : a.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
