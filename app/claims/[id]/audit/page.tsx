import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getClaimBundle, getAudit } from "@/lib/data";
import { fmtTime } from "@/lib/utils";
import { Card, CardHeader, PageHeader, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTOR_TONE: Record<string, "blue" | "green" | "amber" | "slate"> = {
  system: "slate",
  gemini: "blue",
  claude: "blue",
  openai: "blue",
  mock: "blue",
  adjuster: "amber",
  senior_adjuster: "green",
};

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, audit] = await Promise.all([getClaimBundle(id), getAudit(id)]);
  if (!bundle) notFound();

  return (
    <div>
      <PageHeader
        title={
          <>
            <Link
              href={`/claims/${id}`}
              className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Claim {bundle.claim.claim_number}
            </Link>
            <span className="block">Audit Trail · {bundle.claim.claim_number}</span>
          </>
        }
        subtitle="Every AI-assisted decision is traceable — for compliance, debugging, and trust"
      />
      <Card className="max-w-2xl">
        <CardHeader title="Timeline" subtitle={`${audit.length} events`} />
        {audit.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No audit events recorded yet.</p>
        ) : (
          <ol className="relative ml-4 border-l border-slate-200 p-5 pl-6">
            {audit.map((e) => (
              <li key={e.id} className="relative mb-6 last:mb-0">
                <span className="absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{e.action}</span>
                  <Badge tone={ACTOR_TONE[e.actor_role] ?? "slate"}>{e.actor_role}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{fmtTime(e.created_at)}</p>
                {e.detail && Object.keys(e.detail).length > 0 && (
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">
                    {JSON.stringify(e.detail)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
