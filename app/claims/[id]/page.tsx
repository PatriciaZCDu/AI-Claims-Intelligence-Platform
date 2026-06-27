import Link from "next/link";
import { notFound } from "next/navigation";
import { Loader2, FileSearch, ShieldCheck, ScrollText, ArrowRight, ChevronLeft } from "lucide-react";
import { getClaimBundle } from "@/lib/data";
import { getRole, CAN } from "@/lib/rbac";
import { ROUTING_META } from "@/lib/routing";
import { moneyRange } from "@/lib/utils";
import {
  Badge,
  buttonClass,
  Card,
  CardHeader,
  ConfidenceBadge,
  NavLinkRow,
  PageHeader,
  RoutingBadge,
  SeverityBadge,
} from "@/components/ui";
import { QuickDecision } from "@/components/quick-decision";

export const dynamic = "force-dynamic";

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ClaimDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  const bundle = await getClaimBundle(id);
  if (!bundle) notFound();

  const { claim, assessment, images } = bundle;
  const vehicle =
    [claim.vehicle_year, claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(" ") ||
    "Vehicle";

  const header = (
    <>
      <Link
        href="/claims"
        className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden /> Claims Queue
      </Link>
      <PageHeader
        title={`Claim ${claim.claim_number}`}
        subtitle={`${vehicle} · ${claim.deployment_region} · Policy ${claim.policy_number}`}
        actions={
          <>
            <Badge tone="slate">{statusLabel(claim.status)}</Badge>
            <Link href={`/claims/${id}/audit`} className={buttonClass("secondary")}>
              Audit Trail
            </Link>
          </>
        }
      />
    </>
  );

  // Still processing / not yet assessed.
  if (!assessment || assessment.status === "queued" || assessment.status === "processing") {
    return (
      <div>
        {header}
        <Card className="p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
          <p className="mt-3 text-sm text-slate-600">
            {assessment ? "AI assessment in progress." : "No AI assessment has been run yet."}
          </p>
          <Link
            href={`/claims/${id}/pipeline`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Open the pipeline <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>
    );
  }

  const lowConf =
    (assessment.confidence ?? 0) < 70 ||
    assessment.findings.length === 0 ||
    assessment.routing === "request_photos" ||
    assessment.routing === "escalate";
  const evidence = images.find((i) => i.kind === "damage") ?? images[0];
  const routeMeta = assessment.routing ? ROUTING_META[assessment.routing] : null;

  return (
    <div>
      {header}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {lowConf ? (
            <Card className="border-red-200">
              <CardHeader
                title="AI Assessment — Low Confidence"
                subtitle="A mature AI product knows when not to answer"
                right={<ConfidenceBadge value={assessment.confidence} />}
              />
              <div className="space-y-4 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</p>
                  <p className="mt-1 text-sm text-slate-700">{assessment.reasoning_summary}</p>
                </div>
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Cannot verify structural integrity / frame alignment from the submitted photos.
                </div>
                {CAN.adjusterReview(role) && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Recommended action
                    </p>
                    <QuickDecision
                      claimId={id}
                      actions={[
                        { label: "Request Photos", decision: "request_photos", variant: "primary" },
                        { label: "Escalate", decision: "escalate", variant: "danger" },
                      ]}
                    />
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="AI Damage Assessment"
                subtitle="Structured recommendations with evidence — not free-form text"
                right={<SeverityBadge severity={assessment.severity} />}
              />
              <ul className="divide-y divide-slate-100">
                {assessment.findings.map((f, i) => (
                  <li key={i} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{f.component}</span>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <div className="flex items-center gap-3">
                        <ConfidenceBadge value={f.confidence} />
                        <span className="text-sm font-medium text-slate-700">
                          {moneyRange(f.costLow, f.costHigh)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">
                      <span className="text-slate-400">Evidence:</span> {f.evidence}
                    </p>
                    <p className="text-xs text-slate-400">Location: {f.location}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Explainability footer — model identity behind every recommendation */}
          <Card className="bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-slate-500">
              <span>
                Model: <span className="font-medium text-slate-700">{assessment.model_provider}</span>{" "}
                · {assessment.model_version}
              </span>
              <span>Latency: {assessment.latency_ms ? `${assessment.latency_ms} ms` : "—"}</span>
              <span>Every output carries confidence, evidence, location & model version.</span>
            </div>
          </Card>
        </div>

        {/* Right rail: summary + evidence + actions */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Overall confidence
                </p>
                <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-900">
                  {assessment.confidence != null ? `${Math.round(assessment.confidence)}%` : "—"}
                </p>
              </div>
              <RoutingBadge routing={assessment.routing} />
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <Row label="Severity" value={<SeverityBadge severity={assessment.severity} />} />
              <Row
                label="Estimated repair"
                value={
                  <span className="font-semibold text-slate-900">
                    {moneyRange(assessment.cost_low, assessment.cost_high)}
                  </span>
                }
              />
              {routeMeta && <p className="pt-1 text-xs text-slate-500">{routeMeta.blurb}</p>}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Evidence" />
            {evidence ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={evidence.storage_path} alt="Damage evidence" className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-32 items-center justify-center bg-slate-50 text-xs text-slate-400">
                No photo attached (seeded historical claim)
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Human review" subtitle="AI recommends · humans decide" />
            <div className="flex flex-col gap-2 p-4">
              {CAN.adjusterReview(role) && (
                <NavLinkRow href={`/claims/${id}/review`} icon={<FileSearch className="h-4 w-4" />}>
                  Open Adjuster Review
                </NavLinkRow>
              )}
              {CAN.seniorApprove(role) && (
                <NavLinkRow href={`/claims/${id}/senior`} icon={<ShieldCheck className="h-4 w-4" />}>
                  Senior Approval
                </NavLinkRow>
              )}
              <NavLinkRow href={`/claims/${id}/audit`} icon={<ScrollText className="h-4 w-4" />}>
                Audit Trail
              </NavLinkRow>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      {value}
    </div>
  );
}
