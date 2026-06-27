import type { Finding, Severity } from "./types";

/**
 * Repair Cost Service. The vision model never invents dollar amounts; it
 * returns components + severity, and this deterministic table maps those to a
 * $ range. Mirrors the `repair_prices` table (supabase/seed.sql) and is used
 * as a fallback when the DB rows aren't passed in.
 */
export interface PriceRow {
  component: string;
  severity: Severity;
  cost_low: number;
  cost_high: number;
}

const COMPONENT_KEYWORDS: [string, RegExp][] = [
  ["bumper", /bumper/i],
  ["headlight", /head\s?light|head\s?lamp/i],
  ["taillight", /tail\s?light|tail\s?lamp|rear\s?light/i],
  ["hood", /hood|bonnet/i],
  ["fender", /fender|wing/i],
  ["door", /door/i],
  ["windshield", /windshield|windscreen|glass/i],
  ["grille", /grille|grill/i],
  ["mirror", /mirror/i],
  ["quarter_panel", /quarter\s?panel|rear\s?panel/i],
  ["wheel", /wheel|rim|tire|tyre/i],
];

/** Map a free-text component name to a priced category. */
export function normalizeComponent(name: string): string {
  for (const [key, re] of COMPONENT_KEYWORDS) if (re.test(name)) return key;
  return "generic";
}

const FALLBACK: PriceRow[] = [
  { component: "bumper", severity: "low", cost_low: 400, cost_high: 900 },
  { component: "bumper", severity: "medium", cost_low: 1200, cost_high: 2400 },
  { component: "bumper", severity: "high", cost_low: 2500, cost_high: 4500 },
  { component: "headlight", severity: "low", cost_low: 300, cost_high: 600 },
  { component: "headlight", severity: "medium", cost_low: 700, cost_high: 1400 },
  { component: "headlight", severity: "high", cost_low: 1500, cost_high: 2800 },
  { component: "taillight", severity: "low", cost_low: 250, cost_high: 500 },
  { component: "taillight", severity: "medium", cost_low: 600, cost_high: 1100 },
  { component: "taillight", severity: "high", cost_low: 1200, cost_high: 2200 },
  { component: "hood", severity: "low", cost_low: 400, cost_high: 800 },
  { component: "hood", severity: "medium", cost_low: 1000, cost_high: 2200 },
  { component: "hood", severity: "high", cost_low: 2500, cost_high: 5000 },
  { component: "fender", severity: "low", cost_low: 350, cost_high: 700 },
  { component: "fender", severity: "medium", cost_low: 900, cost_high: 1800 },
  { component: "fender", severity: "high", cost_low: 2000, cost_high: 3800 },
  { component: "door", severity: "low", cost_low: 500, cost_high: 1000 },
  { component: "door", severity: "medium", cost_low: 1200, cost_high: 2600 },
  { component: "door", severity: "high", cost_low: 2800, cost_high: 5500 },
  { component: "windshield", severity: "low", cost_low: 300, cost_high: 600 },
  { component: "windshield", severity: "medium", cost_low: 800, cost_high: 1400 },
  { component: "windshield", severity: "high", cost_low: 1500, cost_high: 2500 },
  { component: "grille", severity: "low", cost_low: 200, cost_high: 450 },
  { component: "grille", severity: "medium", cost_low: 500, cost_high: 1000 },
  { component: "grille", severity: "high", cost_low: 1100, cost_high: 2000 },
  { component: "mirror", severity: "low", cost_low: 150, cost_high: 350 },
  { component: "mirror", severity: "medium", cost_low: 400, cost_high: 800 },
  { component: "mirror", severity: "high", cost_low: 900, cost_high: 1600 },
  { component: "quarter_panel", severity: "low", cost_low: 600, cost_high: 1200 },
  { component: "quarter_panel", severity: "medium", cost_low: 1500, cost_high: 3000 },
  { component: "quarter_panel", severity: "high", cost_low: 3200, cost_high: 6500 },
  { component: "wheel", severity: "low", cost_low: 200, cost_high: 500 },
  { component: "wheel", severity: "medium", cost_low: 600, cost_high: 1200 },
  { component: "wheel", severity: "high", cost_low: 1300, cost_high: 2600 },
  { component: "generic", severity: "low", cost_low: 300, cost_high: 700 },
  { component: "generic", severity: "medium", cost_low: 900, cost_high: 1900 },
  { component: "generic", severity: "high", cost_low: 2200, cost_high: 4500 },
];

/**
 * Attach a per-finding cost band and return the aggregate range.
 * @param rows  optional DB pricing rows; falls back to the embedded table.
 */
export function priceFindings(
  findings: Finding[],
  rows?: PriceRow[],
): { findings: Finding[]; costLow: number; costHigh: number } {
  const table = rows && rows.length ? rows : FALLBACK;
  const lookup = (component: string, severity: Severity): PriceRow | undefined =>
    table.find((r) => r.component === component && r.severity === severity) ??
    table.find((r) => r.component === "generic" && r.severity === severity);

  let costLow = 0;
  let costHigh = 0;
  const priced = findings.map((f) => {
    const row = lookup(normalizeComponent(f.component), f.severity);
    const cl = row?.cost_low ?? 0;
    const ch = row?.cost_high ?? 0;
    costLow += cl;
    costHigh += ch;
    return { ...f, costLow: cl, costHigh: ch };
  });

  return { findings: priced, costLow, costHigh };
}
