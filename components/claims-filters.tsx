"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

const FILTERS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: "status",
    label: "Status",
    options: [
      { value: "", label: "All statuses" },
      { value: "adjuster_review", label: "Adjuster review" },
      { value: "senior_review", label: "Senior review" },
      { value: "approved", label: "Approved" },
      { value: "sent_to_repair", label: "Sent to repair" },
      { value: "rejected", label: "Rejected" },
      { value: "processing", label: "Processing" },
    ],
  },
  {
    key: "confidence",
    label: "Confidence",
    options: [
      { value: "", label: "Any confidence" },
      { value: "high", label: "High (≥95%)" },
      { value: "medium", label: "Medium (70–95%)" },
      { value: "low", label: "Low (<70%)" },
    ],
  },
  {
    key: "routing",
    label: "Routing",
    options: [
      { value: "", label: "Any routing" },
      { value: "escalate", label: "Escalate" },
      { value: "request_photos", label: "Request photos" },
      { value: "enhanced", label: "Enhanced review" },
      { value: "standard", label: "Standard" },
    ],
  },
  {
    key: "severity",
    label: "Severity",
    options: [
      { value: "", label: "Any severity" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
  {
    key: "region",
    label: "Region",
    options: [
      { value: "", label: "All regions" },
      { value: "US", label: "US" },
      { value: "EU", label: "EU" },
      { value: "Canada", label: "Canada" },
    ],
  },
];

export function ClaimsFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/claims?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <Select
          key={f.key}
          aria-label={f.label}
          value={sp.get(f.key) ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
          className="bg-white py-1.5 text-slate-700"
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}
    </div>
  );
}
