-- Seed: pricing table (the deterministic "Repair Cost Service") + a realistic
-- demo backlog so the dashboards/queue look live on first load.

-- ── Repair Cost Service pricing table ────────────────────────────────────────
insert into repair_prices (component, severity, cost_low, cost_high) values
  ('bumper','low',400,900),         ('bumper','medium',1200,2400),       ('bumper','high',2500,4500),
  ('headlight','low',300,600),      ('headlight','medium',700,1400),     ('headlight','high',1500,2800),
  ('taillight','low',250,500),      ('taillight','medium',600,1100),     ('taillight','high',1200,2200),
  ('hood','low',400,800),           ('hood','medium',1000,2200),         ('hood','high',2500,5000),
  ('fender','low',350,700),         ('fender','medium',900,1800),        ('fender','high',2000,3800),
  ('door','low',500,1000),          ('door','medium',1200,2600),         ('door','high',2800,5500),
  ('windshield','low',300,600),     ('windshield','medium',800,1400),    ('windshield','high',1500,2500),
  ('grille','low',200,450),         ('grille','medium',500,1000),        ('grille','high',1100,2000),
  ('mirror','low',150,350),         ('mirror','medium',400,800),         ('mirror','high',900,1600),
  ('quarter_panel','low',600,1200), ('quarter_panel','medium',1500,3000),('quarter_panel','high',3200,6500),
  ('wheel','low',200,500),          ('wheel','medium',600,1200),         ('wheel','high',1300,2600),
  ('generic','low',300,700),        ('generic','medium',900,1900),       ('generic','high',2200,4500)
on conflict (component, severity) do nothing;

-- ── Demo backlog (~412 claims for "today") ───────────────────────────────────
create temporary table _seed on commit drop as
select
  id, i, mi, created_at, conf, sev,
  case when conf >= 95 then 'standard'
       when conf >= 70 then 'enhanced'
       when rr < 0.5  then 'request_photos'
       else 'escalate' end                                            as routing,
  case sev when 'low' then 600 + floor(rc*400)::int
           when 'medium' then 1900 + floor(rc*700)::int
           else 4200 + floor(rc*2200)::int end                        as cost_low,
  case sev when 'low' then 1400 + floor(rc*700)::int
           when 'medium' then 3000 + floor(rc*900)::int
           else 6800 + floor(rc*3800)::int end                        as cost_high,
  case when conf < 70 then 'adjuster_review'
       when (i % 17) = 0 then 'senior_review'
       when (i % 29) = 0 then 'adjuster_review'
       else 'sent_to_repair' end                                      as status
from (
  select
    gen_random_uuid() as id, i, mi,
    now() - (random() * interval '13 hours')                          as created_at,
    case when r < 0.08 then 55 + floor(random()*14)::int
         when r < 0.30 then 70 + floor(random()*24)::int
         else 95 + floor(random()*4)::int end                         as conf,
    (array['low','medium','medium','high'])[1 + floor(random()*4)::int] as sev,
    random() as rr, random() as rc
  from (
    select i, random() as r, (1 + floor(random()*10))::int as mi
    from generate_series(1, 412) g(i)
  ) s
) x;

insert into claims (id, policy_number, claim_number, vin, customer_region, deployment_region,
                    vehicle_make, vehicle_model, vehicle_year, status, created_at)
select
  id,
  'POL-' || lpad(i::text, 6, '0'),
  (20000 + i)::text,
  upper(substr(md5(id::text), 1, 17)),
  (array['US-East','US-West','US-Central','EU-West','CA-East'])[1 + floor(random()*5)::int],
  (array['US','US','US','EU','Canada'])[1 + floor(random()*5)::int],
  (array['Toyota','Honda','Ford','Tesla','BMW','Chevrolet','Nissan','Hyundai','Subaru','Kia'])[mi],
  (array['Camry','Civic','F-150','Model Y','3 Series','Silverado','Altima','Elantra','Outback','Sorento'])[mi],
  2016 + floor(random()*9)::int,
  status::claim_status,
  created_at
from _seed;

