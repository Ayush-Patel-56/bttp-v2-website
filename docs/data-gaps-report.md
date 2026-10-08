# Data gaps report: Points Calculator and Card Recommender

Prepared 8 Oct 2026 from live queries against the Supabase `corpus` schema (read-only) and the site's data files on branch `feat/points-calculator`.

**How to read this.** Every number below comes from a query run on 8 Oct 2026 or from the shipped data files, and says which. Anything I could not check is listed in section 11, not guessed. "Card" means a row in `corpus.card` with status other than `withdrawn`/`legacy`, excluding two crawler rows (`icici:pre-approved-credit-card`, `icici:tnc-for-governing-credit-card`).

---

## 1. Summary

1. **The database is mostly an index, not a catalogue.** 702 card rows exist, but only 59 have had their data extracted (57 `verified`, 2 `rules`); 645 are `recognition` only (name found, no terms). Many of the 702 are not real cards (examples in `icici`: "Offer", "Terms N Conditions", "China", "Referral Programme").
2. **Only 3 cards are complete for both tools** (transfer route + base earn + annual fee + a rupee value).
3. **The tools use 99 cards** (calculator 63, recommender 58, 22 in both). The database is now ahead of the site files: 5 cards newly eligible, 1 that the database now marks `withdrawn` but the site still lists.
4. **The largest accuracy gaps, in order:** (a) award charts exist for only 4 of the 42 transfer partners the calculator uses, so most trips are estimates; (b) transfer-rule detail (minimum, multiple, processing time, cap) exists in the database for most routes but is shipped for only 66; (c) 107 of 225 published transfer ratios are marked `unchecked` (no second source); (d) the recommender ignores most earn-rule shapes, and caps and exclusions are not used at all.
5. **Several user-visible questions are data gaps, not bugs:** Diners Black has no hotel route, Amex has no published airline route, HDFC Regalia has no named partner. Details in section 8.

---

## 2. What each tool needs, per card

### Points Calculator

| Need | Table / column | Used for |
|---|---|---|
| Card identity | `card.id, name, issuer_id` | card picker |
| Reward currency | `card_currency (is_primary)` | label, and picks currency-level routes |
| Transfer ratio per partner | `transfer_partner.from_units, to_units, ratio_is_ceiling` (state and ratio_state both `published`) | points = partner units x ratio |
| Transfer rules | `min_units, multiple_units, processing_time_text, processing_max_hours, cap_units, cap_window` | rounding up to the minimum and multiple, stats panel, rules box |
| Partner award price | `award_price_current` (origin region, destination region, cabin, units) | exact points needed |
| Place to zone mapping | `award_region`, `geo_region` | countries and cities to the programme's own zones |
| Bank redemption values | `valuation (mode: statement_credit, voucher, flight, hotel, ...)` | "other ways to redeem", and cards with no partner |
| Card image | `card_art` | card picture |

### Card Recommender

| Need | Table / column | Used for |
|---|---|---|
| Base earn rate | `card_earn_rule` rule_type `base`, empty predicate | estimated monthly points |
| Category earn rates | `card_earn_rule` rule_type `multiplier`, predicate has `category` only | 7 category groups |
| Annual fee | `card_earn_rule` rule_type `fee`, fee_kind `annual`, empty predicate | fee filter and display |
| Rupee value per point | `valuation` (statement_credit, then voucher) | "% back" and ranking |
| Perks | `card_product_term` types lounge, golf, concierge, membership, welcome | perk tags |
| Transfer partners | `transfer_partner` (via calculator data) | partner filter and goal scoring |
| Status | `card.status` | "paused" flag |

Minimum for a card to appear in the recommender: any one of base earn, annual fee, a product term, or a category rule. Minimum for the calculator: at least one published airline or hotel route.

---

## 3. Database inventory (8 Oct 2026)

