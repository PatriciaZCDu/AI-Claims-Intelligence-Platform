import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { getActor, CAN } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor();
  const role = actor.role;
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
  const decision = body.decision ?? "";
  if (decision !== "approve" && decision !== "request_revision" && decision !== "deny") {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }

  await admin.from("reviews").insert({
    claim_id: id,
    reviewer_role: role,
    reviewer_id: actor.id,
    decision,
    notes: body.notes ?? null,
  });

  if (decision === "approve") {
    await admin.from("claims").update({ status: "sent_to_repair" }).eq("id", id);
    await logAudit(admin, id, role, "Senior Approved", {});
    await logAudit(admin, id, "system", "Sent to Repair System", {});
  } else if (decision === "deny") {
    await admin.from("claims").update({ status: "rejected" }).eq("id", id);
    await logAudit(admin, id, role, "Claim Denied", { reason: body.notes ?? null });
  } else {
    await admin.from("claims").update({ status: "adjuster_review" }).eq("id", id);
    await logAudit(admin, id, role, "Senior Requested Revision", {});
  }

  return NextResponse.json({ ok: true });
}
