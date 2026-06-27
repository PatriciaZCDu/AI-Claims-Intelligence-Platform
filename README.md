# Scale AI Claims Intelligence Platform

**AI-assisted vehicle damage assessment for insurance carriers.** A working
proof-of-concept that augments claim adjusters: customers upload damage photos, a
vision model produces a *structured, explainable* assessment, a deterministic
pricing service turns that into a repair-cost range, and confidence-based routing
keeps a human accountable for every financial decision.

> The thesis is **safe enterprise AI**: confidence routing, explainability,
> human-in-the-loop review, audit trails, and model ops — the architecture *is*
> the product. _"AI does not replace the claims adjuster. It turns the adjuster
> into a higher-leverage decision maker."_

## What's real vs. presentational

| Capability | Status |
|---|---|
| Photo upload + AI Readiness Validation (resolution / blur / duplicate / vehicle) | **Real** — runs in the browser before any inference |
| Vision damage assessment → structured findings (component, severity, confidence, evidence) | **Real** — via a swappable provider adapter |
| Async pipeline with live progress | **Real** — stages write to Postgres; UI animates via Supabase **Realtime** |
| Repair Cost Service (deterministic $ range) | **Real** — code-backed pricing table; the model never invents dollars |
| Confidence-based routing (≥95 standard · 70–95 enhanced · <70 request photos / escalate) | **Real** |
| Adjuster review, senior approval (AI-vs-adjuster variance), append-only audit trail | **Real** |
| Command Center / Claims Queue / Model Ops dashboards | **Real** — live aggregates (override rate, latency computed from data) |
| Precision / recall on Model Ops | **Monitored values** — a POC has no labeled ground truth (see *Honest boundaries*) |
| Continuous Learning loop | **Presentational** — describes the production feedback process |

## Architecture

```
Create Claim (form + photo upload → Supabase Storage)
   ↓ AI Readiness Validation (resolution · blur · duplicate · vehicle)
POST /api/claims/[id]/analyze  → enqueues assessment + 7 pipeline_steps
   ↓ worker runs the stages inline, writing each step's status as it goes
validate → detect vehicle → locate damage → severity
   → cost (deterministic) → explanation → confidence
   ↓ each write → Supabase Realtime → pipeline screen animates live
Assessment: findings + severity + confidence + evidence + cost + model version
   ↓ Confidence Engine → routing
Adjuster Review → Senior Approval → Sent to Repair    (every step → audit_log)
```

The **AI provider is abstracted** behind a `DamageAssessor` interface
(`lib/ai/`). Swapping Gemini ↔ Claude ↔ OpenAI is one env var — no vendor
lock-in, and you can A/B providers on the same photos.

### Stack
- **Next.js 16** (App Router, TypeScript) + Tailwind v4 — deploy on **Vercel**
- **Supabase** — Postgres, Storage, Realtime, RLS
- **AI** — Google Gemini Flash (default), with Claude & OpenAI adapters

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in values (see below)
```

The app **boots with zero keys** in `mock` AI mode (deterministic offline
assessments) so you can explore immediately:

```bash
npm run dev        # http://localhost:3000
```

To make it fully live, configure Supabase + a model key in `.env.local`:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `AI_PROVIDER` | `gemini` \| `claude` \| `openai` \| `mock` |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional, for the adapter swap |

Load the schema + demo backlog (~412 seeded claims, plus the three PRD sample
claims 10021 / 10022 / 10023):

```bash
# Local Supabase:
supabase start && supabase db reset
# Hosted Supabase project:
supabase link --project-ref <ref> && supabase db push   # then run supabase/seed.sql in the SQL editor
```

> **Realtime:** the pipeline animation needs Realtime enabled on `pipeline_steps`
> and `assessments`. Migration `0001_init.sql` adds them to the `supabase_realtime`
> publication automatically.

## Demo flow

1. **Command Center** (`/`) — KPIs + platform health on first load.
2. **Create Claim** (`/claims/new`) — fill the form, upload a photo, watch the
   validation gate, hit **Analyze**.
3. **Pipeline** — the 7 stages animate **live** via Realtime.
4. **Assessment** — structured findings, evidence, confidence, cost, routing.
   Try a blurry/partial photo (or the seeded Tesla 10022) to see the
   **low-confidence → request photos / escalate** path.
5. **Adjuster Review** → modify a finding (counts toward override rate) →
   **Senior Approval** shows AI-vs-adjuster **variance** → approve.
6. **Audit Trail** — the full transition timeline.
7. **Role switcher** (top bar) — RBAC enforced server-side; a Senior Adjuster
   sees the approval action an Adjuster doesn't.
8. **Swap providers** — set `AI_PROVIDER=claude` (+ key), re-run a claim: same
   UX, different model. That's the abstraction.

## Deploy

- **Vercel** — import the repo, add the env vars above. (Turbopack build is the
  default in Next 16.)
- **Supabase** — create a project, run the migration + seed, copy the keys into
  Vercel. Add your deployed Vercel origin to Supabase's allowed origins.

## Honest boundaries (production evolution)

- **Precision/recall** need labeled ground truth a POC lacks — shown as
  monitored values, not fabricated. Production: a continuous-evaluation set.
- **Async worker** runs inline on Vercel (reliable + live via Realtime).
  Production: a Supabase Edge Function queue worker with retries + horizontal
  scale.
- **Auth** is a demo role switcher; production: Supabase Auth + RLS-per-role +
  enterprise SSO.
- **Data residency** (US/EU/Canada) is captured + displayed; production:
  region-pinned Supabase projects per residency zone.
- **Blur / vehicle detection** are heuristic placeholders; production: a
  Laplacian-variance check and a detector model.
