import { Info } from "lucide-react";
import { getModelOps } from "@/lib/metrics";
import { activeModelLabel } from "@/lib/platform";
import { Card, CardHeader, PageHeader, StatTile, Badge, DefinitionRow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const m = await getModelOps();

  return (
    <div>
      <PageHeader
        title="Model Operations"
        subtitle="Launching AI is not the finish line — operating it safely is the product"
        actions={<Badge tone="blue">{activeModelLabel()}</Badge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Precision" value={`${m.precision}%`} tone="green" sub="Monitored" />
        <StatTile label="Recall" value={`${m.recall}%`} tone="green" sub="Monitored" />
        <StatTile
          label="Latency"
          value={m.latencySec ? `${m.latencySec.toFixed(1)}s` : "—"}
          tone="blue"
          sub="Avg inference (live)"
        />
        <StatTile label="Human Override" value={`${m.overrideRate}%`} tone="amber" sub="Live, from reviews" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Operational signals" />
          <div className="divide-y divide-slate-100">
            <DefinitionRow label="Availability" value={`${m.availability}%`} tone="green" />
            <DefinitionRow label="Model drift" value={m.drift} tone="green" />
            <DefinitionRow label="Throughput (24h)" value={`${m.throughput24h} claims`} />
            <DefinitionRow label="Active model" value={activeModelLabel()} />
          </div>
        </Card>

        <Card className="border-blue-100 bg-blue-50/40">
          <div className="flex items-start gap-3 p-5">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="text-xs leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-800">Honest metrics</p>
              <p className="mt-1">
                <strong>Override rate</strong> and <strong>latency</strong> are computed live from
                real reviews and inference timings. <strong>Precision/recall</strong> are shown as
                monitored values — a true measurement requires labeled ground truth, which a
                prototype doesn&apos;t have. In production these come from a continuous-evaluation set.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
