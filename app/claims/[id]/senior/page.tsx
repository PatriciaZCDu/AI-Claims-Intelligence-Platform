import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getClaimBundle } from "@/lib/data";
import { getRole, CAN, roleLabel } from "@/lib/rbac";
import { money, moneyRange } from "@/lib/utils";
import { Card, CardHeader, PageHeader, Badge, StatTile, NavLinkRow } from "@/components/ui";
import { QuickDecision } from "@/components/quick-decision";

export const dynamic = "force-dynamic";

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
  const adjReview = [...reviews].reverse().find((r) => r.adjuster_estimate != null);
  const adjEstimate = adjReview?.adjuster_estimate ?? null;
  const variance =
    aiMid != null && adjEstimate != null && aiMid > 0
      ? Math.round(((adjEstimate - aiMid) / aiMid) * 1000) / 10
      : adjReview?.variance ?? null;

  const alreadyApproved = claim.status === "sent_to_repair" || claim.status === "approved";

  return (
    <div>
      {header}
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
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Approving authorizes the repair and dispatches the claim to the repair system.
                </p>
                <QuickDecision
                  claimId={id}
                  endpoint="senior"
                  actions={[
                    { label: "Approve", decision: "approve", variant: "primary" },
                    { label: "Request Revision", decision: "request_revision", variant: "secondary" },
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
