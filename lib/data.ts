import "server-only";
import { getAdmin } from "./supabase/admin";
import { personName } from "./personnel";
import type {
  Assessment,
  AuditEntry,
  Claim,
  ClaimImage,
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

export async function listClaims(limit = 500): Promise<QueueRow[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("claims")
    .select("*, assessments(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as any[]).map((c) => ({
    claim: c as Claim,
    assessment: latest(c.assessments),
  }));
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
      .map((r) => ({ ...r, reviewer_name: personName(r.reviewer_id) }))
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
