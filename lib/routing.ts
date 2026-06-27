import type { RoutingDecision } from "./types";

/** Confidence Engine thresholds (PRD: ≥95 standard, 70–95 enhanced, <70 human). */
export const THRESHOLDS = { standard: 95, enhanced: 70, requestPhotos: 55 } as const;

/**
 * Map an overall confidence score to a routing decision.
 * Deterministic, auditable, and independent of the model — the safety layer
 * that keeps a humble model from auto-approving what it isn't sure about.
 */
export function decideRouting(confidence: number): RoutingDecision {
  if (confidence >= THRESHOLDS.standard) return "standard";
  if (confidence >= THRESHOLDS.enhanced) return "enhanced";
  if (confidence >= THRESHOLDS.requestPhotos) return "request_photos";
  return "escalate";
}

export const ROUTING_META: Record<
  RoutingDecision,
  { label: string; blurb: string; tone: "green" | "amber" | "red" }
> = {
  standard: {
    label: "Standard Review",
    blurb: "High confidence (≥95%) — routed to a standard adjuster review.",
    tone: "green",
  },
  enhanced: {
    label: "Enhanced Review",
    blurb: "Medium confidence (70–95%) — routed to enhanced human review.",
    tone: "amber",
  },
  request_photos: {
    label: "Request Photos",
    blurb: "Low confidence (<70%) — recommend requesting additional photos.",
    tone: "red",
  },
  escalate: {
    label: "Escalate",
    blurb: "Very low confidence — escalated for manual inspection.",
    tone: "red",
  },
};
