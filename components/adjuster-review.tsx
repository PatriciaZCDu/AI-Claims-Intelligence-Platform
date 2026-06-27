"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button, Card, CardHeader, SeverityBadge, Input, Select, Textarea } from "@/components/ui";
import { moneyRange } from "@/lib/utils";
import type { Finding, Severity } from "@/lib/types";

const SEVS: Severity[] = ["low", "medium", "high"];

export function AdjusterReview({
  claimId,
  initialFindings,
}: {
  claimId: string;
  initialFindings: Finding[];
}) {
  const router = useRouter();
  const [findings, setFindings] = useState<Finding[]>(initialFindings);
  const [notes, setNotes] = useState("");
  const [estimate, setEstimate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Finding>) {
    setFindings((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    setDirty(true);
  }
  function remove(i: number) {
    setFindings((fs) => fs.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function add() {
    setFindings((fs) => [
      ...fs,
      { component: "New component", severity: "medium", confidence: 100, evidence: "Added by adjuster", location: "" },
    ]);
    setDirty(true);
  }

  async function submit(decision: string) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/claims/${claimId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: notes || null,
          adjuster_estimate: estimate ? Number(estimate) : null,
          modified_findings: decision === "modify" ? findings : null,
        }),
      });
      if (!res.ok) {
        const rj = await res.json().catch(() => ({}));
        setError(rj.error || "Failed to submit review");
        return;
      }
      router.push(`/claims/${claimId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="AI Findings"
            subtitle="The AI never approves a claim — the adjuster remains accountable"
            right={
              <Button variant="secondary" onClick={add}>
                <Plus className="h-4 w-4" /> Add damage
              </Button>
            }
          />
          <ul className="divide-y divide-slate-100">
            {findings.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 p-4">
                <Input
                  value={f.component}
                  onChange={(e) => update(i, { component: e.target.value })}
                  className="min-w-40 flex-1 py-1.5"
                />
                <Select
                  value={f.severity}
                  onChange={(e) => update(i, { severity: e.target.value as Severity })}
                  className="px-2 py-1.5"
                >
                  {SEVS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <span className="w-28 text-right text-sm text-slate-600">
                  {moneyRange(f.costLow, f.costHigh)}
                </span>
                <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {findings.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-400">
                No findings. Add damage manually or request additional photos.
              </li>
            )}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <label className="mb-1 block text-xs font-medium text-slate-500">Adjuster estimate (optional)</label>
          <Input
            type="number"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            placeholder="e.g. 3450"
            className="w-full"
          />
          <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full"
            placeholder="Reasoning, context, or instructions for senior review…"
          />
        </Card>

        <Card className="p-5">
          <p className="mb-3 text-xs text-slate-500">
            Senior adjuster approval is required before repair authorization.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              disabled={busy !== null}
              onClick={() => submit(dirty ? "modify" : "accept")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? "Save & Send to Senior" : "Accept & Send to Senior"}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => submit("request_photos")}>
              Request Photos
            </Button>
            <Button variant="danger" disabled={busy !== null} onClick={() => submit("escalate")}>
              Escalate
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </Card>

        {dirty && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600">
            <SeverityBadge severity="medium" /> Findings modified — counts toward the override rate.
          </p>
        )}
      </div>
    </div>
  );
}
