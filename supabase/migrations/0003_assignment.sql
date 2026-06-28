-- Claim ownership: give every claim an OWNER (an adjuster).
-- 0002 added a named roster + after-the-fact review attribution (reviews.reviewer_id);
-- this closes the loop by assigning each claim to the adjuster responsible for it,
-- so the queue can become a personalized, triaged worklist instead of one global
-- reverse-chronological table.
--
-- Model: only the four Claims Adjusters are assignees. Senior approval stays a
-- SHARED pool keyed on status='senior_review', and the Operations Leader sees
-- everything — neither needs a per-claim owner.

alter table claims add column assigned_to uuid references personnel(id);
create index idx_claims_assigned on claims (assigned_to);

-- Backfill EXISTING claims deterministically across the four adjusters, reusing the
-- row_number() % 4 bucketing idiom from seed.sql. On a fresh `supabase db reset` the
-- table is empty at this point (migrations run before seed.sql, which sets
-- assigned_to itself), so this no-ops; it only matters for a database that already
-- holds claims when this migration is applied.
with numbered as (
  select id, (row_number() over (order by created_at))::int % 4 as bucket
  from claims
  where assigned_to is null
)
update claims c
set assigned_to = adj.id
from numbered n
join (values
  (0, '11111111-1111-1111-1111-111111111101'::uuid),  -- Maya Chen
  (1, '11111111-1111-1111-1111-111111111102'::uuid),  -- Daniel Osei
  (2, '11111111-1111-1111-1111-111111111103'::uuid),  -- Sofia Marchetti
  (3, '11111111-1111-1111-1111-111111111104'::uuid)   -- Ravi Patel
) adj(bucket, id) on adj.bucket = n.bucket
where c.id = n.id;
