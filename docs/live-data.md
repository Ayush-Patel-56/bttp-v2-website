# Live data from Supabase

The calculator and the card recommender read their card data from `/api/tool-data`, a Vercel serverless function
(`api/tool-data.js`) that queries Supabase's `corpus` schema. If that call fails, is slower than 6 seconds, or
returns something that fails the sanity checks, the pages use the static copies in `data/` instead, so the tools
never go blank.

## How it behaves

| | |
|---|---|
| Endpoint | `GET /api/tool-data?set=calculator` or `?set=recommender` (anything else is a 400) |
| Query | the same files the weekly job uses: `scripts/calculator-data.sql`, `scripts/recommender-data.sql` |
| Safety | each query runs inside `begin read only`; the function never builds SQL from the request |
| Cache | 5 minutes at Vercel's edge, then served stale for up to an hour while it refreshes. A database edit shows in the tools within about 5 to 10 minutes |
| Failure | 503 with `Cache-Control: no-store`; the pages fall back to `data/*.json` |
| Page text | the calculator says "read live from our database" when live data was used, "last refreshed" when it fell back |

**Still static** (not read from the database yet): `data/redemption-data.json` (award charts, transfer minimums and
processing times, bank redemption values, place lists), `data/card-art.json`, `data/airports.json`. The drift check
(`scripts/check-data-drift.mjs`, run daily by the refresh workflow) reports when `redemption-data.json` falls behind.

## One-time setup (needs you)

1. **Create a read-only database login.** In the Supabase SQL editor, replace the password and run:

   ```sql
   create role bttp_site_readonly login password 'REPLACE-WITH-A-LONG-RANDOM-PASSWORD' nologin;
   alter role bttp_site_readonly login;
   grant usage on schema corpus to bttp_site_readonly;
   grant select on all tables in schema corpus to bttp_site_readonly;
   alter role bttp_site_readonly set default_transaction_read_only = on;
   ```

   The queries read tables only. If a query ever fails with "permission denied for function", grant `execute` on
   that function to the role.

2. **Add the connection string to Vercel.** Project Settings, Environment Variables, name
   `CALCULATOR_DATABASE_URL`, value the Supabase *pooled* connection string (port 6543, "Transaction pooler"), with
   the user `bttp_site_readonly.<project-ref>` and its password. Tick Production and Preview.
3. **Redeploy** (or push a commit). Check `https://<your-domain>/api/tool-data?set=calculator`: it should return
   JSON and the response header `X-Data-Source: live`.
4. **Optional:** add the same string as the GitHub secret `CALCULATOR_DATABASE_URL` so the daily refresh job and
   drift check run.

Without step 2 the endpoint answers 503 and everything keeps working from the static files.

## Checking it

- Open the calculator: the line under the results should say "read live from our database".
- Edit a row in the database, wait about 5 minutes, hard-refresh: the change appears with no deploy.
- To see the fallback, temporarily remove the variable in Vercel or break the password: the line changes to
  "last refreshed" and the tools carry on.
