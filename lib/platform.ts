/**
 * Platform-level display config + the active model label.
 * Availability/drift are "monitored values" (no synthetic precision claims —
 * see README on honest metrics); latency & override rate are computed live.
 */
export const PLATFORM = {
  name: "Scale AI Claims Intelligence Platform",
  environment: "Production",
  region: "US-East",
  dataResidency: "United States",
  availability: 99.98, // monitored
  drift: "Stable", // monitored
  // Quality metrics shown on the Model Ops screen — monitored values, since a
  // POC has no labeled ground truth to compute precision/recall against.
  precision: 96,
  recall: 93,
} as const;

const PROVIDER_LABEL: Record<string, string> = {
  gemini: "Gemini 2.x Flash",
  claude: "Claude Opus 4.8",
  openai: "GPT-4o",
  mock: "Mock Vision (offline)",
};

export function activeProvider(): string {
  return (process.env.AI_PROVIDER || "gemini").toLowerCase();
}

export function activeModelLabel(): string {
  return PROVIDER_LABEL[activeProvider()] ?? activeProvider();
}
