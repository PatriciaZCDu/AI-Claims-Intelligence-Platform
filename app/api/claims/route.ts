import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { getActor, CAN } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const actor = await getActor();
  const role = actor.role;
  if (!CAN.createClaim(role)) {
    return NextResponse.json({ error: "Your role cannot create claims" }, { status: 403 });
  }

  let admin;
  try {
    admin = requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (!b.policy_number || !b.claim_number) {
    return NextResponse.json(
      { error: "policy_number and claim_number are required" },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("claims")
    .insert({
      policy_number: b.policy_number,
      claim_number: b.claim_number,
      vin: b.vin || null,
      accident_summary: b.accident_summary || null,
      customer_region: b.customer_region || "US",
      vehicle_make: b.vehicle_make || null,
      vehicle_model: b.vehicle_model || null,
      vehicle_year: b.vehicle_year ? Number(b.vehicle_year) : null,
      status: "intake",
      // The person who files a claim owns it — so it lands in their "My queue".
      assigned_to: actor.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  await logAudit(admin, data.id, role, "Claim Created", { claim_number: b.claim_number });
  return NextResponse.json({ id: data.id });
}
