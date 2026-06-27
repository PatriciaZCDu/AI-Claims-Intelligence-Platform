import "server-only";
import OpenAI from "openai";
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

/** Optional swap — OpenAI GPT vision models. */
export class OpenAIAssessor implements DamageAssessor {
  readonly provider = "openai";
  readonly model = process.env.OPENAI_MODEL || "gpt-4o";

  async assess(images: AssessImage[], ctx: AssessContext): Promise<AssessmentResult> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [
      { type: "text", text: ASSESSMENT_INSTRUCTIONS + contextLine(ctx) },
      ...images.map((im) => ({
        type: "image_url",
        image_url: { url: `data:${im.mimeType};base64,${im.base64}` },
      })),
    ];

    const res = await client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    });

    return normalizeResult(
      safeJson(res.choices[0]?.message?.content ?? "{}"),
      this.provider,
      this.model,
    );
  }
}
