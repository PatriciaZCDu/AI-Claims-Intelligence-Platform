// Single source of truth for the AI assessment pipeline stages — imported by
// both the worker (analyze route) and the Realtime pipeline screen so they
// never drift.
export const PIPELINE_STEPS: { key: string; label: string }[] = [
  { key: "validate_images", label: "Validate Images" },
  { key: "detect_vehicle", label: "Detect Vehicle" },
  { key: "locate_damage", label: "Locate Damage" },
  { key: "classify_severity", label: "Estimate Severity" },
  { key: "estimate_cost", label: "Calculate Cost" },
  { key: "generate_explanation", label: "Generate Explanation" },
  { key: "confidence_score", label: "Confidence Score" },
];