insert into assessments (claim_id, status, severity, confidence, cost_low, cost_high, findings,
                         reasoning_summary, routing, model_provider, model_version, latency_ms,
                         created_at, completed_at)
select
  id, 'complete', sev::severity, conf,
  case when conf < 70 then null else cost_low end,
  case when conf < 70 then null else cost_high end,
  '[]'::jsonb,
  case when conf < 70 then 'Insufficient image coverage to localize damage with confidence.'
       else 'Damage localized with high agreement; estimate consistent with regional repair costs.' end,
  routing::routing_decision, 'gemini', 'gemini-2.5-flash',
  850 + floor(random()*700)::int, created_at, created_at + interval '4 seconds'
from _seed;

-- Reviews on completed claims → drives the live "human override rate" metric (~9%).
-- NOTE: the `case when random()...` is applied in an OUTER query over an already
-- sampled set. Do NOT fold it into a `select ... order by random() limit 60`:
-- a target-list random() combined with `order by random()` + LIMIT lets the
-- planner re-evaluate it against the sort key and badly skews the ratio.
insert into reviews (claim_id, reviewer_role, decision, created_at)
select claim_id, 'adjuster',
       case when random() < 0.09 then 'modify' else 'accept' end,
       created_at + interval '18 minutes'
from (
  select id as claim_id, created_at
  from _seed
  where status = 'sent_to_repair'
  order by random()
  limit 60
) sampled;

-- ── Three PRD-named claims with rich findings (recognizable in the queue) ─────

-- 10021 · Toyota Camry · 96% · Standard review · full audit trail
with c as (
  insert into claims (policy_number, claim_number, vin, accident_summary, customer_region,
                      deployment_region, vehicle_make, vehicle_model, vehicle_year, status, created_at)
  values ('POL-100021','10021','4T1BF1FK5HU123456','Low-speed front-end collision in a parking lot',
          'US-East','US','Toyota','Camry',2023,'adjuster_review', now() - interval '2 hours')
  returning id, created_at
),
a as (
  insert into assessments (claim_id, status, severity, confidence, cost_low, cost_high, findings,
                           reasoning_summary, routing, model_provider, model_version, latency_ms,
                           created_at, completed_at)
  select id, 'complete', 'medium', 96, 2850, 3600,
    '[{"component":"Front bumper","severity":"medium","confidence":96,"evidence":"Visible fracture pattern across the lower fascia","location":"Front-center bumper","costLow":1200,"costHigh":2400},
      {"component":"Headlight","severity":"medium","confidence":95,"evidence":"Lens fragmentation on the passenger side","location":"Front-right headlight","costLow":700,"costHigh":1400},
      {"component":"Hood","severity":"low","confidence":92,"evidence":"Shallow dent near the leading edge","location":"Hood, center","costLow":400,"costHigh":800}]'::jsonb,
    'Three damaged components localized with high agreement. Severity is moderate and the estimate is consistent with regional repair costs.',
    'standard','gemini','gemini-2.5-flash', 1100, created_at, created_at + interval '4 seconds'
  from c
)
insert into audit_log (claim_id, actor_role, action, detail, created_at)
select id, 'system','Claim Created','{}'::jsonb, created_at from c
union all select id,'system','Images Uploaded','{}'::jsonb, created_at + interval '2 minutes' from c
union all select id,'system','Validation Passed','{}'::jsonb, created_at + interval '2 minutes' from c
union all select id,'gemini','AI Assessment Completed','{"confidence":96}'::jsonb, created_at + interval '3 minutes' from c
union all select id,'adjuster','Adjuster Updated Severity','{}'::jsonb, created_at + interval '4 minutes' from c;

-- 10022 · Tesla Model Y · 62% · Low confidence → escalated
with c as (
  insert into claims (policy_number, claim_number, vin, accident_summary, customer_region,
                      deployment_region, vehicle_make, vehicle_model, vehicle_year, status, created_at)
  values ('POL-100022','10022','5YJYGDEE7MF123456','Side impact, partial photo coverage submitted',
          'US-West','US','Tesla','Model Y',2022,'adjuster_review', now() - interval '90 minutes')
  returning id, created_at
)
insert into assessments (claim_id, status, severity, confidence, cost_low, cost_high, findings,
                         reasoning_summary, routing, model_provider, model_version, latency_ms,
                         created_at, completed_at)
