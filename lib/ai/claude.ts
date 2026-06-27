import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AssessmentResult } from "@/lib/types";
import {
  ASSESSMENT_INSTRUCTIONS,
  contextLine,
  normalizeResult,
  safeJson,
  type AssessContext,
  type AssessImage,
  type DamageAssessor,
} from "./assessor";

/** Optional swap — Anthropic Claude (vision + reasoning). */
export class ClaudeAssessor implements DamageAssessor {
  readonly provider = "claude";
  readonly model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  async assess(images: AssessImage[], ctx: AssessContext): Promise<AssessmentResult> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
      { type: "text", text: ASSESSMENT_INSTRUCTIONS + contextLine(ctx) },
      ...images.map((im) => ({
        type: "image",
        source: { type: "base64", media_type: im.mimeType, data: im.base64 },
      })),
    ];

    const msg = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const text = msg.content.find((b) => b.type === "text");
    const raw = safeJson(text && "text" in text ? text.text : "{}");
    return normalizeResult(raw, this.provider, this.model);
  }
}