| Measure | Count | Query basis |
|---|---|---|
| Card rows (real, not withdrawn/legacy) | 702 | `corpus.card` |
| Of which with a reward currency | 186 | `card_currency` |
| depth `verified` / `rules` / `recognition` | 57 / 2 / 645 | `card.depth` (704 rows incl. 2 crawler rows) |
| Cards with a network recorded | 43 | `card.network` |
| Cards with a tier recorded | 0 | `card.tier` |
| Variants of another card | 30 | `card.variant_of` |
| Issuers | 9 (icici 362, hdfc 75, sbi 72, axis 60, idfc 56, indusind 36, hsbc 25, kotak 15, amex 6) | `issuer`, `card` |
| Loyalty programmes | 55 (39 airline, 12 hotel, 1 coalition, 1 unknown, 2 n/a) | `loyalty_programme` |
| Published transfer routes (airline or hotel) | 220 usable (140 card-specific, 80 currency-level) | `transfer_partner` |
| Award chart rows (current) | 1,889 award_price rows across 9 programmes | `award_price_current` |
| Valuation rows | 105 (statement_credit 33, flight 19, hotel 19, voucher 16, merchandise 8, blended 5, transfer 3, points_plus_pay 2) | `valuation` |

### Completeness views (from `corpus.completeness_report`)

| depth | Cards | Missing base rate | Missing annual fee | Missing exclusion rules | Missing expiry | All required present |
|---|---|---|---|---|---|---|
| recognition | 646 | 645 | 626 | 643 | 644 | 0 |
| rules | 2 | 0 | 0 | 1 | 1 | 1 |
| verified | 59 | 0 | 0 | 1 | 2 | 56 |

(The view counts 707 rows because it includes rows the card query excludes; the proportions are what matter.)

---

## 4. Coverage by tool

### Calculator (database now vs site file)

| | Database now | Site file |
|---|---|---|
| Cards with a published route | 64 | 63 |
| Missing from the site file | `icici:rubyx-credit-card` (Maharaja Club 6:1) | |

Of the 63 cards in the site file:
- 47 have an airline partner, 26 a hotel partner.
- **44 can show an exact price** (at least one partner with an award chart). **19 are estimate-only.**
- **47 of the 63 have no bank redemption values**, so they get no "other ways to redeem" comparison (16 do).
- 66 of 233 routes (28%) use a partner with a chart; the other 167 are estimates from the user's price.

### Recommender (database now vs site file)

| | Database now | Site file |
|---|---|---|
| Cards eligible | 62 | 58 |
| In database, not on site | `axis:axis-bank-ace-credit-card`, `hdfc:diners-club-premium-credit-card`, `hdfc:indianoil-hdfc-bank-credit-card`, `icici:rubyx-credit-card`, `sbi:cashback-sbi-card` | |
| On site, withdrawn in database | `hdfc:intermiles-platinum-credit-card` (status `withdrawn`) | still listed |

Field coverage, site file (58 cards): base earn 50, annual fee 29, rupee value 34, category rates 14, lounge flag 31, welcome flag 41. **Earn + fee + value: 11 cards. Earn + fee + value + categories: 3 cards.**

Field coverage, database now: base earn 52, annual fee 32, category rules 17, any terms 59, lounge terms 30, valuation (statement credit or voucher) 58.

Category rates by group in the site file: dining 8, groceries 7, shopping 5, bills 4, entertainment 4, fuel 3, travel 1. These are far too thin for category-based ranking.

### Per bank (site file, 99 cards)

| Bank | Cards | In calculator | With exact-price partner | Earn | Fee | Value | Image |
|---|---|---|---|---|---|---|---|
| Amex | 6 | 6 | 0 | 5 | 5 | 3 | 6 |
| Axis | 14 | 8 | 6 | 10 | 10 | 8 | 10 |
| HDFC | 30 | 8 | 5 | 24 | 6 | 15 | 22 |
| ICICI | 11 | 11 | 7 | 1 | 1 | 0 | 10 |
| IDFC | 1 | 1 | 0 | 1 | 1 | 0 | 1 |
| IndusInd | 21 | 20 | 20 | 1 | 2 | 2 | 18 |
| Kotak | 4 | 2 | 1 | 3 | 4 | 2 | 0 |
| SBI | 12 | 7 | 5 | 5 | 0 | 4 | 9 |

