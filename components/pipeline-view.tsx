"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Circle, X, ArrowRight, AlertTriangle } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { PIPELINE_STEPS } from "@/lib/pipeline";
import { Card, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PipelineStep, StepStatus } from "@/lib/types";

export function PipelineView({ claimId, claimNumber }: { claimId: string; claimNumber: string }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Record<string, PipelineStep>>({});
  const [phase, setPhase] = useState<"running" | "complete" | "failed">("running");
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);
  const done = useRef(false);
  // Snapshot of the steps present on mount, so the analyze response can read a
  // terminal status without racing the async React state update below.
  const loaded = useRef<Record<string, PipelineStep>>({});

  useEffect(() => {
    const supa = getBrowserClient();
    if (!supa) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external-system (Supabase) availability check
      setPhase("failed");
      setError("Supabase is not configured — set the env vars to run the pipeline.");
      return;
    }

    const finish = () => {
      if (done.current) return;
      done.current = true;
      setPhase("complete");
      setTimeout(() => router.push(`/claims/${claimId}`), 800);
    };

    // Initial load (covers a reconnect mid-run).
    supa
      .from("pipeline_steps")
      .select("*")
      .eq("claim_id", claimId)
      .order("ordinal")
      .then(({ data }: { data: PipelineStep[] | null }) => {
        if (data?.length) {
          const map = Object.fromEntries(data.map((s) => [s.step_key, s]));
          loaded.current = map;
          setSteps(map);
        }
      });

    const channel = supa.channel(`pipeline-${claimId}`);
    // supabase-js realtime overloads are awkward to satisfy in strict TS; the
    // payload shapes are annotated manually below.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    (channel as any)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_steps", filter: `claim_id=eq.${claimId}` },
        (payload: { new: PipelineStep }) => {
          const row = payload.new;
          setSteps((prev) => ({ ...prev, [row.step_key]: row }));
          if (row.status === "failed") {
            setPhase("failed");
            setError(row.detail || "A pipeline stage failed.");
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "assessments", filter: `claim_id=eq.${claimId}` },
        (payload: { new: { status: string; reasoning_summary?: string } }) => {
          if (payload.new.status === "complete") finish();
          else if (payload.new.status === "failed") {
            setPhase("failed");
            setError(payload.new.reasoning_summary || "Assessment failed.");
          }
        },
      )
      .subscribe();

    // Kick off the worker exactly once; the open request keeps the serverless
    // invocation alive while Realtime streams progress. Its resolution is also
    // a completion signal (covers any missed Realtime event).
    if (!triggered.current) {
      triggered.current = true;
      fetch(`/api/claims/${claimId}/analyze`, { method: "POST" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (r.ok && !j.already) finish();
          else if (r.ok && j.already) {
            // Worker already ran for this claim: if the assessment is already
            // terminal, no Realtime UPDATE will fire to resolve the spinner.
            // Settle from the steps snapshot loaded on mount; otherwise fall
            // back to redirecting after a short delay.
            const lastKey = PIPELINE_STEPS[PIPELINE_STEPS.length - 1].key;
            const snapshot = Object.values(loaded.current);
            if (snapshot.some((s) => s.status === "failed")) {
              setPhase("failed");
              setError("A pipeline stage failed.");
            } else if (loaded.current[lastKey]?.status === "complete") {
              finish();
            } else {
              setTimeout(() => {
                if (!done.current) router.push(`/claims/${claimId}`);
              }, 1500);
            }
          } else if (!r.ok) {
            setPhase("failed");
            setError(j.error || "Analysis failed.");
          }
        })
        .catch((e) => {
          setPhase("failed");
          setError(String(e));
        });
    }

    return () => {
      supa.removeChannel(channel);
    };
  }, [claimId, router]);

  return (
    <div>
      <PageHeader
        title="AI Assessment Pipeline"
        subtitle={`Claim ${claimNumber} · the pipeline is intentionally visible — the AI is not a black box`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-2 lg:col-span-2">
          <ol className="divide-y divide-slate-100">
            {PIPELINE_STEPS.map((def, i) => {
              const status: StepStatus = steps[def.key]?.status ?? "pending";
              const detail = steps[def.key]?.detail;
              return (
                <li key={def.key} className="flex items-center gap-4 px-4 py-4">
                  <StepIcon status={status} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        status === "complete"
                          ? "text-slate-900"
                          : status === "running"
                            ? "text-blue-700"
                            : status === "failed"
                              ? "text-red-700"
                              : "text-slate-400",
                      )}
                    >
                      {i + 1}. {def.label}
                    </p>
                    {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            {phase === "running" && (
              <div className="flex items-center gap-3 text-blue-700">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Processing assessment…</span>
              </div>
            )}
            {phase === "complete" && (
              <div className="flex items-center gap-3 text-emerald-700">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">Complete — opening results</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            )}
            {phase === "failed" && (
              <div className="flex items-start gap-3 text-red-700">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Assessment could not complete</p>
                  <p className="mt-1 text-xs text-red-600">{error}</p>
                  <button
                    onClick={() => router.push(`/claims/${claimId}`)}
                    className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View claim →
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs leading-relaxed text-slate-500">
              Each stage writes its status to Postgres; this screen subscribes via Supabase Realtime
              and animates as the worker progresses — the same queue-based pattern that scales to
              burst traffic in production.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "complete")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check className="h-4 w-4" />
      </span>
    );
  if (status === "running")
    return (
      <span className="pulse-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  if (status === "failed")
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
        <X className="h-4 w-4" />
      </span>
    );
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-300">
      <Circle className="h-3 w-3" />
    </span>
  );
}
