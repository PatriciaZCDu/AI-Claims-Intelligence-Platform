-- Scale AI Claims Intelligence Platform — schema
-- Read path is exposed to the anon role (RLS "anon read") so the browser can
-- subscribe to Realtime; every write happens server-side via the service role.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type claim_status as enum (
  'intake','validated','processing','assessed',
  'adjuster_review','senior_review','approved','sent_to_repair','rejected'
);
create type assessment_status as enum ('queued','processing','complete','failed');
create type severity as enum ('low','medium','high');
create type routing_decision as enum ('standard','enhanced','request_photos','escalate');
create type review_role as enum ('adjuster','senior_adjuster','ops_leader');
create type step_status as enum ('pending','running','complete','failed');

-- ── Tables ───────────────────────────────────────────────────────────────────
create table claims (
  id                uuid primary key default gen_random_uuid(),
  policy_number     text not null,
  claim_number      text not null,
  vin               text,
  accident_summary  text,
  customer_region   text not null default 'US-East',
  deployment_region text not null default 'US',
  vehicle_make      text,
  vehicle_model     text,
  vehicle_year      int,
  status            claim_status not null default 'intake',
  created_at        timestamptz not null default now()
);

create table claim_images (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references claims(id) on delete cascade,
  kind         text not null,                       -- front | rear | side | damage
  storage_path text not null,
  validation   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table assessments (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references claims(id) on delete cascade,
  status            assessment_status not null default 'queued',
  severity          severity,
  confidence        numeric,                         -- 0–100
  cost_low          int,
  cost_high         int,
  findings          jsonb not null default '[]'::jsonb,
  reasoning_summary text,
  routing           routing_decision,
  model_provider    text,
  model_version     text,
  latency_ms        int,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create table pipeline_steps (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  claim_id      uuid not null references claims(id) on delete cascade,  -- denormalized for Realtime filtering
  ordinal       int not null,
  step_key      text not null,
  label         text not null,
  status        step_status not null default 'pending',
  detail        text,
  started_at    timestamptz,
  completed_at  timestamptz
);

create table reviews (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references claims(id) on delete cascade,
  reviewer_role     review_role not null,
  decision          text not null,                   -- accept | modify | escalate | approve | request_revision | request_photos
  adjuster_estimate int,
  variance          numeric,
  notes             text,
  modified_findings jsonb,
  created_at        timestamptz not null default now()
);

create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  claim_id   uuid not null references claims(id) on delete cascade,
  actor_role text not null,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table repair_prices (
  id        uuid primary key default gen_random_uuid(),
  component text not null,
  severity  severity not null,
  cost_low  int not null,
  cost_high int not null,
  unique (component, severity)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index idx_claims_status      on claims (status);
create index idx_claims_created      on claims (created_at desc);
create index idx_assessments_claim   on assessments (claim_id);
create index idx_steps_claim_ordinal on pipeline_steps (claim_id, ordinal);
create index idx_audit_claim_created on audit_log (claim_id, created_at);
create index idx_reviews_claim       on reviews (claim_id);

-- ── RLS: anon read everywhere; writes are service-role only (bypasses RLS) ────
do $$
declare t text;
begin
  foreach t in array array[
    'claims','claim_images','assessments','pipeline_steps','reviews','audit_log','repair_prices'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true);',
      t || '_anon_read', t
    );
  end loop;
end $$;

-- ── Realtime: stream pipeline progress + assessment status to the browser ─────
alter publication supabase_realtime add table pipeline_steps;
alter publication supabase_realtime add table assessments;

-- ── Storage bucket for uploaded damage photos (public read for the demo) ──────
insert into storage.buckets (id, name, public)
values ('claim-images', 'claim-images', true)
on conflict (id) do nothing;
