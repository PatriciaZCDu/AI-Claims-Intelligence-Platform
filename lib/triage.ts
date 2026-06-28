import type { Assessment, Claim } from "./types";

export type TriageLevel = "critical" | "high" | "normal";

export interface Triage {
  score: number; // higher = more urgent (sort desc)
  level: TriageLevel;
  reason: string; // short chip label
  ageHours: number;
}

export const SLA_HOURS = 24;

/**
 * Deterministic, model-independent urgency score — the operational layer on top
 * of the confidence engine. Escalations first, then low confidence, then aging.
 */
export function triagePriority(
  claim: Pick<Claim, "created_at">,
  assessment: Pick<Assessment, "routing" | "confidence"> | null,
  now: number = Date.now(),
): Triage {
  const routing = assessment?.routing ?? null;
  const confidence = assessment?.confidence ?? null;
  const ageHours = Math.max(0, (now - Date.parse(claim.created_at)) / 3_600_000);

  const routingWeight =
    routing === "escalate"
      ? 400
      : routing === "request_photos"
        ? 300
        : routing === "enhanced"
          ? 200
          : routing === "standard"
            ? 100
            : 150; // null / unknown
  const lowConfPenalty = confidence != null && confidence < 70 ? 70 - confidence : 0;
  const score = routingWeight + Math.min(ageHours, 48) * 3 + lowConfPenalty;

  const overdue = ageHours > SLA_HOURS;
  const aging = ageHours > SLA_HOURS * 0.75;
  const lowConf = confidence != null && confidence < 70;

  const level: TriageLevel =
    routing === "escalate" || overdue
      ? "critical"
      : routing === "request_photos" || lowConf || aging
        ? "high"
        : "normal";

  let reason: string;
  if (routing === "escalate") reason = "Escalated";
  else if (overdue) reason = "Overdue";
  else if (routing === "request_photos") reason = "Needs photos";
  else if (confidence != null && confidence < 70) reason = `Low conf ${Math.round(confidence)}%`;
  else if (aging) reason = "Aging";
  else reason = "On track";

  return { score, level, reason, ageHours };
}
