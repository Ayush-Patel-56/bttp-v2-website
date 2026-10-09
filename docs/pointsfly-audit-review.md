# Review of the BTTP vs PointsFly audit

Date: 9 Oct 2026. Every claim in `BTTP_vs_PointsFly_Calculator_Audit.pdf` was checked against our database (read-only), our data files and the live calculator code. "Confirmed" means we reproduced it; "Not reproduced" means we tried and could not.

## Verdict on each main claim

| # | Claim in the audit | Verdict | Evidence |
|---|---|---|---|
| 1 | The maths is accurate, 0 errors | **Confirmed** | 493 independent checks on real data and over 5,900 on invented data, 0 failures. One latent rounding bug was found and fixed earlier (decimal ratios such as 1.1:1). |
| 2 | Axis Atlas shows 1 partner, PointsFly 20 | **Confirmed, and it is a database gap** | Axis's own table (document `38cacf83`, "Effective 2nd-April-26") has an Atlas column with 24 partners. We stored only Maharaja Club. The database note that calls Maharaja "the only EDGE Miles ratio Axis publishes" is wrong. |
| 3 | Same gap on Magnus for Burgundy, Neo and others | **Confirmed** | The same table has columns for Magnus for Burgundy (we hold 1 of 24), Burgundy Private, Olympus, Horizon, Select/Privilege/Rewards and IndianOil Premium. Axis's eligible-cards list (`72acd49b`) names NEO, FREECHARGE, MYZONE, AURA, SELECT, HORIZON and OLYMPUS, so those cards fall under the table too. ACE, AIRTEL and FLIPKART are not on the list, so showing no partners for them is correct. |
| 4 | Nine ratio conflicts | **Explained for 5 of 9; 4 need an issuer check** | See the next section. |
| 5 | Frankfurt, Tokyo, Hong Kong, Kuala Lumpur, Sydney, Dubai Al Maktoum and domestic routes return no price | **Not reproduced** | On the current build every one of these returns an award price (Maharaja Club, KrisFlyer or both). Only Colombo and Kathmandu fall back to an estimate. See "Place coverage". |
| 6 | Minimum transfer and processing time are dashes on about three quarters of routes | **Confirmed, mostly fixed** | We shipped transfer rules for only 66 of 234 routes, although the database holds them for far more. They are now shipped for every route that has them: minimum shown on 158 of 234 (was 46), processing time on 136 (was 43). The rest are blank because the database has no value. |
| 7 | 40000.5 is read as 4,00,005 | **Confirmed and fixed** | The number box stripped the decimal point. It now keeps the whole-number part (40000.5 gives 40,000). Negative numbers are rejected instead of silently turned positive. Same fix in the recommender's spend box. |
| 8 | "Ticket price" does not say it is a total | **Confirmed and fixed** | The hint now reads "Enter the total for all passengers, excluding taxes and fees" (hotels: "the total for the whole stay"). |
| 9 | "Turkish Miles miles" | **Confirmed and fixed** | The unit word is no longer added when the partner's name already ends in miles or points. |
| 10 | Club Vistara is stale | **Confirmed in the database** | The database itself records "Club Vistara is closed: merged into Air India ... 12 November 2024", yet the HDFC H.O.G. Diners route to Club Vistara is still published. It needs unpublishing. |
| 11 | Velocity 1.55:1, Avios to Accor 23:5, Emirates to Marriott 3:2 look odd | **Not errors** | All three are quoted from the partner's own page (Velocity, Accor and Emirates pages), and two are marked corroborated. They are unusual, not wrong. |
| 12 | Flight and hotel lists differ, so a card can vanish when you switch mode | **Confirmed and fixed** | Every card now appears in both modes. Cards with a partner of that kind come first; the rest sit under "No hotel (or airline) partner recorded", and their result explains that the card transfers to the other kind. |
| 13 | Many banks and cards missing | **Confirmed** | The database has 12 issuers. Federal (12 cards) and Standard Chartered (10) have rows but no extracted data; HSBC has 25 rows, 0 extracted. Yes Bank, Bank of Baroda, AU, PNB, Union, Canara and others are not in the database at all. |
| 14 | No Hilton, and no HSBC hotel partners | **Confirmed** | The database has no transfer rows for Hilton Honors at all, and HSBC is not extracted. |
| 15 | Maharaja Club offers economy only | **Matches our data** | Our chart for it has 7 economy "starting at" rows. Not checked against Air India's own page. |
| 16 | Diners Black has 1 partner, Infinia 3, PointsFly 16 each | **Cannot confirm either way** | Our rows are quoted from HDFC's own pages (Infinia: T&C clause 13 names three programmes). Where PointsFly's 16 come from is unknown. Worth checking HDFC's current partner list. |

