import type { AssessmentResult, Finding, Severity } from "@/lib/types";
import { clamp } from "@/lib/utils";

/** One image handed to a provider adapter. */
export interface AssessImage {
  mimeType: string; // image/jpeg | image/png | image/webp | image/gif
  base64: string;
  kind: string; // front | rear | side | damage
}

export interface AssessContext {
  vehicle?: string | null; // "2023 Toyota Camry"
  accidentSummary?: string | null;
}

/**
 * The single seam every model provider plugs into. Swapping vendors is a
 * one-line change in the factory (lib/ai/index.ts) — the rest of the platform
 * only depends on this interface and the normalized AssessmentResult.
 */
export interface DamageAssessor {
  readonly provider: string;
  readonly model: string;
  assess(images: AssessImage[], ctx: AssessContext): Promise<AssessmentResult>;
}

export const ASSESSMENT_INSTRUCTIONS = `You are an automotive damage assessment model for an enterprise insurance claims platform.
Analyze the vehicle photo(s) and return STRICT JSON describing only the visible exterior damage.

Rules:
- Report only damage you can actually see. Do NOT estimate repair dollar costs — a separate deterministic pricing service handles money.
- Use these component names where possible: "Front bumper", "Rear bumper", "Headlight", "Taillight", "Hood", "Fender", "Door", "Quarter panel", "Windshield", "Grille", "Mirror", "Wheel".
- severity is one of "low" | "medium" | "high".
- confidence is an integer 0-100 for each finding.
- overallConfidence (0-100) is your overall certainty. Lower it sharply when image coverage is poor, photos are blurry or partial, or structural/frame damage cannot be ruled out.
- overallSeverity is the highest severity among findings.
- reasoningSummary is 1-2 plain sentences an adjuster can read.

Return ONLY a JSON object of exactly this shape (no markdown, no prose):
{"findings":[{"component":"string","severity":"low|medium|high","confidence":0,"evidence":"string","location":"string"}],"overallSeverity":"low|medium|high","overallConfidence":0,"reasoningSummary":"string"}`;

/** JSON schema for providers that accept a response schema (e.g. OpenAI/Gemini). */
export const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          component: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          confidence: { type: "number" },
          evidence: { type: "string" },
          location: { type: "string" },
        },
        required: ["component", "severity", "confidence", "evidence", "location"],
      },
    },
    overallSeverity: { type: "string", enum: ["low", "medium", "high"] },
    overallConfidence: { type: "number" },
    reasoningSummary: { type: "string" },
  },
  required: ["findings", "overallSeverity", "overallConfidence", "reasoningSummary"],
} as const;

export function contextLine(ctx: AssessContext): string {
  const bits: string[] = [];
  if (ctx.vehicle) bits.push(`Vehicle: ${ctx.vehicle}.`);
  if (ctx.accidentSummary) bits.push(`Accident summary from the customer: ${ctx.accidentSummary}.`);
  return bits.length ? `\n\nContext — ${bits.join(" ")}` : "";
}

/** Tolerant JSON parse: strips code fences / surrounding prose if present. */
export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}

function toSeverity(v: unknown): Severity {
  return v === "low" || v === "high" ? v : "medium";
}

function toConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(clamp(n, 0, 100)) : 0;
}

/** Turn any provider's raw JSON into a validated, sanitized AssessmentResult. */
export function normalizeResult(
  raw: unknown,
  provider: string,
  model: string,
): AssessmentResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawFindings = Array.isArray(obj.findings) ? obj.findings : [];

  const findings: Finding[] = rawFindings
    .map((f): Finding | null => {
      const o = (f ?? {}) as Record<string, unknown>;
      const component = typeof o.component === "string" ? o.component.trim() : "";
      if (!component) return null;
      return {
        component,
        severity: toSeverity(o.severity),
        confidence: toConfidence(o.confidence),
        evidence: typeof o.evidence === "string" ? o.evidence : "",
        location: typeof o.location === "string" ? o.location : "",
      };
    })
    .filter((f): f is Finding => f !== null);

  const order: Severity[] = ["low", "medium", "high"];
  const computedSeverity =
    findings.length > 0
      ? findings.reduce<Severity>(
          (max, f) => (order.indexOf(f.severity) > order.indexOf(max) ? f.severity : max),
          "low",
        )
      : "low";

  const overallConfidence = toConfidence(
    obj.overallConfidence ??
      (findings.length
        ? findings.reduce((s, f) => s + f.confidence, 0) / findings.length
        : 0),
  );

  return {
    findings,
    overallSeverity: obj.overallSeverity ? toSeverity(obj.overallSeverity) : computedSeverity,
    overallConfidence,
    reasoningSummary:
      typeof obj.reasoningSummary === "string" && obj.reasoningSummary.trim()
        ? obj.reasoningSummary.trim()
        : "Assessment completed.",
    modelProvider: provider,
    modelVersion: model,
  };
}
