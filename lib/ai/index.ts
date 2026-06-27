import "server-only";
import type { DamageAssessor } from "./assessor";
import { MockAssessor } from "./mock";
import { GeminiAssessor } from "./gemini";
import { ClaudeAssessor } from "./claude";
import { OpenAIAssessor } from "./openai";

export type { DamageAssessor, AssessImage, AssessContext } from "./assessor";

/**
 * Provider factory. `AI_PROVIDER` selects the adapter (default: gemini).
 * If the chosen provider's API key is missing, we fall back to the mock
 * assessor so the demo always runs — and log which provider is active.
 */
export function getAssessor(): DamageAssessor {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  switch (provider) {
    case "gemini":
      if (process.env.GEMINI_API_KEY) return new GeminiAssessor();
      break;
    case "claude":
      if (process.env.ANTHROPIC_API_KEY) return new ClaudeAssessor();
      break;
    case "openai":
      if (process.env.OPENAI_API_KEY) return new OpenAIAssessor();
      break;
    case "mock":
      return new MockAssessor();
  }

  if (provider !== "mock") {
    console.warn(
      `[ai] provider "${provider}" unavailable or missing API key — using mock assessor.`,
    );
  }
  return new MockAssessor();
}
