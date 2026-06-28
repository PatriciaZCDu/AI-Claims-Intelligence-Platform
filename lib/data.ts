import "server-only";
import { getAdmin } from "./supabase/admin";
import { roleLabel } from "./roles";
import { triagePriority } from "./triage";
import type {
  Assessment,
  AuditEntry,
  Claim,
  ClaimImage,
  ClaimStatus,
  PipelineStep,
  Review,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface QueueRow {
  claim: Claim;
  assessment: Assessment | null;
}

function latest(assessments: Assessment[] | undefined): Assessment | null {
  if (!assessments || assessments.length === 0) return null;
  return [...assessments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export interface QueueOpts {
  assignedTo?: string; // claims.assigned_to = this personnel id
  statusIn?: ClaimStatus[]; // restrict to these statuses
  sort?: "triage" | "recent"; // default "recent"
  limit?: number; // default 500
}

/**
 * Owner/status-filtered claim worklist. "recent" orders by created_at in SQL;
 * "triage" scores each row with triagePriority() and sorts DESC in JS.
 */
export async function getQueue(opts?: QueueOpts): Promise<QueueRow[]> {
  const admin = getAdmin();
  if (!admin) return [];

  let query = admin.from("claims").select("*, assessments(*)");
  if (opts?.assignedTo) query = query.eq("assigned_to", opts.assignedTo);
  if (opts?.statusIn?.length) query = query.in("status", opts.statusIn);

  const sorted = opts?.sort === "triage" ? query : query.order("created_at", { ascending: false });
  const { data, error } = await sorted.limit(opts?.limit ?? 500);
  if (error || !data) return [];

  const rows: QueueRow[] = (data as any[]).map((c) => ({
    claim: c as Claim,
    assessment: latest(c.assessments),
  }));
  if (opts?.sort === "triage") {
    rows.sort(
      (a, b) =>
        triagePriority(b.claim, b.assessment).score - triagePriority(a.claim, a.assessment).score,
    );
  }
  return rows;
}

/** Backwards-compatible global feed — the reverse-chronological full list. */
export async function listClaims(limit = 500): Promise<QueueRow[]> {
  return getQueue({ limit, sort: "recent" });
}

export interface ClaimBundle {
  claim: Claim;
  assessment: Assessment | null;
  images: ClaimImage[];
  reviews: Review[];
}

export async function getClaimBundle(id: string): Promise<ClaimBundle | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("claims")
    .select("*, assessments(*), claim_images(*), reviews(*)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const c = data as any;
  return {
    claim: c as Claim,
    assessment: latest(c.assessments),
    images: (c.claim_images ?? []) as ClaimImage[],
    reviews: ((c.reviews ?? []) as Review[])
      // Role-level identity only — show the reviewer's role, never their name.
      .map((r) => ({ ...r, reviewer_name: roleLabel(r.reviewer_role) }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  };
}

export async function getPipelineSteps(claimId: string): Promise<PipelineStep[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("pipeline_steps")
    .select("*")
    .eq("claim_id", claimId)
    .order("ordinal");
  return (data ?? []) as PipelineStep[];
}

export async function getAudit(claimId: string): Promise<AuditEntry[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("audit_log")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at");
  return (data ?? []) as AuditEntry[];
}

export interface Correction {
  claim_id: string;
  claim_number: string;
  reviewer_name: string | null;
  variance: number | null;
  created_at: string;
}

/** Most recent adjuster overrides ("modify" reviews) — the human-correction feed. */
export async function getRecentCorrections(limit = 10): Promise<Correction[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("reviews")
    .select("claim_id, reviewer_role, variance, created_at, claims(claim_number)")
    .eq("decision", "modify")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    claim_id: r.claim_id,
    claim_number: Array.isArray(r.claims) ? r.claims[0]?.claim_number : r.claims?.claim_number,
    // Role-level identity only — reviewer shown by role, never by name.
    reviewer_name: roleLabel(r.reviewer_role),
    variance: r.variance,
    created_at: r.created_at,
  }));
}
