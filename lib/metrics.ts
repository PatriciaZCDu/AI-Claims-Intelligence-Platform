import "server-only";
import { getAdmin } from "./supabase/admin";
import { getQueue } from "./data";
import { PLATFORM } from "./platform";
import { PERSONNEL, type Person } from "./personnel";
import { triagePriority } from "./triage";
import type { ClaimStatus, Role } from "./types";

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
  agreementRate: number; // live: 100 - human override rate (AI-accuracy proxy)
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
    agreementRate: Math.round((100 - cc.overrideRate) * 10) / 10,
    latencySec: cc.latencySec,
    overrideRate: cc.overrideRate,
    availability: PLATFORM.availability,
    drift: PLATFORM.drift,
    throughput24h: cc.claimsToday,
  };
}

// ── Per-adjuster performance (Operations Leader only) ────────────────────────
export interface AdjusterStat {
  id: string;
  name: string;
  role: Role;
  title: string;
  reviews: number; // total decisions made
  overrides: number; // "modify" decisions (adjuster overrode the AI)
  overrideRate: number; // overrides / reviews, %
  avgAbsVariance: number | null; // mean |variance| vs AI estimate, %
  approvals: number; // senior "approve" decisions
  revisions: number; // senior "request_revision" decisions
  escalations: number; // adjuster "escalate" decisions
  lastActive: string | null; // ISO timestamp of most recent decision
}

interface ReviewRow {
  reviewer_id: string | null;
  decision: string | null;
  variance: number | null;
  created_at: string;
}

/**
 * Aggregate every attributed review per person. Computed in JS over the (small)
 * reviews set; names/roles join via the personnel roster. People with no reviews
 * yet are still returned (zeroed) so the roster is always complete.
 */
export async function getAdjusterStats(): Promise<AdjusterStat[]> {
  const admin = getAdmin();
  const roster = PERSONNEL.filter((p) => p.role !== "ops_leader");
  const base = new Map<string, AdjusterStat>(
    roster.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        role: p.role,
        title: p.title,
        reviews: 0,
        overrides: 0,
        overrideRate: 0,
        avgAbsVariance: null,
        approvals: 0,
        revisions: 0,
        escalations: 0,
        lastActive: null,
      },
    ]),
  );
  if (!admin) return [...base.values()];

  const { data } = await admin
    .from("reviews")
    .select("reviewer_id, decision, variance, created_at")
    .not("reviewer_id", "is", null)
    .limit(5000);

  const varianceSums = new Map<string, { sum: number; n: number }>();
  for (const r of (data ?? []) as ReviewRow[]) {
    if (!r.reviewer_id) continue;
    const s = base.get(r.reviewer_id);
    if (!s) continue; // ignore ids not in the roster (e.g. ops_leader / legacy)
    s.reviews += 1;
    if (r.decision === "modify") s.overrides += 1;
    if (r.decision === "approve") s.approvals += 1;
    if (r.decision === "request_revision") s.revisions += 1;
    if (r.decision === "escalate") s.escalations += 1;
    if (r.variance != null) {
      const v = varianceSums.get(r.reviewer_id) ?? { sum: 0, n: 0 };
      v.sum += Math.abs(r.variance);
      v.n += 1;
      varianceSums.set(r.reviewer_id, v);
    }
    if (!s.lastActive || r.created_at > s.lastActive) s.lastActive = r.created_at;
  }

  for (const s of base.values()) {
    s.overrideRate = s.reviews ? Math.round((s.overrides / s.reviews) * 1000) / 10 : 0;
    const v = varianceSums.get(s.id);
    s.avgAbsVariance = v && v.n ? Math.round((v.sum / v.n) * 10) / 10 : null;
  }

  // Most active first, then by name for stable ordering.
  return [...base.values()].sort((a, b) => b.reviews - a.reviews || a.name.localeCompare(b.name));
}

// ── My worklist (adjuster + senior reviewer) ─────────────────────────────────
/** Open, in-flight claim statuses — the worklist (excludes approved/sent_to_repair/rejected). */
export const ACTIVE_STATUSES: ClaimStatus[] = [
  "intake",
  "validated",
  "processing",
  "assessed",
  "adjuster_review",
  "senior_review",
];

export interface MyQueueStats {
  open: number; // size of my worklist
  needsAttention: number; // subset with triage level !== "normal"
  label: string; // persona-specific tile label
}

/**
 * Persona-scoped worklist counts for the "my queue" tile. Adjusters see claims
 * assigned to them; senior adjusters see everything awaiting senior approval;
 * ops leaders get the global Command Center instead (null here).
 */
export async function getMyQueueStats(actor: Person): Promise<MyQueueStats | null> {
  if (actor.role === "ops_leader") return null;

  const rows =
    actor.role === "senior_adjuster"
      ? await getQueue({ statusIn: ["senior_review"] })
      : await getQueue({ assignedTo: actor.id, statusIn: ACTIVE_STATUSES });

  return {
    open: rows.length,
    needsAttention: rows.filter((r) => triagePriority(r.claim, r.assessment).level !== "normal")
      .length,
    label: actor.role === "senior_adjuster" ? "Awaiting your approval" : "Assigned to you",
  };
}