## The nine ratio conflicts

| Card, partner | BTTP | PointsFly | What our database says |
|---|---|---|---|
| Axis Kwik, IndiGo | 10:1 | 20:1 | Axis prints two IndiGo tables. The standard one gives "other cards" 10:1 (BTTP). A separate "limited-period introductory offer" table gives 20:1 (PointsFly). Axis says the offer applies to "select card variants"; we do not know whether Kwik qualifies or whether the offer is still live. |
| Axis Magnus, IndiGo | 5:1 | 5:2 | Same two tables: standard 5:1, introductory 5:2. |
| Axis Reserve, IndiGo | 5:1 | 5:2 | Same. |
| IndusInd Pioneer Heritage, KrisFlyer | 2:1 | 4:1 | **BTTP is supported**: IndusInd's own words, "2 Reward Points = 1 Krisflyer mile". |
| IndusInd Pioneer Heritage, Air India | 2:1 | 4:1 | **BTTP is supported**: IndusInd's table lists Heritage at 2:1. |
| IndusInd Pinnacle World, KrisFlyer | 4:1 | 2:1 | Only the generic IndusInd rate is held (400 points to 100 miles, for any IndusInd card). No card-specific source. |
| IndusInd Pioneer Private, KrisFlyer | 4:1 | 1:1 | Same: generic rate only. |
| IndusInd Solitaire, KrisFlyer | 4:1 | 2:1 | Same. |
| IndusInd Poonawalla, KrisFlyer | 4:1 | 2:1 | Same, and the audit's card match is a guess. |

The audit's observation about IndusInd is right: **4:1 is the issuer-wide default for IndusInd to KrisFlyer**, and it is applied to every card that has no card-specific source. PointsFly's figures for Pinnacle World (2:1), Pioneer Private (1:1) and Solitaire (2:1) equal what IndusInd's Maharaja Club table says for those cards, so PointsFly may have reused the Air India ratio. That is a guess, not a finding. The fix is to read each IndusInd card's own page.

## Place coverage (audit section 6)

Checked on the current build, India to each place:

| Place | Result |
|---|---|
| Singapore, Bangkok, New York, Kuala Lumpur, Sydney | KrisFlyer and Maharaja Club both price it |
| Dubai (DXB and DWC), London, Paris, Frankfurt, Mumbai, Goa | Maharaja Club prices it; KrisFlyer has no fixed price for these (its chart marks them "use mileage calculator") |
| Tokyo (HND and NRT), Hong Kong | KrisFlyer prices it; Air India's chart has no Japan or Hong Kong zone |
| Colombo, Kathmandu | No chart prices them: Sri Lanka and Nepal sit in KrisFlyer's South Asia zone, which has no India to South Asia row, and Air India's chart has no zone for them |

So the only real gaps are Colombo and Kathmandu. The audit probably tested an older build or looked at one programme at a time.

## What this review changed in the code

- Decimals and negatives in number boxes are handled; the price hint and the unit wording are fixed.
- Transfer rules (minimum, multiple, processing time, limit) are shipped for every route that has them, and the redemption export and drift-check queries now cover all airline and hotel routes.
- The card list groups cards by whether they have a partner of the kind chosen, and no longer drops cards when you switch between Flights and Hotels.

## Data work only the database team can do

1. **Axis Travel EDGE table.** Load the full table below for every card family. It is already in the corpus (document `38cacf83`, effective 2 April 2026). We hold Kwik, Magnus and Privilege completely (all 74 routes we already hold match the table exactly, 0 differences), but only 1 route each for Atlas and Magnus for Burgundy, and none for Burgundy Private, Olympus, Horizon, IndianOil Premium, Neo, Freecharge, MyZone, Select, Rewards, Aura and the other cards on Axis's eligible list.
   - The first five columns are ratios of EDGE Reward Points to the partner. Olympus, Atlas and Horizon are ratios of **EDGE Miles** (the database note for Atlas confirms the miles unit). Axis's header for the last column is unclear, so check it before loading.
   - Record the IndiGo introductory-offer table too, with its own dates, so the site can show the standard and the promotional ratio.
