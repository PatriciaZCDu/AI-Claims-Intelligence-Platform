import "server-only";
import { getAdmin } from "./supabase/admin";
import { PLATFORM } from "./platform";

const sinceISO = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export interface CommandCenter {
  claimsToday: number;
  pendingReview: number;
  lowConfidence: number;
  escalations: number;
  availability: number;
  latencySec: number;
  overrideRate: number;
}

export async function getCommandCenter(): Promise<CommandCenter> {
  const admin = getAdmin();
  const base = {
    claimsToday: 0,
    pendingReview: 0,
    lowConfidence: 0,
    escalations: 0,
    availability: PLATFORM.availability,
    latencySec: 0,
    overrideRate: 0,
  };
  if (!admin) return base;

  const since = sinceISO(24);
  const [today, pending, low, esc, reviewsTotal, reviewsModify, latency] = await Promise.all([
    admin.from("claims").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("claims")
      .select("id", { count: "exact", head: true })
      .in("status", ["assessed", "adjuster_review", "senior_review"]),
    admin
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .lt("confidence", 70)
      .gte("created_at", since),
    admin
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("routing", "escalate")
      .gte("created_at", since),
    admin.from("reviews").select("id", { count: "exact", head: true }),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("decision", "modify"),
    admin.from("assessments").select("latency_ms").not("latency_ms", "is", null).limit(2000),
  ]);

  const total = reviewsTotal.count ?? 0;
  const modify = reviewsModify.count ?? 0;
  const latencies = ((latency.data ?? []) as { latency_ms: number }[]).map((r) => r.latency_ms);

  return {
    claimsToday: today.count ?? 0,
    pendingReview: pending.count ?? 0,
    lowConfidence: low.count ?? 0,
    escalations: esc.count ?? 0,
    availability: PLATFORM.availability,
    latencySec: Math.round((avg(latencies) / 1000) * 100) / 100,
    overrideRate: total ? Math.round((modify / total) * 1000) / 10 : 0,
  };
}

export interface ModelOps {
  precision: number;
  recall: number;
  latencySec: number;
  overrideRate: number;
  availability: number;
  drift: string;
  throughput24h: number;
}

export async function getModelOps(): Promise<ModelOps> {
  const cc = await getCommandCenter();
  return {
    precision: PLATFORM.precision,
    recall: PLATFORM.recall,
    latencySec: cc.latencySec,
    overrideRate: cc.overrideRate,
    availability: PLATFORM.availability,
    drift: PLATFORM.drift,
    throughput24h: cc.claimsToday,
  };
}
