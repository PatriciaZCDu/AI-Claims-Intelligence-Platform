import Link from "next/link";
import { Info, Lock } from "lucide-react";
import { getModelOps, getCommandCenter, getAdjusterStats } from "@/lib/metrics";
import { getRole, CAN, roleLabel } from "@/lib/rbac";
import { activeModelLabel } from "@/lib/platform";
import { Card, CardHeader, PageHeader, StatTile, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const role = await getRole();

  if (!CAN.viewOps(role)) {
    return (
      <div>
        <PageHeader title="Model Operations" subtitle="Quality metrics & AI performance" />
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 p-5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2 text-sm text-amber-800">
              <p>
                The Operations dashboard — including per-adjuster performance — is visible only to
                the <strong>Operations Leader</strong>. You are acting as{" "}
                <strong>{roleLabel(role)}</strong>; switch personas in the top bar.
              </p>
              <Link href="/" className="inline-block font-medium text-amber-800 hover:text-amber-900">
                ← Back to Command Center
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const [m, cc, adjusters] = await Promise.all([
    getModelOps(),
    getCommandCenter(),
    getAdjusterStats(),
  ]);

  const totalReviews = adjusters.reduce((s, a) => s + a.reviews, 0);
  const totalOverrides = adjusters.reduce((s, a) => s + a.overrides, 0);

  const regulars = adjusters.filter((a) => a.role === "adjuster");
  const seniors = adjusters.filter((a) => a.role === "senior_adjuster");

  return (
    <div>
      <PageHeader
        title="Model Operations"
        subtitle="Launching AI is not the finish line — operating it safely is the product"
        actions={<Badge tone="blue">{activeModelLabel()}</Badge>}
      />

      {/* ── AI Health ─────────────────────────────────────────────────────── */}
      <h2 className="mb-3 text-sm font-semibold text-slate-700">AI Health</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Availability" value={`${m.availability}%`} tone="green" sub="Uptime" />
        <StatTile
          label="Latency"
          value={m.latencySec ? `${m.latencySec.toFixed(1)}s` : "—"}
          tone="blue"
          sub="Avg inference (live)"
        />
        <StatTile label="Model Drift" value={m.drift} tone="green" sub="Monitored" />
        <StatTile label="Throughput" value={`${m.throughput24h}`} tone="slate" sub="Claims (24h)" />
      </div>

      {/* ── AI Accuracy ───────────────────────────────────────────────────── */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-700">AI Accuracy</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-3 gap-4 lg:col-span-2">
          <StatTile label="Precision" value={`${m.precision}%`} tone="green" sub="Monitored" />
          <StatTile label="Recall" value={`${m.recall}%`} tone="green" sub="Monitored" />
          <StatTile
            label="Agreement"
            value={`${m.agreementRate}%`}
            tone="blue"
            sub="Live — humans kept AI"
          />
        </div>
        <Card className="border-blue-100 bg-blue-50/40">
          <div className="flex items-start gap-3 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-800">Honest metrics</p>
              <p className="mt-1">
                <strong>Agreement</strong> (the inverse of the human override rate) and{" "}
                <strong>latency</strong> are computed live from real reviews and inference timings.{" "}
                <strong>Precision/recall</strong> are monitored values — a true measurement needs
                labeled ground truth, which a prototype doesn&apos;t have.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Override Rates ────────────────────────────────────────────────── */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-700">Override Rates</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Human Override" value={`${m.overrideRate}%`} tone="amber" sub="Live, from reviews" />
        <StatTile label="Overrides" value={`${totalOverrides}`} tone="slate" sub={`of ${totalReviews} reviews`} />
        <StatTile label="Escalations" value={`${cc.escalations}`} tone="red" sub="Routed to manual (24h)" />
        <StatTile label="Low Confidence" value={`${cc.lowConfidence}`} tone="red" sub="< 70% (24h)" />
      </div>

      {/* ── Per-Adjuster Performance (ops-leader only) ────────────────────── */}
      {CAN.viewAdjusterStats(role) && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-700">Per-Adjuster Performance</h2>
          <Card>
            <CardHeader
              title="Reviewer scorecard"
              subtitle="Override rate, estimate variance, and decisions per individual"
              right={<Badge tone="amber">Operations Leader only</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3 font-medium">Reviewer</th>
                    <th className="px-5 py-3 text-right font-medium">Reviews</th>
                    <th className="px-5 py-3 text-right font-medium">Override Rate</th>
                    <th className="px-5 py-3 text-right font-medium">Avg |Variance|</th>
                    <th className="px-5 py-3 text-right font-medium">Approvals</th>
                    <th className="px-5 py-3 text-right font-medium">Escalations</th>
                  </tr>
                </thead>
                <AdjusterRows label="Claims Adjusters" rows={regulars} kind="adjuster" />
                <AdjusterRows label="Senior Adjusters" rows={seniors} kind="senior" />
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function AdjusterRows({
  label,
  rows,
  kind,
}: {
  label: string;
  rows: Awaited<ReturnType<typeof getAdjusterStats>>;
  kind: "adjuster" | "senior";
}) {
  if (rows.length === 0) return null;
  return (
    <tbody className="divide-y divide-slate-50">
      <tr className="bg-slate-50/60">
        <td colSpan={6} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </td>
      </tr>
      {rows.map((a) => {
        const overrideTone =
          a.overrideRate >= 15 ? "text-red-600" : a.overrideRate >= 10 ? "text-amber-600" : "text-slate-900";
        return (
          <tr key={a.id} className="text-slate-700">
            <td className="px-5 py-3">
              <div className="font-medium text-slate-900">{a.name}</div>
              <div className="text-xs text-slate-500">{roleLabel(a.role)}</div>
            </td>
            <td className="px-5 py-3 text-right tabular-nums">{a.reviews}</td>
            <td className={`px-5 py-3 text-right font-semibold tabular-nums ${overrideTone}`}>
              {a.reviews ? `${a.overrideRate}%` : "—"}
            </td>
            <td className="px-5 py-3 text-right tabular-nums">
              {a.avgAbsVariance != null ? `${a.avgAbsVariance}%` : "—"}
            </td>
            <td className="px-5 py-3 text-right tabular-nums">{kind === "senior" ? a.approvals : "—"}</td>
            <td className="px-5 py-3 text-right tabular-nums">{a.escalations || "—"}</td>
          </tr>
        );
      })}
    </tbody>
  );
}
