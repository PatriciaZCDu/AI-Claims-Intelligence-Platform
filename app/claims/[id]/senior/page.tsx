import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getClaimBundle } from "@/lib/data";
import { getRole, CAN, roleLabel } from "@/lib/rbac";
import { money, moneyRange } from "@/lib/utils";
import { Card, CardHeader, PageHeader, Badge, StatTile, NavLinkRow } from "@/components/ui";
import { QuickDecision } from "@/components/quick-decision";

export const dynamic = "force-dynamic";

const DECISION_LABEL: Record<string, string> = {
  accept: "Accepted AI findings",
  modify: "Modified findings",
  escalate: "Escalated",
  request_photos: "Requested more photos",
};

export default async function SeniorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  const bundle = await getClaimBundle(id);
  if (!bundle) notFound();

  const { claim, assessment, reviews } = bundle;
  const header = (
    <PageHeader
      title={
        <>
          <Link
            href={`/claims/${id}`}
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Claim {claim.claim_number}
          </Link>
          <span className="block">Senior Review · {claim.claim_number}</span>
        </>
      }
      subtitle="AI assists · adjuster recommends · senior reviewer approves"
    />
  );

  if (!CAN.seniorApprove(role)) {
    return (
      <div>
        {header}
        <Card className="border-amber-200 bg-amber-50">
          <div className="space-y-3 p-5">
            <p className="text-sm text-amber-800">
              Only a <strong>Senior Adjuster</strong> can approve repair authorization. You are
              acting as <strong>{roleLabel(role)}</strong> — switch roles in the top bar.
            </p>
            <Link
              href={`/claims/${id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back to claim {claim.claim_number}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const aiMid =
    assessment?.cost_low != null && assessment?.cost_high != null
      ? Math.round((assessment.cost_low + assessment.cost_high) / 2)
      : null;
  const adjusterReviews = reviews.filter((r) => r.reviewer_role === "adjuster");
  const adjReview = [...reviews].reverse().find((r) => r.adjuster_estimate != null);
  const adjEstimate = adjReview?.adjuster_estimate ?? null;
  const variance =
    aiMid != null && adjEstimate != null && aiMid > 0
      ? Math.round(((adjEstimate - aiMid) / aiMid) * 1000) / 10
      : adjReview?.variance ?? null;

  const alreadyApproved = claim.status === "sent_to_repair" || claim.status === "approved";
  const denied = claim.status === "rejected";

  return (
    <div>
      {header}

      <Card className="mb-6">
        <CardHeader title="Adjuster review" subtitle="Who handled this claim and what they decided" />
        {adjusterReviews.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">
            No adjuster has reviewed this claim yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {adjusterReviews.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {r.reviewer_name ?? "Claims Adjuster"}
                  </span>
                  <Badge tone={r.decision === "modify" ? "amber" : "slate"}>
                    {DECISION_LABEL[r.decision] ?? r.decision}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                  {r.adjuster_estimate != null && <span>Estimate {money(r.adjuster_estimate)}</span>}
                  {r.variance != null && <span>Variance {r.variance > 0 ? "+" : ""}{r.variance}%</span>}
                  <span>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                {r.notes && <p className="mt-1.5 text-sm text-slate-700">{r.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Estimate comparison" subtitle="AI vs. adjuster" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            <StatTile label="AI Estimate" value={aiMid != null ? money(aiMid) : "—"} sub={moneyRange(assessment?.cost_low, assessment?.cost_high)} />
            <StatTile label="Adjuster Estimate" value={adjEstimate != null ? money(adjEstimate) : "—"} sub={adjEstimate == null ? "Not provided" : "Submitted at review"} />
            <StatTile
              label="Variance"
              value={variance != null ? `${variance > 0 ? "+" : ""}${variance}%` : "—"}
              tone={variance != null && Math.abs(variance) > 15 ? "red" : "green"}
              sub={variance != null && Math.abs(variance) > 15 ? "Above tolerance" : "Within tolerance"}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Decision" />
          <div className="space-y-3 p-5">
            {alreadyApproved ? (
              <>
                <Badge tone="green">Already approved · sent to repair</Badge>
                <NavLinkRow href={`/claims/${id}`}>Back to claim</NavLinkRow>
                <NavLinkRow href={`/claims/${id}/audit`}>View audit trail</NavLinkRow>
              </>
            ) : denied ? (
              <>
                <Badge tone="red">Claim denied · rejected</Badge>
                <NavLinkRow href={`/claims/${id}`}>Back to claim</NavLinkRow>
                <NavLinkRow href={`/claims/${id}/audit`}>View audit trail</NavLinkRow>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Approving authorizes the repair and dispatches the claim to the repair system.
                  Denying rejects the claim and routes it out of the queue.
                </p>
                <QuickDecision
                  claimId={id}
                  endpoint="senior"
                  actions={[
                    { label: "Approve", decision: "approve", variant: "primary" },
                    { label: "Request Revision", decision: "request_revision", variant: "secondary" },
                    {
                      label: "Deny",
                      decision: "deny",
                      variant: "danger",
                      confirm:
                        "Deny this claim? It will be rejected and removed from the approval queue.",
                    },
                  ]}
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
