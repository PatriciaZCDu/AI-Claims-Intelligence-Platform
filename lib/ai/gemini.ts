import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

/** Default provider — Google Gemini Flash. */
export class GeminiAssessor implements DamageAssessor {
  readonly provider = "gemini";
  readonly model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  async assess(images: AssessImage[], ctx: AssessContext): Promise<AssessmentResult> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: ASSESSMENT_INSTRUCTIONS + contextLine(ctx) },
      ...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: im.base64 } })),
    ];

    const res = await model.generateContent(parts);
    return normalizeResult(safeJson(res.response.text()), this.provider, this.model);
  }
}
