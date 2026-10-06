// Builds data/airports.json: the airports people search for in the calculator's place picker.
// Source: OurAirports (public domain), https://ourairports.com/data/. It is static reference data, not part of the
// weekly Supabase refresh. Re-run when you want newer airports:  node scripts/build-airports.mjs [path/to/airports.csv]
//
// Each airport carries the country name exactly as the award charts spell it (data/redemption-data.json), so the
// calculator can map an airport to a programme's pricing zone through its city, then its country.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

// ISO country code -> the name the award charts use, where it differs from the English display name.
const CHART_NAME = {
  HK: 'Hong Kong SAR, China', TW: 'Taiwan, China', MO: 'Macau', CN: 'China', CI: 'Ivory Coast', CV: 'Cabo Verde', PS: 'Palestine',
  ST: 'Sao Tome and Principe', BA: 'Bosnia and Herzegovina', SH: 'Saint Helena', TR: 'Turkey', CG: 'Congo', CD: 'DR Congo', MM: 'Myanmar',
};

// Municipality is often a suburb or carries a district ("Paris (Roissy-en-France, Val-d'Oise)", "Sepang"). Keep the part
// before any bracket or comma, then fix the airports whose municipality is not the city travellers book.
const CITY_NAME = { 'New Delhi': 'Delhi', Bangalore: 'Bengaluru', 'Frankfurt am Main': 'Frankfurt', Firenze: 'Florence', Genova: 'Genoa', Venezia: 'Venice', 'Köln': 'Cologne' };
const CITY_BY_CODE = {
  MXP: 'Milan', LIN: 'Milan', BGY: 'Milan', TRN: 'Turin', VRN: 'Verona', TSF: 'Venice', LYS: 'Lyon', MRS: 'Marseille', SAW: 'Istanbul', KUL: 'Kuala Lumpur',
  NRT: 'Tokyo', DPS: 'Bali', GOI: 'Goa', LTN: 'London', EDI: 'Edinburgh', HHN: 'Frankfurt', BWA: 'Bhairahawa', SUF: 'Lamezia Terme', LIH: 'Lihue', HNL: 'Honolulu',
};
const cityOf = (code, municipality, name) => {
  if (CITY_BY_CODE[code]) return CITY_BY_CODE[code];
  const c = (municipality || name).split(/[(,]/)[0].trim() || name;
  return CITY_NAME[c] || c;
};

const parseCsv = text => {
  const rows = []; let row = [], cur = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; } else cur += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  return rows;
};

const csv = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SOURCE)).text();
const [head, ...body] = parseCsv(csv);
const col = n => head.indexOf(n);
const display = new Intl.DisplayNames(['en'], { type: 'region' });

const red = JSON.parse(readFileSync(path.join(root, 'data/redemption-data.json'), 'utf8'));
const chartPlaces = new Set();
Object.values(red.charts).forEach(c => (c.places || []).forEach(p => chartPlaces.add(p[0])));

const countries = [];
const countryIdx = new Map();
const airports = [];
for (const r of body) {
  const iata = r[col('iata_code')];
  if (!iata || r[col('scheduled_service')] !== 'yes') continue;
  const type = r[col('type')];
  if (type !== 'large_airport' && type !== 'medium_airport') continue;
  const iso = r[col('iso_country')];
  const country = CHART_NAME[iso] || display.of(iso) || iso;
  if (!countryIdx.has(country)) { countryIdx.set(country, countries.length); countries.push(country); }
  const city = cityOf(iata, r[col('municipality')], r[col('name')]);
  // [IATA, airport name, city, country index, 1 if one of the world's large airports]
  airports.push([iata, r[col('name')], city, countryIdx.get(country), type === 'large_airport' ? 1 : 0]);
}
airports.sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));

const unmatched = countries.filter(c => !chartPlaces.has(c));
writeFileSync(path.join(root, 'data/airports.json'), JSON.stringify({ countries, airports }));
console.log(`${airports.length} airports in ${countries.length} countries.`);
console.log(`Countries the award charts do not list (estimate only): ${unmatched.length}`);
console.log(unmatched.join(', '));
