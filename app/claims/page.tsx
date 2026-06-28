import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { getQueue, type QueueOpts, type QueueRow } from "@/lib/data";
import { getAdmin } from "@/lib/supabase/admin";
import { getActor } from "@/lib/rbac";
import { triagePriority } from "@/lib/triage";
import { ACTIVE_STATUSES } from "@/lib/metrics";
import { Card, ConfidenceBadge, PageHeader, RoutingBadge, SeverityBadge, Badge, buttonClass } from "@/components/ui";
import { ClaimsFilters } from "@/components/claims-filters";
import { fmtTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function band(confidence: number | null): "high" | "medium" | "low" | null {
  if (confidence == null) return null;
  if (confidence >= 95) return "high";
  if (confidence >= 70) return "medium";
  return "low";
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtAge(h: number): string {
  return h < 1 ? "<1h" : h < 48 ? `${Math.round(h)}h` : `${Math.floor(h / 24)}d`;
}

export default async function ClaimsQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const configured = Boolean(getAdmin());

  const actor = await getActor();
  const role = actor.role;
  // Adjusters and seniors default to their personal worklist; ops always sees All.
  const mine = role === "ops_leader" ? false : sp.mine !== "0";

  const opts: QueueOpts =
    mine && role === "senior_adjuster"
      ? { statusIn: ["senior_review"], sort: "triage" }
      : mine && role === "adjuster"
        ? { assignedTo: actor.id, statusIn: ACTIVE_STATUSES, sort: "triage" }
        : { sort: "triage" };

  const rows = await getQueue(opts);

  const filtered = rows.filter(({ claim, assessment }: QueueRow) => {
    if (sp.status && claim.status !== sp.status) return false;
    if (sp.region && claim.deployment_region !== sp.region) return false;
    if (sp.severity && assessment?.severity !== sp.severity) return false;
    if (sp.confidence && band(assessment?.confidence ?? null) !== sp.confidence) return false;
    if (sp.routing && assessment?.routing !== sp.routing) return false;
    return true;
  });

  // Build a query string from the current params, applying overrides — keeps the
  // active dropdown filters intact when toggling My queue / All claims.
  const qs = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...next })) if (v) p.set(k, v);
    return p.toString();
  };

  return (
    <div>
      <PageHeader
        title="Claims Queue"
        subtitle={
          mine
            ? "Your worklist, sorted by triage — escalations and low-confidence claims rise to the top"
            : "Sorted by triage — escalations and low-confidence claims rise to the top"
        }
        actions={
          <Link href="/claims/new" className={buttonClass("primary")}>
            New Claim
          </Link>
        }
      />

      <div className="mb-4 space-y-3">
        {role !== "ops_leader" && (
          <div className="flex gap-2">
            <Link
              href={`/claims?${qs({ mine: "1" })}`}
              className={buttonClass(mine ? "primary" : "secondary")}
            >
              My queue
            </Link>
            <Link
              href={`/claims?${qs({ mine: "0" })}`}
              className={buttonClass(mine ? "secondary" : "primary")}
            >
              All claims
            </Link>
          </div>
        )}
        <ClaimsFilters />
      </div>

      {rows.length === 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              {configured ? (
                <>
                  <p className="font-semibold">No claims yet</p>
                  <p className="mt-1 text-amber-700">
                    The database is connected but has no claims. Create your first claim, or run{" "}
                    <code className="rounded bg-amber-100 px-1">supabase db reset</code> to load the
                    demo data.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Supabase not configured</p>
                  <p className="mt-1 text-amber-700">
                    Add your Supabase keys to{" "}
                    <code className="rounded bg-amber-100 px-1">.env.local</code> and run{" "}
                    <code className="rounded bg-amber-100 px-1">supabase db reset</code> to load the
                    demo data. The app runs in <strong>mock AI mode</strong> until then. See the
                    README.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Claim</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">AI Conf.</th>
                <th className="px-4 py-3 font-medium">Routing</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 100).map(({ claim, assessment }) => {
                const t = triagePriority(claim, assessment);
                return (
                  <tr key={claim.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{claim.claim_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[claim.vehicle_year, claim.vehicle_make, claim.vehicle_model]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{claim.deployment_region}</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={assessment?.severity ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={assessment?.confidence ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <RoutingBadge routing={assessment?.routing ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          t.level === "critical" ? "red" : t.level === "high" ? "amber" : "slate"
                        }
                      >
                        {t.reason}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="slate">{statusLabel(claim.status)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtTime(claim.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtAge(t.ageHours)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/claims/${claim.id}`}
                        aria-label={`Open claim ${claim.claim_number}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {rows.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">
                    No claims match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Showing {Math.min(filtered.length, 100)} of {filtered.length} claims.
      </p>
    </div>
  );
}
