import { AlertTriangle } from "lucide-react";
import { getCommandCenter } from "@/lib/metrics";
import { getAdmin } from "@/lib/supabase/admin";
import { PLATFORM, activeModelLabel } from "@/lib/platform";
import { Badge, Card, CardHeader, DefinitionRow, NavLinkRow, PageHeader, StatTile } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CommandCenter() {
  const configured = Boolean(getAdmin());
  const m = await getCommandCenter();

  return (
    <div>
      <PageHeader
        title="Operations Command Center"
        subtitle={`${PLATFORM.environment} · ${PLATFORM.name}`}
      />

      {!configured && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Supabase not configured</p>
              <p className="mt-1 text-amber-700">
                Add your Supabase keys to <code className="rounded bg-amber-100 px-1">.env.local</code>{" "}
                and run <code className="rounded bg-amber-100 px-1">supabase db reset</code> to load the
                demo data. The app runs in <strong>mock AI mode</strong> until then. See the README.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Claims (24h)" value={m.claimsToday} tone="blue" sub="Processed today" />
        <StatTile label="Pending Review" value={m.pendingReview} tone="amber" sub="Awaiting a human" />
        <StatTile label="Low Confidence" value={m.lowConfidence} tone="red" sub="< 70% confidence" />
        <StatTile label="Escalations" value={m.escalations} tone="red" sub="Routed to manual" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="AI Platform Health"
            subtitle="Operational visibility — not just predictions, but whether the system is healthy"
            right={<Badge tone="green">Operational</Badge>}
          />
          <div className="divide-y divide-slate-100">
            <DefinitionRow label="Availability" value={`${PLATFORM.availability}%`} tone="green" />
            <DefinitionRow
              label="Latency (avg inference)"
              value={m.latencySec ? `${m.latencySec.toFixed(1)} sec` : "—"}
            />
            <DefinitionRow label="Model" value={activeModelLabel()} />
            <DefinitionRow label="Model drift" value={PLATFORM.drift} tone="green" />
            <DefinitionRow label="Human override rate" value={`${m.overrideRate}%`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <div className="flex flex-col gap-2 p-4">
            <NavLinkRow href="/claims/new">Create a new claim</NavLinkRow>
            <NavLinkRow href="/claims">Open the claims queue</NavLinkRow>
            <NavLinkRow href="/operations">View model operations</NavLinkRow>
          </div>
        </Card>
      </div>
    </div>
  );
}
