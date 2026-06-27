import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { getRole, CAN } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const ACTION_LABEL: Record<string, string> = {
  accept: "Adjuster Accepted AI Findings",
  modify: "Adjuster Modified Findings",
  escalate: "Adjuster Escalated",
  request_photos: "Requested Additional Photos",
};
const NEXT_STATUS: Record<string, string> = {
  accept: "senior_review",
  modify: "senior_review",
  escalate: "senior_review",
  request_photos: "adjuster_review",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (!CAN.adjusterReview(role)) {
    return NextResponse.json({ error: "Your role cannot review claims" }, { status: 403 });
  }

  let admin;
  try {
    admin = requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    adjuster_estimate?: number;
    notes?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modified_findings?: any;
  };
  const decision = body.decision ?? "";
  if (!ACTION_LABEL[decision]) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  // Variance vs the AI estimate midpoint.
  const { data: assess } = await admin
    .from("assessments")
    .select("cost_low,cost_high")
    .eq("claim_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const a = assess?.[0];
  let variance: number | null = null;
  if (body.adjuster_estimate && a?.cost_low != null && a?.cost_high != null) {
    const mid = (a.cost_low + a.cost_high) / 2;
    if (mid > 0) variance = Math.round(((body.adjuster_estimate - mid) / mid) * 1000) / 10;
  }

  await admin.from("reviews").insert({
    claim_id: id,
    reviewer_role: role,
    decision,
    adjuster_estimate: body.adjuster_estimate ?? null,
    variance,
    notes: body.notes ?? null,
    modified_findings: body.modified_findings ?? null,
  });
  await admin.from("claims").update({ status: NEXT_STATUS[decision] }).eq("id", id);
  await logAudit(admin, id, role, ACTION_LABEL[decision], { decision, variance });

  return NextResponse.json({ ok: true });
}
