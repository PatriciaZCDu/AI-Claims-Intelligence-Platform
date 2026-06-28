import Link from "next/link";
import { ArrowDown, Lock } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { getRole, CAN, roleLabel } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const LOOP = [
  { title: "Adjuster Corrections", blurb: "Every modify/override is captured as a signal" },
  { title: "Validated Labels", blurb: "Human-confirmed ground truth from senior approvals" },
  { title: "Training Dataset", blurb: "Corrections accumulate into a labeled corpus" },
  { title: "Offline Evaluation", blurb: "Precision/recall measured against held-out claims" },
  { title: "Shadow Deployment", blurb: "New model runs silently alongside production" },
  { title: "Human Validation", blurb: "No model reaches production without validation" },
  { title: "Production Release", blurb: "Promoted as e.g. Vision Model 4.3" },
];

export default async function LearningPage() {
  const role = await getRole();
  if (!CAN.viewOps(role)) {
    return (
      <div>
        <PageHeader title="Continuous Learning Loop" subtitle="Model improvement pipeline" />
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 p-5">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2 text-sm text-amber-800">
              <p>
                This view is part of the Operations dashboard, visible only to the{" "}
                <strong>Operations Leader</strong>. You are acting as{" "}
                <strong>{roleLabel(role)}</strong>.
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

  return (
    <div>
      <PageHeader
        title="Continuous Learning Loop"
        subtitle="Adjuster feedback becomes the improvement loop — new models are validated before deployment"
      />
      <Card className="p-8">
        <div className="mx-auto flex max-w-md flex-col items-stretch">
          {LOOP.map((step, i) => (
            <div key={step.title}>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                    <p className="text-xs text-slate-500">{step.blurb}</p>
                  </div>
                </div>
              </div>
              {i < LOOP.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <ArrowDown className="h-4 w-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-md text-center text-xs text-slate-400">
          No model reaches production without validation. This closes the loop from human review back
          into model quality — the foundation of a trusted enterprise AI platform.
        </p>
      </Card>
    </div>
  );
}