select id, 'complete', null, 62, null, null, '[]'::jsonb,
  'Insufficient image coverage. Unable to verify frame alignment or rule out structural damage — additional photos required before an estimate can be trusted.',
  'escalate','gemini','gemini-2.5-flash', 980, created_at, created_at + interval '4 seconds'
from c;

-- 10023 · Honda Civic · 88% · Enhanced review
with c as (
  insert into claims (policy_number, claim_number, vin, accident_summary, customer_region,
                      deployment_region, vehicle_make, vehicle_model, vehicle_year, status, created_at)
  values ('POL-100023','10023','19XFC2F50JE123456','Rear-end collision at a stop light',
          'US-Central','US','Honda','Civic',2021,'adjuster_review', now() - interval '70 minutes')
  returning id, created_at
)
insert into assessments (claim_id, status, severity, confidence, cost_low, cost_high, findings,
                         reasoning_summary, routing, model_provider, model_version, latency_ms,
                         created_at, completed_at)
select id, 'complete', 'medium', 88, 1900, 2600,
  '[{"component":"Rear bumper","severity":"medium","confidence":89,"evidence":"Cracked fascia with paint transfer","location":"Rear-center bumper","costLow":1200,"costHigh":2400},
    {"component":"Taillight","severity":"low","confidence":86,"evidence":"Hairline crack on the driver-side lens","location":"Rear-left taillight","costLow":250,"costHigh":500}]'::jsonb,
  'Rear damage localized with moderate-to-high confidence. Routed to enhanced review because overall confidence is below the 95% auto-standard threshold.',
  'enhanced','gemini','gemini-2.5-flash', 1040, created_at, created_at + interval '4 seconds'
from c;

-- ── Pipeline steps for every seeded assessment ───────────────────────────────
-- The 7 stages mirror lib/pipeline.ts (PIPELINE_STEPS), exactly as the analyze
-- worker writes them. Without these, the Realtime pipeline screen renders empty
-- for seeded claims. Steps are stamped 'complete' and spread evenly across each
-- assessment's created_at → completed_at window so the timeline looks authentic.
insert into pipeline_steps
  (assessment_id, claim_id, ordinal, step_key, label, status, detail, started_at, completed_at)
select
  a.id, a.claim_id, s.ordinal, s.step_key, s.label, 'complete',
  case s.ordinal
    when 1 then 'Resolution, blur & duplicate checks passed'
    when 2 then 'Vehicle detected in frame'
    when 3 then case when a.severity is not null
                     then 'Damage localized; severity ' || a.severity::text
                     else 'No damage localized with confidence' end
    when 4 then 'Overall severity: ' || coalesce(a.severity::text, 'n/a')
    when 5 then case when a.cost_low is not null
                     then '$' || to_char(a.cost_low, 'FM999,999') || '–$' || to_char(a.cost_high, 'FM999,999')
                     else 'No estimate (insufficient findings)' end
    when 6 then 'Evidence & reasoning generated'
    when 7 then round(a.confidence)::text || '% → ' || coalesce(a.routing::text, 'escalate')
  end,
  a.created_at + (coalesce(a.completed_at, a.created_at + interval '4 seconds') - a.created_at) * ((s.ordinal - 1) / 7.0),
  a.created_at + (coalesce(a.completed_at, a.created_at + interval '4 seconds') - a.created_at) * (s.ordinal / 7.0)
from assessments a
cross join (values
  (1,'validate_images','Validate Images'),
  (2,'detect_vehicle','Detect Vehicle'),
  (3,'locate_damage','Locate Damage'),
  (4,'classify_severity','Estimate Severity'),
  (5,'estimate_cost','Calculate Cost'),
  (6,'generate_explanation','Generate Explanation'),
  (7,'confidence_score','Confidence Score')
) as s(ordinal, step_key, label)
where a.status = 'complete'
  and not exists (select 1 from pipeline_steps p where p.assessment_id = a.id);