2. **Unpublish** the HDFC H.O.G. Diners to Club Vistara route (programme closed 12 Nov 2024).
3. **IndusInd card-specific KrisFlyer ratios** for Pinnacle World, Pioneer Private, Solitaire, Poonawalla and the other cards that currently use the 4:1 default.
4. **Hilton Honors** transfer routes (none exist), and extraction for HSBC, Federal and Standard Chartered.
5. **More partners for HDFC cards** (Diners Black, Infinia, Marriott Bonvoy), checked against HDFC's current pages rather than PointsFly's list.
6. **Missing issuers**: Yes Bank, Bank of Baroda, AU, PNB, Union, Canara and the rest of the audit's list.

## Axis Travel EDGE transfer table (verbatim from the corpus document, effective 2 April 2026)

Ratios are written Axis-style: card points (or miles) to partner points. Columns are in the order Axis prints them.

| Partner (as Axis prints it) | Our programme id | Burgundy Pvt / The One Metal | Magnus for Burgundy | Reserve, Magnus | Select, Privilege, Rewards | All eligible debit / other credit cards (Kwik, Neo ...) | Olympus | Atlas | Horizon | IndianOil Axis Bank Premium |
|---|---|---|---|---|---|---|---|---|---|---|
| Air Asia | airasia_rewards | 5:4 | 5:4 | 5:2 | 5:1 | 10:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Aeroplan | aeroplan | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Flying Blue | flying_blue | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Air India | maharaja_club | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| The British Airways Club | ba_executive_club | 5:4 | 5:2 | 5:1 | 10:1 | 10:1 | 1:2 | 2:1 | 2:1 | 2:1 |
| Ethiopian Airlines | ethiopian_shebamiles | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Etihad Guest | etihad_guest | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Finnair Plus | finnair_plus | 5:4 | 5:2 | 5:1 | 10:1 | 10:1 | 1:2 | 2:1 | 2:1 | 2:1 |
| IHG One Rewards | ihg_one_rewards | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| IndiGo BluChip | indigo_6e_rewards | 5:4 | 5:2 | 5:1 | 10:1 | 10:1 | 1:2 | 2:1 | 2:1 | 2:1 |
| ITC | club_itc | 5:4 | 5:4 | 5:2 | 5:1 | 10:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| JAL Mileage Bank | jal_mileage_bank | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Orchid Rewards | orchid_rewards | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:1 | 1:1 | 2:1 |
| The Postcard Sunshine Club | postcard_sunshine_club | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Qantas Frequent Flyer | qantas_frequent_flyer | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Privilege Club | qatar_privilege_club | 5:4 | 5:2 | 5:1 | 10:1 | 10:1 | 1:2 | 2:1 | 2:1 | 2:1 |
| Radisson Rewards | radisson_rewards | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:1 | 1:1 | 2:1 |
| Singapore Airlines | krisflyer | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| SpiceJet | spicejet_spiceclub | 5:4 | 5:4 | 5:2 | 5:1 | 10:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Royal Orchid Plus | thai_royal_orchid_plus | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Turkish Airlines | turkish_miles_and_smiles | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| United MileagePlus | united_mileageplus | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |
| Lotusmiles (Vietnam Airlines) | vietnam_airlines_lotusmiles | 5:4 | 5:2 | 5:1 | 10:1 | 10:1 | 1:2 | 2:1 | 2:1 | 2:1 |
| Wyndham Rewards | wyndham_rewards | 5:4 | 5:4 | 5:2 | 10:1 | 20:1 | 1:4 | 1:2 | 1:1 | 2:1 |

## What was not checked

- No ratio was checked against an issuer's website. Everything above comes from documents already held in our database.
- PointsFly was not re-tested; its figures are taken from the audit.
- Whether the IndiGo introductory offer is live today, and which Axis cards it covers, is unknown.
