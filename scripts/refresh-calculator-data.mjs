// Regenerates the site's data files from Supabase:
//   data/calculator-data.json   <- scripts/calculator-data.sql
//   data/recommender-data.json  <- scripts/recommender-data.sql
//
//   CALCULATOR_DATABASE_URL=postgres://... node scripts/refresh-calculator-data.mjs
//
// Use a read-only database role. Each file is only rewritten when its content actually changed
// (generatedAt is ignored), so a refresh with no changes leaves git clean. data/card-art.json is
// hand-maintained and never touched here.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const url = process.env.CALCULATOR_DATABASE_URL;
if (!url) {
  console.error('CALCULATOR_DATABASE_URL is not set.');
  process.exit(1);
}

const countRoutes = d => d.cards.reduce((n, c) => n + c.r.length, 0);

// Each dataset: where it comes from, where it goes, and what a sane result looks like.
const DATASETS = [
  {
    name: 'calculator',
    sql: 'scripts/calculator-data.sql',
    column: 'calculator_data',
    out: 'data/calculator-data.json',
    keys: ['banks', 'cards', 'partners'],
    // Refuse to publish a suspiciously small result (bad query, wrong schema, empty table).
    check(d) {
      const routes = countRoutes(d);
      if (d.cards.length < 30 || routes < 100) throw new Error(`only ${d.cards.length} cards / ${routes} routes (minimum 30 / 100)`);
      const banks = new Set(d.banks.map(b => b.id));
      for (const c of d.cards) {
        if (!banks.has(c.b)) throw new Error(`card ${c.id} references unknown bank ${c.b}`);
        for (const r of c.r) if (!d.partners[r[0]]) throw new Error(`card ${c.id} references unknown partner ${r[0]}`);
      }
      return `${d.cards.length} cards, ${routes} routes, ${Object.keys(d.partners).length} partners`;
    }
  },
  {
    name: 'recommender',
    sql: 'scripts/recommender-data.sql',
    column: 'recommender_data',
    out: 'data/recommender-data.json',
    keys: ['banks', 'cards'],
    check(d) {
      if (d.cards.length < 30) throw new Error(`only ${d.cards.length} cards (minimum 30)`);
      const banks = new Set(d.banks.map(b => b.id));
      const seen = new Set();
      for (const c of d.cards) {
        if (!c.id || !c.n || !banks.has(c.b)) throw new Error(`card ${c.id} is missing a name or has an unknown bank`);
        if (seen.has(c.id)) throw new Error(`duplicate card ${c.id}`);
        seen.add(c.id);
        for (const k of ['e', 'f', 'v']) if (c[k] != null && !(c[k] >= 0)) throw new Error(`card ${c.id} has an invalid ${k}`);
        for (const [cat, v] of Object.entries(c.k ?? {})) if (!(v >= 0)) throw new Error(`card ${c.id} has an invalid ${cat} rate`);
      }
      const withEarn = d.cards.filter(c => c.e != null).length;
      if (withEarn < 20) throw new Error(`only ${withEarn} cards have an earn rate (minimum 20)`);
      return `${d.cards.length} cards, ${withEarn} with earn rates, ${d.cards.filter(c => c.f != null).length} with fees`;
    }
  }
];

const pick = (d, keys) => Object.fromEntries(keys.map(k => [k, d[k]]));

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

let failed = false;
try {
  for (const ds of DATASETS) {
    try {
      await client.query('begin read only');
      const { rows } = await client.query(await readFile(path.join(root, ds.sql), 'utf8'));
      await client.query('rollback');
      const data = rows[0][ds.column];
      const summary = ds.check(data);

      const outPath = path.join(root, ds.out);
      let previous = null;
      try { previous = JSON.parse(await readFile(outPath, 'utf8')); } catch { /* first run */ }

      if (previous && JSON.stringify(pick(previous, ds.keys)) === JSON.stringify(pick(data, ds.keys))) {
        console.log(`[${ds.name}] no changes (${summary}).`);
      } else {
        await writeFile(outPath, `${JSON.stringify({ generatedAt: data.generatedAt, ...pick(data, ds.keys) })}\n`);
        console.log(`[${ds.name}] wrote ${ds.out}: ${summary}.`);
      }
    } catch (err) {
      // One dataset failing must not stop the other, but the job still fails so it is noticed.
      failed = true;
      await client.query('rollback').catch(() => {});
      console.error(`[${ds.name}] FAILED, file left unchanged: ${err.message}`);
    }
  }
} finally {
  await client.end();
}
if (failed) process.exit(1);