Reading it: IndusInd and ICICI are strong for the calculator and almost empty for the recommender. HDFC is the reverse. No bank is strong in both.

---

## 5. What is missing, by data type

### 5.1 Cards
- 645 of 702 cards are `recognition`-only: no earn, fee, terms or routes. Many are not products (crawler pages). Without a real-product flag, the real number of cards cannot be stated exactly; 186 with a reward currency is the best proxy.
- Popular cards that are `recognition`-only: `axis:axis-bank-atlas-credit-card` has a route but no earn or fee; HSBC has 25 rows and none extracted; ICICI Amazon Pay, Sapphiro, and others have no extracted rules.
- Missing issuers (not in `issuer`): Yes Bank, RBL, AU, Standard Chartered, Federal. Only 9 issuers exist.
- No `tier` for any card; `network` for 43 of 704.

### 5.2 Earn rules (recommender)

Counts below are current earn and multiplier rules by what condition they carry. The recommender uses only the first two lines.

| Rule shape | Rules | Cards | Used by recommender |
|---|---|---|---|
| base, no condition | 53 | 53 | yes |
| multiplier, `category` only | 21 | 17 | yes |
| multiplier on a `merchant` | 31 | 11 | no |
| multiplier on a `merchant_group` | 22 | 19 | no |
| base with `card_scope` | 14 | 14 | no |
| multiplier on `txn_type` (e.g. international) | 11 | 10 | no |
| base on a `merchant` | 11 | 2 | no |
| base on a `category` | 6 | 4 | no |
| base with a spend threshold, channel, timing or minimum | 6 | 6 | no |
| category combined with timing, channel or merchant | 10 | 8 | no |

Also not used: **383 exclusion rules (61 cards), 129 cap rules (50 cards), 72 redeem caps (33 cards), 55 reversal rules (50 cards), 102 expiry rules (52 cards).** Of the 25 cards that have any category multiplier, 21 also have a cap rule, so category estimates can overstate rewards.

