import type { ImageValidation } from "./types";

/** Minimum short-edge resolution we treat as usable for assessment. */
export const MIN_SHORT_EDGE = 500;

export interface ImageMeta {
  width: number;
  height: number;
  hash: string; // SHA-256 of the bytes, computed in the browser
  kind: string;
}

/**
 * AI Readiness Validation — run before any model inference. Catches the most
 * common computer-vision failure mode (bad input) so we never trust an
 * assessment built on unusable photos.
 *
 * resolution + duplicate are computed deterministically here. Blur and
 * vehicle-detection are heuristic placeholders for the POC; in production they
 * become a Laplacian-variance check and a detector model respectively.
 */
export function evaluateImages(metas: ImageMeta[]): ImageValidation[] {
  const seen = new Set<string>();
  return metas.map((m) => {
    const duplicate = seen.has(m.hash);
    if (!duplicate) seen.add(m.hash);
    const resolution_ok = Math.min(m.width, m.height) >= MIN_SHORT_EDGE;
    return {
      resolution_ok,
      blur_ok: true, // heuristic placeholder
      duplicate,
      vehicle_detected: resolution_ok, // heuristic placeholder
      width: m.width,
      height: m.height,
    };
  });
}

export function validationPasses(v: ImageValidation): boolean {
  return v.resolution_ok && v.blur_ok && !v.duplicate && v.vehicle_detected;
}

export const VALIDATION_CHECKS: { key: keyof ImageValidation; label: string }[] = [
  { key: "resolution_ok", label: "Resolution" },
  { key: "blur_ok", label: "Blur detection" },
  { key: "duplicate", label: "Duplicate detection" },
  { key: "vehicle_detected", label: "Vehicle detection" },
];
