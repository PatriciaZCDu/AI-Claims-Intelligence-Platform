// Shared domain types — mirror the Postgres schema (supabase/migrations/0001_init.sql).

export type Role = "adjuster" | "senior_adjuster" | "ops_leader";

export type Severity = "low" | "medium" | "high";

export type RoutingDecision =
  | "standard"
  | "enhanced"
  | "request_photos"
  | "escalate";

export type ClaimStatus =
  | "intake"
  | "validated"
  | "processing"
  | "assessed"
  | "adjuster_review"
  | "senior_review"
  | "approved"
  | "sent_to_repair"
  | "rejected";

export type AssessmentStatus = "queued" | "processing" | "complete" | "failed";

export type StepStatus = "pending" | "running" | "complete" | "failed";

// The customer's region also governs data residency, so a single field covers both.
export type CustomerRegion = "US" | "EU" | "Canada";

export interface Finding {
  component: string;
  severity: Severity;
  confidence: number; // 0–100
  evidence: string; // why the model believes this (visible fracture pattern, etc.)
  location: string; // e.g. "Front-right bumper"
  costLow?: number; // filled by the deterministic pricing service
  costHigh?: number;
}

export interface Claim {
  id: string;
  policy_number: string;
  claim_number: string;
  vin: string | null;
  accident_summary: string | null;
  customer_region: CustomerRegion;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  assigned_to: string | null;
  status: ClaimStatus;
  created_at: string;
}

export interface ClaimImage {
  id: string;
  claim_id: string;
  kind: string;
  storage_path: string;
  validation: ImageValidation;
  created_at: string;
}

export interface ImageValidation {
  resolution_ok: boolean;
  blur_ok: boolean;
  duplicate: boolean;
  vehicle_detected: boolean;
  width?: number;
  height?: number;
  note?: string;
}

export interface Assessment {
  id: string;
  claim_id: string;
  status: AssessmentStatus;
  severity: Severity | null;
  confidence: number | null;
  cost_low: number | null;
  cost_high: number | null;
  findings: Finding[];
  reasoning_summary: string | null;
  routing: RoutingDecision | null;
  model_provider: string | null;
  model_version: string | null;
  latency_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface PipelineStep {
  id: string;
  assessment_id: string;
  claim_id: string;
  ordinal: number;
  step_key: string;
  label: string;
  status: StepStatus;
  detail: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Review {
  id: string;
  claim_id: string;
  reviewer_role: Role;
  reviewer_id: string | null;
  reviewer_name?: string | null; // resolved from the personnel roster (not a DB column)
  decision: string;
  adjuster_estimate: number | null;
  variance: number | null;
  notes: string | null;
  modified_findings: Finding[] | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  claim_id: string;
  actor_role: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

/** Normalized output every AI provider adapter must return. */
export interface AssessmentResult {
  findings: Finding[];
  overallSeverity: Severity;
  overallConfidence: number; // 0–100
  reasoningSummary: string;
  modelProvider: string;
  modelVersion: string;
}
