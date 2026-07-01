"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check, X } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { evaluateImages, validationPasses, type ImageMeta } from "@/lib/validation";

type Kind = "front" | "rear" | "side" | "damage";
const KINDS: Kind[] = ["front", "rear", "side", "damage"];

interface Pic {
  file: File;
  url: string;
  meta: ImageMeta;
}

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}

export function NewClaimForm() {
  const router = useRouter();
  const [pics, setPics] = useState<Partial<Record<Kind, Pic>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    policy_number: "",
    claim_number: "",
    vin: "",
    accident_summary: "",
    customer_region: "US",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
  });

  // Prefill identifiers so a demo can go straight to "Analyze". Done in an
  // effect (not a lazy initializer) so the random values are generated only on
  // the client and never cause an SSR hydration mismatch.
  useEffect(() => {
    const n = Math.floor(10000 + Math.random() * 89999);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only prefill
    setFields((f) => ({
      ...f,
      policy_number: `POL-${100000 + n}`,
      claim_number: String(30000 + n),
    }));
  }, []);

  async function onPick(kind: Kind, file: File | undefined) {
    if (!file) return;
    const [meta, dims] = await Promise.all([
      hashFile(file).then((hash) => ({ hash })),
      readDims(file),
    ]);
    const full: ImageMeta = { kind, hash: meta.hash, width: dims.width, height: dims.height };
    setPics((p) => ({ ...p, [kind]: { file, url: URL.createObjectURL(file), meta: full } }));
  }

  const metas = useMemo(
    () => Object.values(pics).map((p) => p!.meta),
    [pics],
  );
  const validations = useMemo(() => evaluateImages(metas), [metas]);

  // Aggregate the per-image validations into the four PRD checks.
  const checks = useMemo(() => {
    const has = validations.length > 0;
    return [
      { label: "Resolution", ok: has && validations.every((v) => v.resolution_ok) },
      { label: "Blur detection", ok: has && validations.every((v) => v.blur_ok) },
      { label: "Duplicate detection", ok: has && validations.every((v) => !v.duplicate) },
      { label: "Vehicle detection", ok: has && validations.every((v) => v.vehicle_detected) },
    ];
  }, [validations]);

  const allValid = validations.length > 0 && validations.every(validationPasses);

  function set<K extends keyof typeof fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function analyze() {
    setError(null);
    if (!fields.policy_number || !fields.claim_number) {
      setError("Policy number and claim number are required.");
      return;
    }
    setBusy(true);
    try {
      const created = await fetch("/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      const cj = await created.json();
      if (!created.ok) throw new Error(cj.error || "Failed to create claim");
      const id = cj.id as string;

      const ordered = Object.values(pics).filter(Boolean) as Pic[];
      if (ordered.length) {
        const fd = new FormData();
        fd.set("meta", JSON.stringify(ordered.map((p) => p.meta)));
        ordered.forEach((p, i) => fd.set(`file_${i}`, p.file));
        const up = await fetch(`/api/claims/${id}/images`, { method: "POST", body: fd });
        if (!up.ok) {
          const uj = await up.json().catch(() => ({}));
          throw new Error(uj.error || "Image upload failed");
        }
      }

      router.push(`/claims/${id}/pipeline`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Claim intake" subtitle="Policy & accident details" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label="Policy Number" value={fields.policy_number} onChange={(v) => set("policy_number", v)} />
            <Field label="Claim Number" value={fields.claim_number} onChange={(v) => set("claim_number", v)} />
            <Field label="VIN" value={fields.vin} onChange={(v) => set("vin", v)} />
            <div>
              <FieldLabel>Customer Region</FieldLabel>
              <select
                value={fields.customer_region}
                onChange={(e) => set("customer_region", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {["US", "EU", "Canada"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel>Accident Summary</FieldLabel>
              <textarea
                value={fields.accident_summary}
                onChange={(e) => set("accident_summary", e.target.value)}
                rows={2}
                placeholder="e.g. Low-speed front-end collision in a parking lot"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <Field label="Vehicle Make" value={fields.vehicle_make} onChange={(v) => set("vehicle_make", v)} />
            <Field label="Vehicle Model" value={fields.vehicle_model} onChange={(v) => set("vehicle_model", v)} />
            <Field label="Vehicle Year" value={fields.vehicle_year} onChange={(v) => set("vehicle_year", v)} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Upload photos" subtitle="Front · Rear · Side · Damage" />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            {KINDS.map((kind) => (
              <label
                key={kind}
                className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400"
              >
                {pics[kind] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pics[kind]!.url} alt={kind} className="h-full w-full object-cover" />
                ) : (
                  <>
                    <Camera className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                    <span className="mt-1 text-xs font-medium capitalize text-slate-500">{kind}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPick(kind, e.target.files?.[0])}
                />
              </label>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="AI Readiness Validation" subtitle="Run before any model inference" />
          <div className="divide-y divide-slate-100">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-600">{c.label}</span>
                {c.ok ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <X className="h-4 w-4 text-slate-300" />
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 p-4">
            {validations.length === 0 ? (
              <p className="text-xs text-slate-400">
                No photos yet. In <strong>mock</strong> mode you can still run the pipeline without images.
              </p>
            ) : allValid ? (
              <p className="text-xs text-emerald-600">All checks passed — ready for AI assessment.</p>
            ) : (
              <p className="text-xs text-amber-600">
                Some checks failed — production would request additional photos. You can still proceed.
              </p>
            )}
          </div>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <p className="p-4 text-sm text-red-700">{error}</p>
          </Card>
        )}

        <Button onClick={analyze} disabled={busy} className="w-full py-2.5">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Analyze"
          )}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>;
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}
