// Vercel Serverless Function: GET /api/tool-data?set=calculator|recommender
//
// Serves the calculator and recommender data straight from Supabase, so what is in the database is what the
// tools show. It runs the same two SQL files as scripts/refresh-calculator-data.mjs and applies the same
// sanity checks. If anything goes wrong it answers 503 and the pages quietly fall back to the static JSON in
// /data, so a database outage never breaks the tools.
//
// Required environment variable (Vercel project settings):
//   CALCULATOR_DATABASE_URL - connection string for a READ-ONLY Postgres role that can select from corpus.
//                             Use Supabase's pooled connection (port 6543) for serverless.
//
// Responses are cached at Vercel's edge for 5 minutes (and served stale for an hour while refreshing), so the
// database is queried a handful of times an hour no matter how many people use the tools.
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Only these two datasets exist. The query comes from a file chosen from this list, never from the request.
const SETS = {
  calculator: { file: 'calculator-data.sql', column: 'calculator_data', keys: ['banks', 'cards', 'partners'] },
  recommender: { file: 'recommender-data.sql', column: 'recommender_data', keys: ['banks', 'cards'] }
};

// Same guards as the refresh script: refuse to publish a suspiciously small or inconsistent result.
function check(name, d) {
  if (!d || !Array.isArray(d.cards)) throw new Error('no cards');
  const banks = new Set((d.banks || []).map((b) => b.id));
  if (name === 'calculator') {
    const routes = d.cards.reduce((n, c) => n + c.r.length, 0);
    if (d.cards.length < 30 || routes < 100) throw new Error(`only ${d.cards.length} cards / ${routes} routes`);
    for (const c of d.cards) {
      if (!banks.has(c.b)) throw new Error(`unknown bank on ${c.id}`);
      for (const r of c.r) if (!d.partners[r[0]]) throw new Error(`unknown partner on ${c.id}`);
    }
  } else {
    if (d.cards.length < 30) throw new Error(`only ${d.cards.length} cards`);
    const seen = new Set();
    for (const c of d.cards) {
      if (!c.id || !c.n || !banks.has(c.b) || seen.has(c.id)) throw new Error(`bad card ${c.id}`);
      seen.add(c.id);
    }
    if (d.cards.filter((c) => c.e != null).length < 20) throw new Error('too few earn rates');
  }
}

let pool = null;
async function getPool() {
  if (pool) return pool;
  const url = process.env.CALCULATOR_DATABASE_URL;
  if (!url) throw new Error('not_configured');
  const { default: pg } = await import('pg');
  // max: 1 because each serverless instance handles one request at a time.
  pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000, statement_timeout: 12000 });
  return pool;
}

// Test hook: lets a test supply a fake pool. Not used in production.
export function __setPool(p) { pool = p; }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  const name = typeof req.query?.set === 'string' ? req.query.set : '';
  const def = Object.prototype.hasOwnProperty.call(SETS, name) ? SETS[name] : null;
  if (!def) return res.status(400).json({ ok: false, error: 'unknown_set' });

  let client;
  try {
    const sql = readFileSync(path.join(process.cwd(), 'scripts', def.file), 'utf8');
    client = await (await getPool()).connect();
    await client.query('begin read only');
    const { rows } = await client.query(sql);
    await client.query('rollback');
    const data = rows[0][def.column];
    check(name, data);
    const body = { generatedAt: data.generatedAt, ...Object.fromEntries(def.keys.map((k) => [k, data[k]])) };
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('X-Data-Source', 'live');
    return res.status(200).json(body);
  } catch (err) {
    if (client) await client.query('rollback').catch(() => {});
    // Details go to the function log, never to the browser.
    console.error('[tool-data]', name, err && err.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ ok: false, error: 'unavailable' });
  } finally {
    if (client) client.release();
  }
}
