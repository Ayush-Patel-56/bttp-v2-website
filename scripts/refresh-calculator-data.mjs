// Regenerates data/calculator-data.json from Supabase using scripts/calculator-data.sql.
//
//   CALCULATOR_DATABASE_URL=postgres://... node scripts/refresh-calculator-data.mjs
//
// Use a read-only database role. The file is only rewritten when the card, route
// or partner data actually changed, so a refresh with no changes leaves git clean.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlPath = path.join(root, 'scripts', 'calculator-data.sql');
const outPath = path.join(root, 'data', 'calculator-data.json');

// Refuse to publish a suspiciously small result (bad query, wrong schema, empty table).
const MIN_CARDS = 30;
const MIN_ROUTES = 100;

const url = process.env.CALCULATOR_DATABASE_URL;
if (!url) {
  console.error('CALCULATOR_DATABASE_URL is not set.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
let data;
try {
  await client.query('begin read only');
  const { rows } = await client.query(await readFile(sqlPath, 'utf8'));
  await client.query('rollback');
  data = rows[0].calculator_data;
} finally {
  await client.end();
}

const cards = data.cards ?? [];
const routes = cards.reduce((n, c) => n + c.r.length, 0);
if (cards.length < MIN_CARDS || routes < MIN_ROUTES) {
  console.error(`Refusing to write: only ${cards.length} cards / ${routes} routes (minimum ${MIN_CARDS} / ${MIN_ROUTES}).`);
  process.exit(1);
}

// Every route must point at a known partner and every card at a known bank.
const bankIds = new Set(data.banks.map(b => b.id));
for (const c of cards) {
  if (!bankIds.has(c.b)) throw new Error(`Card ${c.id} references unknown bank ${c.b}`);
  for (const r of c.r) {
    if (!data.partners[r[0]]) throw new Error(`Card ${c.id} references unknown partner ${r[0]}`);
  }
}

// Stable key order and compact output keep diffs small.
const { generatedAt, ...content } = data;
const next = JSON.stringify({ generatedAt, banks: content.banks, cards: content.cards, partners: content.partners });

let previous = null;
try {
  previous = JSON.parse(await readFile(outPath, 'utf8'));
} catch {
  // first run
}
const strip = d => d && JSON.stringify({ banks: d.banks, cards: d.cards, partners: d.partners });
if (previous && strip(previous) === strip({ banks: content.banks, cards: content.cards, partners: content.partners })) {
  console.log(`No changes (${cards.length} cards, ${routes} routes).`);
} else {
  await writeFile(outPath, `${next}\n`);
  console.log(`Wrote ${outPath}: ${cards.length} cards, ${routes} routes, ${Object.keys(data.partners).length} partners.`);
}
