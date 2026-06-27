import type { AssessmentResult } from "@/lib/types";
import type { AssessContext, AssessImage, DamageAssessor } from "./assessor";

/**
 * Deterministic offline assessor. Lets the entire pipeline run with zero
 * external keys (the default in .env.local) so the demo always works.
 *
 * Produces a low-confidence "request more photos" result when no images are
 * provided or the accident summary hints at poor coverage — so the
 * confidence-routing and low-confidence screens are demoable without a real key.
 */
export class MockAssessor implements DamageAssessor {
  readonly provider = "mock";
  readonly model = "mock-vision-1";

  async assess(images: AssessImage[], ctx: AssessContext): Promise<AssessmentResult> {
    await new Promise((r) => setTimeout(r, 300)); // simulate inference latency

    const hint = `${ctx.accidentSummary ?? ""}`.toLowerCase();
    const lowCoverage =
      images.length === 0 || /partial|blur|one photo|single|unclear|dark/.test(hint);

    if (lowCoverage) {
      return {
        findings: [],
        overallSeverity: "medium",
        overallConfidence: 62,
        reasoningSummary:
          "Insufficient image coverage. Unable to verify frame alignment or rule out structural damage — additional photos required.",
        modelProvider: this.provider,
        modelVersion: this.model,
      };
    }

    return {
      findings: [
        {
          component: "Front bumper",
          severity: "medium",
          confidence: 96,
          evidence: "Visible fracture pattern across the lower fascia",
          location: "Front-center bumper",
        },
        {
          component: "Headlight",
          severity: "medium",
          confidence: 95,
          evidence: "Lens fragmentation on the passenger side",
          location: "Front-right headlight",
        },
        {
          component: "Hood",
          severity: "low",
          confidence: 92,
          evidence: "Shallow dent near the leading edge",
          location: "Hood, center",
        },
      ],
      overallSeverity: "medium",
      overallConfidence: 94,
      reasoningSummary:
        "Three damaged components localized with high agreement; damage is moderate and consistent with a low-speed front-end impact.",
      modelProvider: this.provider,
      modelVersion: this.model,
    };
  }
}
