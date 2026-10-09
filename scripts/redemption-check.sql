-- Fingerprint of everything data/redemption-data.json is built from, computed live in Supabase (read-only).
-- scripts/check-data-drift.mjs compares this with the same totals computed from the shipped file.
-- $1 = text[] of the card ids the tools use (calculator + recommender), so the redemption-values total
-- is limited to those cards, exactly as the shipped file is.
--
-- It uses the same rules as scripts/redemption-data.sql: award_price_current for the four charted
-- programmes, transfer rules for every published airline and hotel route (card-specific beats currency-level),
-- and the bank redemption modes.
with prog(id) as (values ('krisflyer'), ('maharaja_club'), ('finnair_plus'), ('wyndham_rewards')),
charts as (
  select a.programme_id, count(*) n, sum(a.units) units,
         max(coalesce(a.effective_from, a.observed_at::date)) as_of
  from corpus.award_price_current a join prog on prog.id = a.programme_id
  where a.award_type in ('standard', 'star_alliance_partner') and a.units is not null
  group by 1
),
xf_all as (
  select c.id card_id, t.programme_id, t.min_units, t.multiple_units, t.processing_max_hours, t.cap_units,
         (t.card_id is not null) spec, cc.is_primary
  from corpus.card c
  join corpus.card_currency cc on cc.card_id = c.id
  join corpus.transfer_partner t on t.state = 'published' and t.ratio_state = 'published' and t.from_units > 0 and t.to_units > 0
       and (t.card_id = c.id or (t.card_id is null and t.currency_id = cc.currency_id))
  join corpus.loyalty_programme lp on lp.id = t.programme_id and lp.kind in ('airline', 'hotel')
  where c.status <> 'withdrawn' and c.id not in ('icici:pre-approved-credit-card', 'icici:tnc-for-governing-credit-card')
),
xf as (select distinct on (card_id, programme_id) * from xf_all order by card_id, programme_id, spec desc, is_primary desc),
-- the shipped file only keeps routes that carry at least one rule, so count the same rows
xf_kept as (select * from xf where min_units is not null or multiple_units is not null or processing_time_text is not null or processing_max_hours is not null or cap_units is not null),
mv as (
  select distinct on (c.id, v.mode) c.id card_id, v.mode, v.inr_per_unit
  from corpus.card c
  join corpus.card_currency cc on cc.card_id = c.id and cc.is_primary
  join corpus.valuation v on v.currency_id = cc.currency_id and (v.card_id = c.id or v.card_id is null)
  where c.status not in ('withdrawn', 'legacy') and c.id = any($1::text[])
    and v.mode in ('statement_credit', 'voucher', 'flight', 'hotel', 'merchandise', 'points_plus_pay', 'blended')
  order by c.id, v.mode, (v.card_id is null), v.as_of_month desc
)
select jsonb_build_object(
  'charts', (select coalesce(jsonb_object_agg(programme_id, jsonb_build_object('rows', n, 'units', units, 'asOf', as_of)), '{}'::jsonb) from charts),
  'xfer', (select jsonb_build_object('rows', count(*), 'cards', count(distinct card_id),
             'min', coalesce(sum(min_units), 0), 'multiple', coalesce(sum(multiple_units), 0),
             'hours', coalesce(sum(processing_max_hours), 0), 'cap', coalesce(sum(cap_units), 0)) from xf_kept),
  'modes', (select jsonb_build_object('cards', count(distinct card_id), 'modes', count(*), 'sum', coalesce(round(sum(inr_per_unit), 4), 0)) from mv)
) as redemption_check;
