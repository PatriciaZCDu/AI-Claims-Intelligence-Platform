import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getClaimBundle } from "@/lib/data";
import { getRole, CAN, roleLabel } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import { AdjusterReview } from "@/components/adjuster-review";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  const bundle = await getClaimBundle(id);
  if (!bundle) notFound();

  const header = (
    <PageHeader
      title={
        <>
          <Link
            href={`/claims/${id}`}
            className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> Claim {bundle.claim.claim_number}
          </Link>
          <span className="block">Adjuster Review · {bundle.claim.claim_number}</span>
        </>
      }
      subtitle="AI recommends · human judgment · full auditability"
    />
  );

  if (!CAN.adjusterReview(role)) {
    return (
      <div>
        {header}
        <Card className="border-amber-200 bg-amber-50">
          <div className="space-y-3 p-5">
            <p className="text-sm text-amber-800">
              The <strong>{roleLabel(role)}</strong> role cannot perform adjuster review. You are
              acting as <strong>{roleLabel(role)}</strong> — switch roles in the top bar.
            </p>
            <Link
              href={`/claims/${id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Back to claim {bundle.claim.claim_number}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {header}
      <AdjusterReview claimId={id} initialFindings={bundle.assessment?.findings ?? []} />
    </div>
  );
}
