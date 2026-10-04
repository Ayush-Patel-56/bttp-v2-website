-- Produces the JSON served at /data/recommender-data.json (read-only).
-- Transfer partners are NOT here: the recommender reads them from calculator-data.json.
--
-- Normalised units: every earn rate is "points per Rs 100 spent".
--   earn {points, per_amount}  -> points * 100 / per_amount
--   earn {pct}                 -> pct   (percent back; 1 point = Rs 1 for cashback currencies)
--   earn {same_as}             -> skipped (rate defined by reference; treated as not published)
--   multiplier {x}             -> base * x
-- Only unconditional rules count: a category rule must have `category` as its ONLY predicate key,
-- and base/annual-fee rules must have an empty predicate. Timing/channel/merchant-limited rules are
-- left out so the estimate never overstates what a typical swipe earns.
--
-- 'v' is Rs per point from corpus.valuation, using the conservative cash-like modes only:
--   card-specific statement_credit > currency-level statement_credit > card-specific voucher > currency-level voucher
--   (latest as_of_month). It is a baseline, not a transfer value. Cards without one have no 'v'.
--
-- Category groups shown in the UI -> spend_category ids in the data:
--   travel -> travel | dining -> dining, food_delivery | shopping -> ecom, departmental_store
--   groceries -> grocery | fuel -> fuel | bills -> utility, telecom, insurance
--   entertainment -> entertainment, movies
with cat_map(spend_category, grp) as (values
  ('travel','travel'),('dining','dining'),('food_delivery','dining'),('ecom','shopping'),('departmental_store','shopping'),
  ('grocery','groceries'),('fuel','fuel'),('utility','bills'),('telecom','bills'),('insurance','bills'),
  ('entertainment','entertainment'),('movies','entertainment')
),
rules as (
  select * from corpus.card_earn_rule where superseded_at is null and (effective_to is null or effective_to >= current_date)
),
base as (
  select distinct on (card_id) card_id, currency_id,
         case when e ? 'points' and (e->>'per_amount')::numeric > 0 then (e->>'points')::numeric * 100 / (e->>'per_amount')::numeric
              when e ? 'pct' then (e->>'pct')::numeric end as ppc
  from (select card_id, effect e, effect->>'currency_id' currency_id from rules
        where rule_type = 'base' and predicate = '{}'::jsonb and effect->>'type' = 'earn' and not (effect ? 'same_as')) r
  where (e ? 'points' and (e->>'per_amount')::numeric > 0) or e ? 'pct'
  order by card_id
),
cat_rules as (
  select r.card_id,
         jsonb_array_elements_text(case when jsonb_typeof(r.predicate->'category') = 'object' then r.predicate->'category'->'in'
                                        else jsonb_build_array(r.predicate->>'category') end) as spend_category,
         case when r.effect->>'type' = 'earn' and r.effect ? 'points' and (r.effect->>'per_amount')::numeric > 0
                then (r.effect->>'points')::numeric * 100 / (r.effect->>'per_amount')::numeric
              when r.effect->>'type' = 'earn' and r.effect ? 'pct' then (r.effect->>'pct')::numeric
              when r.effect->>'type' = 'multiplier' and r.effect ? 'x' and not (r.effect ? 'relative_to') and not (r.effect ? 'rate_basis') then b.ppc * (r.effect->>'x')::numeric
         end as ppc
  from rules r left join base b on b.card_id = r.card_id
  where r.rule_type = 'multiplier' and r.predicate ? 'category'
    and (select count(*) from jsonb_object_keys(r.predicate)) = 1
),
cat_best as (
  select cr.card_id, m.grp, max(cr.ppc) as ppc
  from cat_rules cr join cat_map m on m.spend_category = cr.spend_category
  where cr.ppc is not null group by 1, 2
),
cat_json as (
  select card_id, jsonb_object_agg(grp, round(ppc, 2)) as cats from cat_best group by 1
),
fee as (
  select distinct on (card_id) card_id, (effect->>'amount')::numeric as amount
  from rules
  where rule_type = 'fee' and effect->>'fee_kind' = 'annual' and effect ? 'amount' and predicate = '{}'::jsonb
  order by card_id, precedence nulls last
),
terms as (
  select card_id,
         bool_or(term_type = 'lounge') as lounge, bool_or(term_type = 'golf') as golf,
         bool_or(term_type = 'concierge') as concierge, bool_or(term_type = 'membership') as membership,
         bool_or(term_type = 'welcome') as welcome
  from corpus.card_product_term
  where superseded_at is null and term_type in ('lounge', 'golf', 'concierge', 'membership', 'welcome')
  group by 1
),
cur as (
  select distinct on (cc.card_id) cc.card_id, rc.label from corpus.card_currency cc
  join corpus.reward_currency rc on rc.id = cc.currency_id order by cc.card_id, cc.is_primary desc
),
val as (
  select distinct on (c.id) c.id as card_id, v.inr_per_unit
  from corpus.card c
  join corpus.card_currency cc on cc.card_id = c.id and cc.is_primary
  join corpus.valuation v on v.currency_id = cc.currency_id and (v.card_id = c.id or v.card_id is null)
                          and v.mode in ('statement_credit', 'voucher')
  order by c.id,
           (case when v.card_id = c.id then 0 else 10 end) + (case v.mode when 'statement_credit' then 0 else 1 end),
           v.as_of_month desc
),
cand as (
  select c.id, c.issuer_id, c.name, c.status
  from corpus.card c
  where c.status not in ('withdrawn', 'legacy')
    and c.id not in ('icici:pre-approved-credit-card', 'icici:tnc-for-governing-credit-card')
    and (c.id in (select card_id from base) or c.id in (select card_id from fee) or c.id in (select card_id from terms)
         or c.id in (select card_id from cat_json))
),
out as (
  select c.id, c.issuer_id, c.name, c.status, cur.label as currency, b.ppc as base_ppc, f.amount as fee, cj.cats, val.inr_per_unit as value,
         t.lounge, t.golf, t.concierge, t.membership, t.welcome
  from cand c
  left join cur on cur.card_id = c.id left join base b on b.card_id = c.id left join fee f on f.card_id = c.id
  left join cat_json cj on cj.card_id = c.id left join terms t on t.card_id = c.id left join val on val.card_id = c.id
)
select jsonb_build_object(
  'generatedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'banks', (select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name) order by i.name) from corpus.issuer i where i.id in (select issuer_id from out)),
  'cards', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'n', name, 'b', issuer_id, 'c', currency, 'e', round(base_ppc, 2), 'f', fee, 'k', cats, 'v', round(value, 4), 'p', case when status = 'paused' then 1 end,
      'l', case when lounge then 1 end, 'g', case when golf then 1 end, 'q', case when concierge then 1 end,
      'm', case when membership then 1 end, 'w', case when welcome then 1 end)) order by issuer_id, name) from out)
)::text as recommender_data;
