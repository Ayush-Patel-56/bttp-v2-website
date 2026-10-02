-- Produces the single JSON document served at /data/calculator-data.json
-- (read-only; run against the Supabase project, save the one-cell result as the file).
--
-- Rules applied here so the browser stays dumb:
--   * cards      : corpus.card that is not 'withdrawn' and has >= 1 usable route
--   * routes     : corpus.transfer_partner, state = 'published' AND ratio_state = 'published'
--                  AND from_units/to_units > 0, to an airline or hotel programme
--   * scope      : card-specific rows (card_id set) win over currency-level rows
--                  (card_id null, matched through corpus.card_currency)
--   * ratio      : from_units card points -> to_units partner points; reduced by gcd when integral
--   * flag "up"  : ratio_is_ceiling (published as "up to")
with usable as (
  select c.id as card_id, c.issuer_id, c.name as card_name,
         t.programme_id, t.from_units, t.to_units, t.ratio_is_ceiling,
         (t.card_id is not null) as is_specific, cc.is_primary, cc.currency_id
  from corpus.card c
  join corpus.card_currency cc on cc.card_id = c.id
  join corpus.transfer_partner t
    on t.state = 'published' and t.ratio_state = 'published'
   and t.from_units > 0 and t.to_units > 0
   and (t.card_id = c.id or (t.card_id is null and t.currency_id = cc.currency_id))
  join corpus.loyalty_programme lp on lp.id = t.programme_id and lp.kind in ('airline', 'hotel')
  where c.status <> 'withdrawn'
    -- crawler rows that are not real cards (found in the Oct 2026 audit)
    and c.id not in ('icici:pre-approved-credit-card', 'icici:tnc-for-governing-credit-card')
),
best as (
  select distinct on (card_id, programme_id) *
  from usable
  order by card_id, programme_id, is_specific desc, is_primary desc
),
norm as (
  select b.*,
    case when b.from_units = round(b.from_units) and b.to_units = round(b.to_units)
         then gcd(b.from_units::bigint, b.to_units::bigint) else 1 end as g
  from best b
),
primary_cur as (
  select distinct on (cc.card_id) cc.card_id, rc.label
  from corpus.card_currency cc join corpus.reward_currency rc on rc.id = cc.currency_id
  order by cc.card_id, cc.is_primary desc
),
cards as (
  select n.card_id, n.issuer_id, n.card_name, pc.label as currency_label,
         jsonb_agg(jsonb_build_array(n.programme_id, trim_scale(n.from_units / n.g), trim_scale(n.to_units / n.g),
                                     case when n.ratio_is_ceiling then 1 else 0 end)
                   order by lp.kind, lp.label) as routes
  from norm n
  join corpus.loyalty_programme lp on lp.id = n.programme_id
  left join primary_cur pc on pc.card_id = n.card_id
  group by n.card_id, n.issuer_id, n.card_name, pc.label
)
select jsonb_build_object(
  'generatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'banks', (select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) order by i.name)
            from corpus.issuer i where i.id in (select issuer_id from cards)),
  'partners', (select jsonb_object_agg(lp.id, jsonb_build_object('n', lp.label, 'k', lp.kind))
               from corpus.loyalty_programme lp where lp.id in (select programme_id from norm)),
  'cards', (select jsonb_agg(jsonb_build_object('id', card_id, 'n', card_name, 'b', issuer_id,
                                                'c', currency_label, 'r', routes)
                             order by issuer_id, card_name) from cards)
) as calculator_data;
