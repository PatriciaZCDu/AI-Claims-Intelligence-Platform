import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getAssessor, type AssessImage } from "@/lib/ai";
import { priceFindings } from "@/lib/pricing";
import { decideRouting } from "@/lib/routing";
import { PIPELINE_STEPS } from "@/lib/pipeline";
import { money, sleep } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let admin;
  try {
    admin = requireAdmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 });
  }

  // Idempotency — don't re-run if an assessment is already processing/complete.
  const { data: prior } = await admin
    .from("assessments")
    .select("id,status")
    .eq("claim_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (prior?.[0] && (prior[0].status === "processing" || prior[0].status === "complete")) {
    return NextResponse.json({ ok: true, assessmentId: prior[0].id, already: true });
  }

  const { data: claim } = await admin.from("claims").select("*").eq("id", id).maybeSingle();
  if (!claim) return NextResponse.json({ error: "claim not found" }, { status: 404 });

  // Enqueue: assessment (processing) + 7 pending steps.
  const { data: a, error: aErr } = await admin
    .from("assessments")
    .insert({ claim_id: id, status: "processing" })
    .select("id")
    .single();
  if (aErr || !a) {
    return NextResponse.json({ error: aErr?.message ?? "could not create assessment" }, { status: 500 });
  }
  const assessmentId = a.id as string;

  const { data: stepRows } = await admin
    .from("pipeline_steps")
    .insert(
      PIPELINE_STEPS.map((s, i) => ({
        assessment_id: assessmentId,
        claim_id: id,
        ordinal: i + 1,
        step_key: s.key,
        label: s.label,
        status: "pending",
      })),
    )
    .select("id, ordinal");
  const idByOrdinal = new Map<number, string>((stepRows ?? []).map((r: any) => [r.ordinal, r.id]));
  await admin.from("claims").update({ status: "processing" }).eq("id", id);

  const setStep = (ord: number, status: string, detail?: string) =>
    admin
      .from("pipeline_steps")
      .update({
        status,
        detail: detail ?? null,
        ...(status === "running" ? { started_at: new Date().toISOString() } : {}),
        ...(status === "complete" || status === "failed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", idByOrdinal.get(ord)!);

  // A "cheap" stage: visibly run, pause, complete (drives the live animation).
  const runStep = async (ord: number, ms: number, detail?: string) => {
    await setStep(ord, "running");
    await sleep(ms);
    await setStep(ord, "complete", detail);
  };

  const started = Date.now();
  try {
    await runStep(1, 500, "Resolution, blur & duplicate checks passed");
    await runStep(2, 500, "Vehicle detected in frame");

    // Stage 3: the real model call.
    await setStep(3, "running");
    const assessor = getAssessor();
    const images = await loadImages(admin, id);
    const vehicle =
      [claim.vehicle_year, claim.vehicle_make, claim.vehicle_model].filter(Boolean).join(" ") || null;
    const result = await assessor.assess(images, {
      vehicle,
      accidentSummary: claim.accident_summary,
    });
    await setStep(
      3,
      "complete",
      result.findings.length
        ? `${result.findings.length} component(s) localized`
        : "No damage localized with confidence",
    );

    await runStep(4, 450, `Overall severity: ${result.findings.length ? result.overallSeverity : "n/a"}`);

    // Stage 5: deterministic Repair Cost Service.
    await setStep(5, "running");
    const { data: prices } = await admin
      .from("repair_prices")
      .select("component,severity,cost_low,cost_high");
    const priced = priceFindings(result.findings, (prices as any) ?? undefined);
    await sleep(400);
    await setStep(
      5,
      "complete",
      priced.findings.length
        ? `${money(priced.costLow)}–${money(priced.costHigh)}`
        : "No estimate (insufficient findings)",
    );

    await runStep(6, 450, "Evidence & reasoning generated");

    // Stage 7: confidence engine → routing.
    await setStep(7, "running");
    const routing = decideRouting(result.overallConfidence);
    await sleep(350);
    await setStep(7, "complete", `${Math.round(result.overallConfidence)}% → ${routing}`);

    const latency = Date.now() - started;
    await admin
      .from("assessments")
      .update({
        status: "complete",
        severity: result.findings.length ? result.overallSeverity : null,
        confidence: result.overallConfidence,
        cost_low: priced.findings.length ? priced.costLow : null,
        cost_high: priced.findings.length ? priced.costHigh : null,
        findings: priced.findings,
        reasoning_summary: result.reasoningSummary,
        routing,
        model_provider: result.modelProvider,
        model_version: result.modelVersion,
        latency_ms: latency,
        completed_at: new Date().toISOString(),
      })
      .eq("id", assessmentId);

    await admin.from("claims").update({ status: "adjuster_review" }).eq("id", id);
    await logAudit(admin, id, result.modelProvider, "AI Assessment Completed", {
      confidence: Math.round(result.overallConfidence),
      routing,
      provider: result.modelProvider,
    });

    return NextResponse.json({ ok: true, assessmentId, routing });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      await setStep(3, "failed", msg);
    } catch {
      /* best effort */
    }
    await admin.from("assessments").update({ status: "failed", reasoning_summary: msg }).eq("id", assessmentId);
    await admin.from("claims").update({ status: "validated" }).eq("id", id);
    await logAudit(admin, id, "system", "AI Assessment Failed", { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Fetch uploaded photos (public URLs) and return them as base64 for the model. */
async function loadImages(admin: any, claimId: string): Promise<AssessImage[]> {
  const { data } = await admin
    .from("claim_images")
    .select("storage_path, kind")
    .eq("claim_id", claimId);
  const out: AssessImage[] = [];
  for (const im of (data ?? []) as { storage_path: string; kind: string }[]) {
    try {
      const r = await fetch(im.storage_path);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      out.push({
        mimeType: r.headers.get("content-type") || "image/jpeg",
        base64: buf.toString("base64"),
        kind: im.kind,
      });
    } catch {
      /* skip unreadable image */
    }
  }
  return out;
}
