-- Personnel roster + reviewer identity.
-- The role-only persona model (a `demo_role` cookie + reviews.reviewer_role) can't
-- attribute work to a person, so per-adjuster stats are impossible. This adds a named
-- roster and ties every review to the individual who made it.

create table personnel (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       review_role not null,          -- adjuster | senior_adjuster | ops_leader
  title      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Each review now records WHO made it (nullable; reviewer_role kept for back-compat).
alter table reviews add column reviewer_id uuid references personnel(id);
create index idx_reviews_reviewer on reviews (reviewer_id);

-- RLS: anon/authenticated read (writes are service-role only), mirroring 0001_init.sql.
alter table personnel enable row level security;
create policy personnel_anon_read on personnel for select to anon, authenticated using (true);

-- ── Roster (fixed UUIDs — kept in sync with lib/personnel.ts) ─────────────────
insert into personnel (id, name, role, title) values
  ('11111111-1111-1111-1111-111111111101','Maya Chen','adjuster','Claims Adjuster'),
  ('11111111-1111-1111-1111-111111111102','Daniel Osei','adjuster','Claims Adjuster'),
  ('11111111-1111-1111-1111-111111111103','Sofia Marchetti','adjuster','Claims Adjuster'),
  ('11111111-1111-1111-1111-111111111104','Ravi Patel','adjuster','Claims Adjuster'),
  ('22222222-2222-2222-2222-222222222201','Theo Park','senior_adjuster','Senior Adjuster'),
  ('22222222-2222-2222-2222-222222222202','Grace Whitfield','senior_adjuster','Senior Adjuster'),
  ('33333333-3333-3333-3333-333333333301','Priya Nair','ops_leader','Operations Leader')
on conflict (id) do nothing;