Specific gaps that matter:
- **8 cards** have a base earn rule that is not unconditional (a count of cards with any base rule that fails the recommender's strict test; it may include some of the "same as" cards below). One confirmed example: Axis Magnus earns 12 points per Rs 200 below Rs 1.5 lakh of monthly spend, so the recommender shows it with no base rate. Magnus Burgundy and Magnus Lifetime Free also show no earn rate; I did not check why.
- **14 cards** have base rules written as "same as another rule" (`same_as`); the recommender skips them.
- **34 multiplier rules have no cap row**; the database's own notes say many of these are "silent" (the issuer prints no cap), which is a recorded absence, not a gap.

### 5.3 Annual fees
- 32 cards have an `annual` fee row.
- **12 more cards have only a joining or renewal fee**: 7 HDFC and 5 SBI. SBI Elite, for example, has joining Rs 4,999 and renewal Rs 4,999 but no annual row, so the recommender shows "N/A". Using renewal as the annual fee for those 12 is a code change (and a judgement call) that needs no new data.
- By issuer, annual fee rows: Amex 5, Axis 11, HDFC 6, ICICI 2, IDFC 1, IndusInd 2, Kotak 4, SBI 1.

### 5.4 Transfer routes
- Cards with a published route: 64. About 120 cards that have a reward currency have none.
- Why a card shows no partner (all 186 cards with a currency, 702 basis):

| Reason | Cards |
|---|---|
| Has at least one published route | 64 |
| Cashback or closed-loop currency (cashback, CashPoints, NeuCoin, CRED, LIC, wallet) | about 61 |
| Not extracted yet (recognition) | about 39 |
| Verified but no route recorded | about 20 |
| Link found, ratio unpublished | 1 (HDFC Diners Privilege: Accor, Avianca, Turkish) |

(The last four lines are from my 7 Oct classification; the 64 is from 8 Oct.)
- **Transferable currencies with few or no routes:** `hdfc_reward_point` 35 cards but only 5 with a route; `hdfc_cashpoint` 9 cards, 0 routes; `intermiles` 6 cards, 0 routes; `indianoil_fuel_point` 1 card, 0 routes; `kotak_reward_point` 6, 0; `icici_reward_point` 8 cards, all with a route (3 route rows); `axis_edge_reward_point` 9 cards, 5 with a route.
- **Route quality (220 usable routes):**

| Measure | Routes | Share |
|---|---|---|
| Ratio status `unchecked` (no second source) | 107 of 225 published | 48% |
| `single_source` | 85 of 225 | 38% |
| `corroborated` | 33 of 225 | 15% |
| No minimum transfer recorded | 62 of 220 | 28% |
| No multiple recorded | 199 of 220 | 90% |
| No processing time recorded | 62 of 220 | 28% |
| No cap recorded | 82 of 220 | 37% |
| Ratio is a ceiling ("up to") | 4 | 2% |
| Source document date recorded | 11 of 225 | 5% |
| Effective-from date recorded | 99 of 225 | 44% |
| Rows the database flags as conflicting (min, cap) | 6 (all Avios) | |

- **Ratios worth verifying** (not proven wrong): Axis Kwik 20:1 and 10:1 (sourced from Axis's "Other Card" column of a T&C table; database state `unchecked`); HDFC 6E Rewards cards to ALL Accor 6:1 (via the IndiGo BluChip currency); SBI Travel Credit to Shangri-La 6:1 (single source, SBI's rewards T&C PDF).
- **Card to currency links the database itself marks unproven:** 140 card-currency pairs (130 have no earn rule naming that currency, 10 have an unproven quote). **45 of the 64 calculator cards have at least one such link, and 30 of them rely only on currency-level routes.** If a link is wrong, the card would show another currency's ratios.
- **The site exports transfer rules for only 66 routes** (the 4 charted programmes). The database has a minimum for 158 of 220 usable routes, so about 113 routes with a known minimum show "no minimums recorded". This is a code gap, not a data gap.

### 5.5 Award charts
| Programme | Chart rows | In site | Calculator cards using it | Note |
|---|---|---|---|---|
| KrisFlyer | 847 | yes | 25 | effective 1 Nov 2025 |
| Maharaja Club | 7 | yes | 30 | economy only, "starting at" prices |
| Finnair Plus | 20 | yes | 5 | |
| Wyndham | 4 | yes | 7 | tiers, not destinations |
| Turkish Miles | 294 | no | 13 | region names inconsistent: both "South America" and "Southern America" exist |
| Aeroplan | 217 | no | 6 | priced by distance; chart repriced 1 Jun 2026 |
| Qantas | 180 | no | 5 | priced by distance |
| Velocity | 60 | no | 3 | 36 of 60 rows by distance |
| Enrich | 112 | no | 0 | priced by distance |

- **Partners with routes but no chart at all** (cards using): ALL Accor 12, Marriott Bonvoy 12, Club ITC 7, IHG 7, Radisson 7, BA Avios 6, Etihad 6, Flying Blue 6, Qatar 6, United 6, Thai 5, AirAsia 4, Emirates 4, Ethiopian 4, IndiGo 4, JAL 4, Orchid 4, Postcard 4, SpiceJet 4, Lotusmiles 4, Jumeirah One 3, Shangri-La 3, plus 14 more with 1 to 2 cards.
- Adding the 4 unused charts would move 27 more routes (Turkish 13, Aeroplan 6, Qantas 5, Velocity 3) to exact prices. Distance-based charts need a distance input (airport coordinates are available in the airports file).
- No seasonal pricing and no date-based pricing exist in any chart (0 seasonal rows), so the tool cannot ask for travel dates.
- Hotel charts: only Wyndham. All other hotel programmes price by property category; nothing in the database lists properties, so a stay's destination cannot change the points.
- **Taxes and fuel surcharges:** 33 `programme_award_cost` rows (30 programmes, 26 with a surcharge flag). The tools say "excludes taxes and fees" and do not use these rows.

### 5.6 Rupee values
- Currency-level valuation status (from `loyalty_completeness`): missing for `hdfc_reward_point`, `hdfc_cashpoint`, `kotak_reward_point`, `tata_neucoin`; "unpublished" for ICICI, SBI, IndiGo BluChip, Maharaja Point, Marriott, SBI Travel Credit and others; answered for Axis EDGE, Amex, CRED, KrisFlyer. HDFC has card-level rows, so individual HDFC cards often have a value even where the currency does not.
- Only 3 `transfer`-mode valuations exist (what a point is worth when transferred), which is what would make "other ways" fully comparable. The calculator currently computes this from the user's own price.
- Values are bank-published (a ceiling in many cases). They are not market values.

### 5.7 Perks
- Lounge terms: 45 rows, 32 cards; of these, 12 are unlimited and 30 carry a visit count per period. The recommender shows only a yes/no tag.
- Cards with each term type (8 Oct): golf 7, concierge 13, membership 16, welcome 45, milestone 37, insurance 36, surcharge waiver 45, fee waiver 49.
- None of the amounts, counts or conditions are shown; welcome-benefit value and milestone value are not used in ranking.

### 5.8 Images
- `card_art`: 124 rows, **123 `held`, 1 `unpublished`; none is cleared for use.** 17 are flagged shipped in the app; 9 are graded `card_face`, 100 are ungraded.
- The site ships 76 images. **23 of the 99 tool cards have none** (including all 4 Kotak cards, and the Axis Magnus Burgundy, ICICI Expressions, IndusInd Club Vistara Explorer, IndusInd Epay Amex and Kotak Air Plus cards).
- Image rights are a legal question, not a data one.

### 5.9 Places
- The calculator's destination list is built from the award charts' regions plus a bundled airport file (3,244 airports from OurAirports, not from the database). The database has no airport or city table.
- 91 countries that have airports are in no award chart; those trips are estimate-only.

### 5.10 Things in the database the tools do not use at all
- **Programme notices: 141 rows** (79 other, 17 devaluation, 14 transfer bonus of which 12 current, 12 partner added, 7 closure, 6 partner exit, 6 ratio change). Examples relevant to the tools: a Marriott Bonvoy standing bonus of 5,000 miles per 60,000 points transferred (makes 3:1 an effective 2.4:1 at multiples of 60,000), HDFC halving the inbound rate to Avianca/Turkish/Accor from 15 Jan 2024, and a Wyndham chart replacement effective 15 Sep 2026 (the site already uses the new chart).
- **Card eligibility rules**: 325 rules across 52 cards (by type on 7 Oct: age 110 rows, income 57, occupation 54, nationality 43, residency 16, credit history 13, relationship 12, city 6, issuance 3). The tools do not filter by eligibility.
- **Card offers**: 395 rows, but for only 4 cards.
- **Currency expiry rules**: 57 rules; the tools show no expiry.

---

## 6. Where the database is ahead of the site (fix by regenerating)

| Item | Detail |
|---|---|
| ICICI Rubyx | verified in the database (Maharaja Club 6:1); not in the calculator file |
| Recommender additions | Axis ACE, HDFC Diners Club Premium, HDFC IndianOil, ICICI Rubyx, SBI Cashback |
| Withdrawn card | HDFC InterMiles Platinum still on the site; database status is `withdrawn` |
| Axis EDGE redemption values | database now records them under mode "blended"; the site file still has them under "statement credit" (a check script reports 6 rows of drift) |
| Amex shopwise rules | 6 rules (2x/3x on a merchant group, 25,000 points a month cap) loaded 6 Oct; recommender cannot read them |

`scripts/refresh-calculator-data.mjs` regenerates the calculator and recommender files (needs the `CALCULATOR_DATABASE_URL` secret). `scripts/check-data-drift.mjs` (new) reports when `redemption-data.json` falls behind.

---

## 7. Per-card requirements (what a "complete" card needs)

For a card to be fully usable in both tools, the database needs the following rows. Counts show how many of the 99 tool cards currently satisfy each (site file) and how many database cards satisfy it.

| # | Requirement | Table | Tool cards (of 99) | Database cards |
|---|---|---|---|---|
| 1 | Reward currency, primary | `card_currency` | 99 | 186 |
| 2 | Currency link proven by an earn rule | `card_currency_proof` | 19 of the 64 database calculator cards have only proven links; 45 have at least one unproven link | |
| 3 | At least one published airline or hotel route | `transfer_partner` | 63 | 64 |
| 4 | Per route: minimum, multiple, processing time, cap | `transfer_partner` | 66 routes shipped | about 158 routes have a minimum |
| 5 | Award chart for the partner | `award_price_current` | 44 cards have a charted partner | |
| 6 | Base earn, unconditional | `card_earn_rule` | 50 of 58 | 52 |
| 7 | Category earn (7 groups) | `card_earn_rule` | 14 of 58 | 17 |
| 8 | Annual fee (or joining/renewal) | `card_earn_rule` | 29 of 58 | 32 (+12 joining/renewal only) |
| 9 | Rupee value per point | `valuation` | 34 of 58 | 58 |
| 10 | Bank redemption values (flight, hotel, voucher, statement credit) | `valuation` | 39 of 99 have any | |
| 11 | Perks: lounge, golf, concierge, membership, welcome | `card_product_term` | 31 / 7 / 11 / 14 / 41 of 58 | 59 with any term |
| 12 | Caps and exclusions | `card_earn_rule` | not used | 50 / 61 cards |
| 13 | Image with usage rights | `card_art` | 76 of 99 files, none cleared | 122 cards have a row |
| 14 | Network and tier | `card` | not used | 43 / 0 |

**Complete for both tools today:** 3 cards (route + base earn + annual fee + valuation).

---

## 8. Answers to specific questions raised during testing

| Question | Answer from the database |
|---|---|
| Why do some cards show no partner (e.g. HDFC Regalia)? | `corpus.card_transfer_destination_unnamed` records that HDFC prints "1 Reward Point = up to 0.5 airmiles" and names no airline programme. An agent searched all 14 documents held for the card on 30 Sep. Two HDFC SmartBuy Regalia pages also failed to fetch on 6 Oct. |
| Why are Diners Black and Diners Black Metal missing in hotels? | No hotel route exists for either card (airline only: Turkish Miles; Metal also Maharaja Club). A search of `transfer_partner` for hotel links on both returned nothing. |
| Why does Amex appear in hotels but not flights? | All six Amex cards have one route: Marriott Bonvoy 1:1. Its only airline row (Turkish Miles 2:1, currency-level) was demoted to unpublished on 18 Sep because its cited sentence belongs to an Amex Middle East paragraph. The Marriott 1:1 source is a 2022 offer T&C (promotion window 1 Sep to 31 Oct 2022; the ratio sentence is Amex's own); no current document restates it, and the database note warns against demoing it. |
| Why 16 hotel cards and 19 airline cards for HDFC? | The picker adds every card with no partner to both lists. HDFC: 6 real airline cards + 13 padding = 19; 3 real hotel cards + 13 padding = 16. |
| Why do the two HDFC 6E cards appear under hotels? | They have one route, ALL Accor at 6:1, through the IndiGo BluChip currency. |

---

## 9. What to do, in order

### A. Code changes that need no new data (I can do these)
1. Ship transfer rules (minimum, multiple, processing time, cap) for all 220 routes, not 66.
2. Use renewal or joining fee as the annual fee for the 12 cards that only have those (needs your decision: renewal fee is the year-2 fee).
3. Group the card picker: cards with a real partner first, then a labelled "no transfer partner recorded" group.
4. Drop cards the database marks `withdrawn` (InterMiles Platinum) and add the 5 newly eligible cards and the Rubyx route (regenerate data).
5. Use base earn rules written with a spend condition (8 cards) with the condition shown.
6. Add the 4 unused award charts (Turkish, Aeroplan, Qantas, Velocity); Turkish needs its two "America" regions reconciled and the distance-based ones need a distance input.
7. Show cards' joining and renewal fee separately.
8. Model standing transfer bonuses (Marriott: 5,000 miles per 60,000 points).

### B. Data to extract (database team)
1. Extract the `recognition` cards that matter, first those with a route: ICICI Sapphiro/Emeralde/Emirates/Parakram, IndusInd cards (21 in tools, 1 with earn), Amex Gold, Axis Atlas.
2. Award charts for the partners most cards use: BA Avios, Flying Blue, Qatar, Etihad, United, Thai (6 to 12 cards each), and hotel charts for Marriott and ALL Accor (12 cards each).
3. Second sources for the 107 `unchecked` and 85 `single_source` ratios, starting with Kwik 20:1/10:1, the HDFC 6E cards, SBI Shangri-La 6:1 and the Marriott/Amex 1:1.
4. Hotel routes for HDFC Diners Black and Black Metal; airline routes for Amex; HDFC Regalia, Regalia First and Diners Miles partners from the issuer.
5. Valuation rows for ICICI, SBI and Kotak currencies and for `transfer` mode.
6. Category earn rates (7 groups) for more cards, with caps.
7. Prove the 140 unproven card-to-currency links, starting with the 45 calculator cards.
8. Mark which rows are real cards (a product flag) so crawler rows stop inflating counts.
9. New issuers: Yes Bank, RBL, AU, Standard Chartered, Federal.

### C. Decisions only you can make
1. Card image rights (all rows `held`).
2. Whether to show eligibility, offers and card expiry.
3. Whether to show estimates for hotels (the current estimate uses Rs 1 to 4 per partner point, which suits airline miles more than hotel points).

---

## 10. How these numbers were checked

- Live queries on 8 Oct 2026 against `corpus` (read-only). Counts for the tools come from the same SQL rules as `scripts/calculator-data.sql` and `scripts/recommender-data.sql`.
- Site-file numbers come from `data/calculator-data.json`, `data/recommender-data.json` and `data/redemption-data.json` on branch `feat/points-calculator`.
- Earlier in this session the calculator's output was compared route by route with independent calculations (all 233 routes, 491 checks, all matched) and the recommender's ranking with an independent port (6 scenarios, all matched). That shows the tools compute correctly from their data; it does not show the data is correct.

## 11. What I could not check

- **I did not verify any value against an issuer's website.** The report says which values lack a second source, not which are wrong.
- Two views are blocked for the read-only login (`card_needs_extraction` and some quality views fail with "permission denied for function verified_earn_rule"), so the database's own to-do list of cards needing extraction was not readable.
- The definitions of `verified`, `rules` and `recognition` are inferred from the data, not documented.
- Section 5.4's classification of cards with no partner (61 / 39 / 20 / 1) is from my 7 Oct run; the database has moved a little since (for example 64 cards with routes now).
- The per-type eligibility breakdown in 5.10 is from 7 Oct; the totals are from 8 Oct.
- Whether any specific bank currently allows a transfer that the database does not record (for example Diners Black to a hotel) is unknown from the database alone.
