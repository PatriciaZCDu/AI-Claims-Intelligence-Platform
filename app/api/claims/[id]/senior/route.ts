import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { getRole, CAN } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (!CAN.seniorApprove(role)) {
    return NextResponse.json(
      { error: "Only a Senior Adjuster can approve repair authorization" },
      { status: 403 },
    );
  }

  let admin;
  try {
    admin = requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { decision?: string; notes?: string };
  if (body.decision !== "approve" && body.decision !== "request_revision") {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  await admin.from("reviews").insert({
    claim_id: id,
    reviewer_role: role,
    decision: body.decision,
    notes: body.notes ?? null,
  });

  if (body.decision === "approve") {
    await admin.from("claims").update({ status: "sent_to_repair" }).eq("id", id);
    await logAudit(admin, id, role, "Senior Approved", {});
    await logAudit(admin, id, "system", "Sent to Repair System", {});
  } else {
    await admin.from("claims").update({ status: "adjuster_review" }).eq("id", id);
    await logAudit(admin, id, role, "Senior Requested Revision", {});
  }

  return NextResponse.json({ ok: true });
}
