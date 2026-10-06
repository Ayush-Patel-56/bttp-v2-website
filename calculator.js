(() => {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const els = {
    bank: $('calc-bank'), card: $('calc-card'), balance: $('calc-balance'), partner: $('calc-partner'), price: $('calc-price'), points: $('calc-points'),
    partnerLabel: $('calc-partner-label'), partnerNote: $('calc-partner-note'), priceLabel: $('calc-price-label'), priceHint: $('calc-price-hint'), priceField: $('calc-price-field'),
    flightFields: $('calc-flight-fields'), hotelNote: $('calc-hotel-note'), routeHint: $('calc-route-hint'),
    origin: $('calc-origin'), dest: $('calc-dest'), originList: $('calc-origin-list'), destList: $('calc-dest-list'), swap: $('calc-swap'),
    detailFlight: $('calc-detail-flight'), detailHotel: $('calc-detail-hotel'), cabin: $('calc-cabin'), pax: $('calc-pax'), tripType: $('calc-trip-type'),
    nights: $('calc-nights'), zone: $('calc-zone'), manualToggle: $('calc-manual-toggle'), manual: $('calc-manual'),
    verdict: $('calc-verdict'), badge: $('calc-badge'), caption: $('calc-caption'), value: $('calc-value'), label: $('calc-label'), detail: $('calc-detail'),
    balanceLine: $('calc-balance-line'), using: $('calc-using'), note: $('calc-note'), options: $('calc-options'), compare: $('calc-compare'),
    transfer: $('calc-transfer'), asof: $('calc-asof'), restart: $('calc-restart'),
    asideArt: $('calc-aside-art'), asideName: $('calc-aside-name'), asideBank: $('calc-aside-bank'), asideChips: $('calc-aside-chips'), change: $('calc-change'),
    banner: $('calc-banner'), bannerImg: $('calc-banner-img'), bannerKicker: $('calc-banner-kicker'), bannerTitle: $('calc-banner-title'), bannerText: $('calc-banner-text'),
    statRatio: $('calc-stat-ratio'), statMin: $('calc-stat-min'), statTime: $('calc-stat-time'),
    other: $('calc-other'), otherTitle: $('calc-other-title'), otherSub: $('calc-other-sub'), ways: $('calc-ways'), source: $('calc-source'),
    next1: $('calc-next-1'), next2: $('calc-next-2'), next3: $('calc-next-3')
  };
  const panes = Array.from(document.querySelectorAll('.rt-pane'));
  const stepBtns = Array.from(document.querySelectorAll('.rt-step'));
  const typeBtns = Array.from(document.querySelectorAll('.rt-type'));
  const tripButtons = Array.from(document.querySelectorAll('[data-trip]'));

  const COPY = {
    airline: { partner: 'Airline partner', price: 'Ticket price', kicker: 'Your trip to' },
    hotel: { partner: 'Hotel partner', price: 'Stay price', kicker: 'Your stay with' }
  };
  const CABIN = { e: 'Economy', p: 'Premium economy', b: 'Business', f: 'First', r: 'Room' };
  const CABIN_ORDER = ['e', 'p', 'b', 'f'];
  const WAY = {
    s: 'Statement credit', v: 'Vouchers', f: 'Flight bookings (bank portal)', h: 'Hotel bookings (bank portal)',
    m: 'Merchandise', p: 'Points + pay', b: 'Blended portal redemption'
  };
  const WINDOW = { month: 'per month', calendar_year: 'per calendar year', day: 'per day', year: 'per year' };
  // KrisFlyer's chart states a round trip costs twice the one-way miles. The other charts do not say so.
  const ROUND_TRIP_DOUBLES = new Set(['krisflyer']);
  // Typical rupee value per point. Used only to estimate when a partner has no usable award chart.
  const BENCH = { low: 1, mid: 2, high: 4 };

  // Rupee-per-point cut-offs, highest first. Same thresholds as the page's benchmark badges.
  const TIERS = [
    { min: 4, tier: 'high', badge: 'High Value', label: 'Excellent redemption value', detail: 'This is the kind of redemption that usually justifies using points instead of defaulting to cashback.' },
    { min: 2, tier: 'good', badge: 'Good Value', label: 'Strong redemption value', detail: 'This is comfortably above the low-value range and generally worth serious consideration.' },
    { min: 1, tier: 'okay', badge: 'Okay Value', label: 'Average redemption value', detail: 'This is usable, but there may be better ways to use the same points on flights or hotels.' },
    { min: 0, tier: 'low', badge: 'Low Value', label: 'Low redemption value', detail: 'This is where vouchers and cashback often leave a lot of value on the table.' }
  ];

  const inr = new Intl.NumberFormat('en-IN');
  const state = {
    data: null, red: null, art: {}, banks: new Map(), rec: new Map(), cards: new Map(),
    mode: 'airline', step: 1, maxStep: 1, trip: 1, partner: '', exact: false, plan: null,
    air: null, airByLabel: new Map(), airByCode: new Map(), airCities: new Set()
  };

  const digits = value => value.replace(/[^\d]/g, '');
  const parseNumber = value => Number(digits(value)) || 0;
  const formatInput = input => { const d = digits(input.value); input.value = d ? inr.format(Number(d)) : ''; };
  const trim = (n, d = 2) => String(Number(n.toFixed(d)));
  const ratioText = (from, to) => `${inr.format(from)} : ${inr.format(to)}`;
  const roundEst = n => Math.max(500, Math.round(n / 500) * 500);
  const norm = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const setOptions = (select, placeholder, items, disabled, keep) => {
    const prev = keep ? select.value : '';
    select.replaceChildren();
    const first = el('option', null, placeholder);
    first.value = '';
    select.appendChild(first);
    items.forEach(({ value, text }) => { const o = el('option', null, text); o.value = value; select.appendChild(o); });
    if (prev && items.some(i => String(i.value) === prev)) select.value = prev;
    select.disabled = disabled;
  };
  const showError = (n, msg) => {
    for (let i = 1; i <= 3; i++) { const e = $(`calc-error-${i}`); if (e) e.hidden = true; }
    const e = $(`calc-error-${n}`);
    if (e && msg) { e.textContent = msg; e.hidden = false; }
  };

  // ── Cards and partners ──
  const selectedCard = () => state.cards.get(els.card.value) || null;
  const routesIn = (card, mode) => card.r.filter(r => state.data.partners[r[0]] && state.data.partners[r[0]].k === mode);
  const routesFor = card => routesIn(card, state.mode);
  const hasModes = card => !!(state.red && state.red.modes && state.red.modes[card.id]);
  // A card with no transfer partner at all still appears (in both modes) if we know how its points redeem elsewhere.
  const cardsForMode = () => Array.from(state.cards.values()).filter(c => routesFor(c).length || (!c.r.length && hasModes(c)));
  const noPartnerCard = card => !!card && !routesFor(card).length;
  const partnerName = id => (state.data.partners[id] ? state.data.partners[id].n.replace(/\s*\(.*?\)\s*/g, ' ').trim() : id);
  const unitWord = () => (state.mode === 'hotel' ? 'points' : 'miles');
  const xferOf = (card, pid) => ((state.red && state.red.xfer && state.red.xfer[card.id]) || {})[pid] || [];
  const routeOf = (card, pid) => card.r.find(r => r[0] === pid);

  // ── Award charts: a place maps to the programme's own pricing zone ──
  const chartOf = pid => { const c = state.red && state.red.charts && state.red.charts[pid]; return c && c.rows && c.rows.length ? c : null; };
  const isHotelChart = chart => !!chart && chart.rows.length > 0 && chart.rows[0][6] === 2;
  const regionName = (chart, i) => chart.regions[i];
  const placeRegions = (chart, v) => {
    if (!chart.idx) {
      chart.idx = new Map();
      (chart.places || []).forEach(([n, region]) => { const k = norm(n); const a = chart.idx.get(k) || []; if (!a.includes(region)) a.push(region); chart.idx.set(k, a); });
    }
    return chart.idx.get(v) || [];
  };
  // An airport such as "Mumbai (BOM)" is priced by its city when the chart lists it, otherwise by its country.
  const airportOf = v => state.airByLabel.get(v) || (v.length === 3 ? state.airByCode.get(v) : null) || null;
  // Guards against a city sharing its name with one abroad (London, Canada is not London, UK).
  const cityFits = ap => { const c = ALIASES[ap.cityKey]; return !c || norm(c) === ap.countryKey; };
  const zonesOf = (chart, name) => {
    const v = norm(name || '');
    if (!v) return [];
    const direct = placeRegions(chart, v);
    if (direct.length) return direct;
    const ap = airportOf(v);
    if (!ap) return [];
    const byCity = cityFits(ap) ? placeRegions(chart, ap.cityKey) : [];
    return byCity.length ? byCity : placeRegions(chart, ap.countryKey);
  };
  const originZones = (chart, name) => zonesOf(chart, name).filter(z => chart.rows.some(r => r[0] === z));
  const reachableFrom = (chart, O) => new Set(chart.rows.filter(r => O.includes(r[0])).map(r => r[1]));
  const destZones = (chart, O, name) => { const ok = reachableFrom(chart, O); return zonesOf(chart, name).filter(z => ok.has(z)); };
  const zoneText = (chart, regions) => regions.map(i => regionName(chart, i)).join(' / ');
  const flightCharts = () => Object.keys((state.red && state.red.charts) || {}).filter(pid => { const c = chartOf(pid); return c && !isHotelChart(c) && c.places; });

  // Does this partner publish a price for the typed route (any cabin)? Returns the cabins it has, or [].
  const cabinsFor = (pid, from, to) => {
    const chart = chartOf(pid);
    if (!chart || isHotelChart(chart)) return [];
    const O = originZones(chart, from), D = destZones(chart, O, to);
    return Array.from(new Set(chart.rows.filter(r => O.includes(r[0]) && D.includes(r[1])).map(r => r[2]))).sort((a, b) => CABIN_ORDER.indexOf(a) - CABIN_ORDER.indexOf(b));
  };

  // Why a chart partner cannot price this trip, in plain words.
  const unpricedText = (pid, from, to) => {
    const chart = chartOf(pid);
    const O = originZones(chart, from);
    if (!O.length) return `${partnerName(pid)} does not price flights from "${from.trim()}" in the award chart we hold.`;
    const known = zonesOf(chart, to);
    if (!known.length) return `${partnerName(pid)} has no price for "${to.trim()}" in its award chart.`;
    const pair = `${zoneText(chart, O)} to ${zoneText(chart, known)}`;
    return pid === 'krisflyer'
      ? `KrisFlyer does not publish a fixed price for ${pair}. Its award chart marks these routes "use the mileage calculator", so check the exact miles on singaporeair.com.`
      : `${partnerName(pid)} does not publish a price for ${pair} in the award chart we hold. Check the exact price on the airline's site.`;
  };

  // ── Search box for places: popular choices first, type to search everything ──
  const POPULAR_DEST = ['Singapore (SIN)', 'Dubai (DXB)', 'Bangkok (BKK)', 'London (LHR)', 'Paris (CDG)', 'Tokyo (HND)', 'New York (JFK)', 'Kuala Lumpur (KUL)',
    'Hong Kong (HKG)', 'Singapore', 'United Arab Emirates', 'Thailand', 'United Kingdom', 'United States', 'Japan', 'Australia', 'Malaysia', 'Indonesia',
    'Maldives', 'Sri Lanka', 'Vietnam', 'France', 'Germany', 'Italy', 'Switzerland', 'Canada', 'Turkey', 'Spain'];
  const POPULAR_ORIGIN = ['Delhi (DEL)', 'Mumbai (BOM)', 'Bengaluru (BLR)', 'Chennai (MAA)', 'Hyderabad (HYD)', 'Kolkata (CCU)', 'Singapore (SIN)', 'Dubai (DXB)',
    'London (LHR)', 'India', 'Singapore', 'United Arab Emirates', 'United Kingdom', 'United States', 'Australia', 'Thailand', 'Malaysia', 'Canada', 'Germany', 'France'];
  // Everyday names people type, mapped to the country a programme actually prices. Only used when the programme has that country.
  const ALIASES = {
    dubai: 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates', uae: 'United Arab Emirates', doha: 'Qatar', muscat: 'Oman',
    london: 'United Kingdom', uk: 'United Kingdom', england: 'United Kingdom', scotland: 'United Kingdom', manchester: 'United Kingdom',
    paris: 'France', nice: 'France', rome: 'Italy', milan: 'Italy', venice: 'Italy', barcelona: 'Spain', madrid: 'Spain', amsterdam: 'Netherlands', holland: 'Netherlands',
    zurich: 'Switzerland', geneva: 'Switzerland', frankfurt: 'Germany', munich: 'Germany', berlin: 'Germany', istanbul: 'Turkey', athens: 'Greece', lisbon: 'Portugal',
    'new york': 'United States', usa: 'United States', america: 'United States', 'los angeles': 'United States', 'san francisco': 'United States', chicago: 'United States',
    seattle: 'United States', dallas: 'United States', miami: 'United States', houston: 'United States', toronto: 'Canada', vancouver: 'Canada',
    tokyo: 'Japan', osaka: 'Japan', seoul: 'South Korea', bangkok: 'Thailand', phuket: 'Thailand', pattaya: 'Thailand', 'chiang mai': 'Thailand',
    bali: 'Indonesia', jakarta: 'Indonesia', 'kuala lumpur': 'Malaysia', penang: 'Malaysia', hanoi: 'Vietnam', 'ho chi minh': 'Vietnam', saigon: 'Vietnam', 'da nang': 'Vietnam',
    manila: 'Philippines', cebu: 'Philippines', 'siem reap': 'Cambodia', 'hong kong': 'Hong Kong SAR, China', taipei: 'Taiwan, China', sydney: 'Australia',
    melbourne: 'Australia', brisbane: 'Australia', auckland: 'New Zealand', colombo: 'Sri Lanka', kathmandu: 'Nepal', dhaka: 'Bangladesh', male: 'Maldives',
    delhi: 'India', mumbai: 'India', bengaluru: 'India', bangalore: 'India', kolkata: 'India', chennai: 'India', hyderabad: 'India', goa: 'India',
    cairo: 'Egypt', nairobi: 'Kenya', johannesburg: 'South Africa', 'cape town': 'South Africa', mauritius: 'Mauritius', moscow: 'Russia'
  };

  // Places across every flight chart. For the To box, `ok` means at least one programme prices it from the chosen origin.
  const placeItems = originOnly => {
    const charts = flightCharts().map(chartOf);
    const from = els.origin.value;
    const judged = charts.some(c => originZones(c, from).length); // if no chart knows the origin, we cannot judge pricing
    const map = new Map();
    const air = state.air || [];
    const airCity = new Set(air.filter(cityFits).map(a => a.cityKey));
    const info = charts.map(chart => ({ chart, origins: new Set(chart.rows.map(r => r[0])), reach: originOnly ? null : reachableFrom(chart, originZones(chart, from)) }));
    info.forEach(({ chart, origins, reach }) => {
      chart.places.forEach(([name, region, kind]) => {
        if (kind === 'y' && airCity.has(norm(name))) return; // the airports under that city replace it
        if (originOnly && !origins.has(region)) return;
        const it = map.get(name) || { name, kind, ok: false };
        if (originOnly || !judged || reach.has(region)) it.ok = true;
        map.set(name, it);
      });
    });
    const items = Array.from(map.values());
    air.forEach(ap => {
      let known = false, ok = false;
      info.forEach(({ chart, origins, reach }) => {
        const zones = zonesOf(chart, ap.label);
        if (!zones.length) return;
        known = true;
        if (originOnly ? zones.some(z => origins.has(z)) : (!judged || zones.some(z => reach.has(z)))) ok = true;
      });
      if (originOnly && !ok) return;
      items.push({ name: ap.label, kind: 'a', ok, known, ap });
    });
    return items;
  };

  const makeCombo = cfg => {
    const { input, list } = cfg;
    let shown = [];
    let active = -1;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const setActive = i => {
      active = i;
      Array.from(list.querySelectorAll('[role="option"]')).forEach((li, k) => {
        li.classList.toggle('is-active', k === i);
        li.setAttribute('aria-selected', String(k === i));
        if (k === i) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      });
    };
    const choose = item => {
      input.value = item.name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      close();
      if (cfg.after) setTimeout(cfg.after, 0);
    };
    const row = (item, sub) => {
      const li = el('li', `calc-combo-opt${item.ok ? '' : ' is-unpriced'}`);
      li.id = `${list.id}-${shown.length}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.appendChild(el('strong', null, item.name));
      li.appendChild(el('span', null, sub));
      if (item.ap) li.appendChild(el('small', null, item.ap.name));
      // mousedown, not click: the input would lose focus and close the list first.
      li.addEventListener('mousedown', e => { e.preventDefault(); choose(item); });
      list.appendChild(li);
      shown.push(item);
    };
    const kindText = k => (k === 'y' ? 'City' : k === 'a' ? 'Airport' : 'Country');
    const build = fresh => {
      const raw = input.value;
      const q = fresh ? '' : norm(raw);
      const all = cfg.items();
      list.replaceChildren(); shown = []; active = -1;
      if (!q) {
        const byName = new Map(all.map(i => [i.name, i]));
        let pop = cfg.popular.map(n => byName.get(n)).filter(i => i && i.ok).slice(0, 14);
        if (!pop.length) pop = all.filter(i => i.ok).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
        if (pop.length) {
          list.appendChild(el('li', 'calc-combo-head', cfg.heading));
          pop.forEach(i => row(i, i.ap ? i.ap.country : kindText(i.kind)));
        }
        list.appendChild(el('li', 'calc-combo-foot', `Type to search all ${all.length} places`));
      } else {
        const rank = i => {
          const n = norm(i.name);
          if (i.ap) {
            // Airports match on code, city, then the airport's own name ("heathrow", "changi").
            if (i.ap.codeKey === q) return 0;
            if (n.startsWith(q)) return 1;
            if (n.split(/[\s,()-]+/).some(w => w.startsWith(q))) return 2;
            return i.ap.nameKey.includes(q) ? 3 : 9;
          }
          return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[\s,()-]+/).some(w => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : 9;
        };
        const res = all.map(i => ({ i, r: rank(i) })).filter(x => x.r < 9);
        // Everyday names (Dubai, London, USA) point at the country the programme prices.
        const byName = new Map(all.map(i => [norm(i.name), i]));
        const aliasHits = [];
        if (q.length >= 2) {
          Object.keys(ALIASES).forEach(key => {
            if (byName.has(key) || !(key.startsWith(q) || key.split(' ').some(w => w.startsWith(q)))) return;
            const target = byName.get(norm(ALIASES[key]));
            if (target && !res.some(x => x.i === target) && !aliasHits.some(a => a.item === target)) aliasHits.push({ item: target, via: key.replace(/\b\w/g, c => c.toUpperCase()) });
          });
        }
        res.sort((a, b) => a.r - b.r || (b.i.ok - a.i.ok) || a.i.name.localeCompare(b.i.name));
        // Names that start with what was typed come first, then everyday-name suggestions, then looser matches.
        const sub = x => (x.i.ap ? (x.i.ok ? x.i.ap.country : x.i.known ? 'No price from here' : 'Estimate only') : x.i.ok ? kindText(x.i.kind) : 'No price from here');
        res.filter(x => x.r <= 1).forEach(x => row(x.i, sub(x)));
        aliasHits.slice(0, 3).forEach(a => row(a.item, `Includes ${a.via}`));
        res.filter(x => x.r > 1).slice(0, Math.max(0, 10 - shown.length)).forEach(x => row(x.i, sub(x)));
        if (shown.length > 10) { shown.length = 10; Array.from(list.children).slice(10).forEach(n => n.remove()); }
        if (!shown.length) list.appendChild(el('li', 'calc-combo-foot', `No place matches "${raw.trim()}"`));
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('focus', () => { if (!input.disabled) build(true); });
    input.addEventListener('click', () => { if (!input.disabled && list.hidden) build(true); });
    input.addEventListener('input', () => { if (!input.disabled) build(false); });
    input.addEventListener('keydown', e => {
      if (list.hidden) { if (e.key === 'ArrowDown' && !input.disabled) { e.preventDefault(); build(true); setActive(0); } return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) setActive((active + 1) % shown.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) setActive((active - 1 + shown.length) % shown.length); }
      else if (e.key === 'Enter') { if (active >= 0 && shown[active]) { e.preventDefault(); choose(shown[active]); } else if (shown.length === 1) { e.preventDefault(); choose(shown[0]); } }
      else if (e.key === 'Escape' || e.key === 'Tab') { close(); }
    });
    document.addEventListener('mousedown', e => { if (!input.parentElement.contains(e.target)) close(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    return { close };
  };

  // ── Right-hand panel: selected card, destination banner, transfer facts ──
  const fallbackCard = name => {
    const f = el('div', 'rt-fallback');
    f.appendChild(el('span', 'rt-fallback-brand', 'BTTP'));
    f.appendChild(el('span', 'rt-fallback-name', name));
    return f;
  };

  const renderAside = () => {
    const card = selectedCard();
    els.asideArt.replaceChildren();
    els.asideChips.replaceChildren();
    els.change.hidden = !card;
    if (!card) {
      els.asideArt.appendChild(fallbackCard('Select a card'));
      els.asideName.textContent = 'Select a card';
      els.asideBank.textContent = 'Choose your bank and card in step 2';
    } else {
      const art = state.art[card.id];
      if (art) {
        const img = el('img', 'rt-art-img');
        img.src = `/assets/cards/${art.f}`; img.width = art.w; img.height = art.h; img.alt = `${card.n} credit card`; img.decoding = 'async';
        if (art.h > art.w) img.classList.add('is-vertical');
        els.asideArt.appendChild(img);
      } else {
        els.asideArt.appendChild(fallbackCard(card.n));
      }
      els.asideName.textContent = card.n;
      els.asideBank.textContent = state.banks.get(card.b) || '';
      const rec = state.rec.get(card.id) || {};
      const chips = [];
      if (card.c) chips.push(card.c);
      const partners = routesFor(card).length || card.r.length;
      if (partners) chips.push(`${partners} transfer partner${partners === 1 ? '' : 's'}`);
      if (rec.f != null) chips.push(rec.f === 0 ? 'Lifetime free' : `Annual fee ₹${inr.format(rec.f)}`);
      if (rec.l) chips.push('Lounge access');
      chips.slice(0, 4).forEach(t => els.asideChips.appendChild(el('span', 'rt-chip', t)));
    }

    // Transfer facts for the chosen partner.
    const route = card && state.partner ? routeOf(card, state.partner) : null;
    const xf = card && state.partner ? xferOf(card, state.partner) : [];
    els.statRatio.textContent = route ? `${trim(route[1])} : ${trim(route[2])}${route[3] ? ' (up to)' : ''}` : '—';
    els.statMin.textContent = xf[0] ? `${inr.format(xf[0])} points` : '—';
    const t = xf[2] ? xf[2].replace(/^upto(?=\s)/i, 'Up to') : (xf[3] ? `Up to ${Math.ceil(xf[3] / 24)} days` : '');
    els.statTime.textContent = t ? t.charAt(0).toUpperCase() + t.slice(1) : '—';
  };

  // The photo is only specific when we truly have a picture of that place; otherwise it is a neutral travel image.
  const bannerPhoto = dest => {
    const d = norm(dest || '');
    if (/\b(paris|france)\b/.test(d)) return '/assets/destinations/paris.jpg';
    if (/\bmaldives\b/.test(d)) return '/assets/destinations/hotel.jpg';
    if (/\bindia\b/.test(d) && state.mode === 'hotel') return '/assets/udaipur.jpg';
    return state.mode === 'hotel' ? '/assets/destinations/trip.jpg' : '/assets/destinations/flight.jpg';
  };
  const prettyPlace = name => {
    const v = norm(name || '');
    if (!v) return '';
    const ap = airportOf(v);
    if (ap) return ap.city;
    for (const chart of flightCharts().map(chartOf)) { const hit = (chart.places || []).find(p => norm(p[0]) === v); if (hit) return hit[0]; }
    return name.trim().replace(/\b\w/g, c => c.toUpperCase());
  };
  const renderBanner = text => {
    const dest = state.mode === 'airline' ? prettyPlace(els.dest.value) : '';
    els.bannerKicker.textContent = COPY[state.mode].kicker;
    if (state.mode === 'airline') els.bannerTitle.textContent = dest || 'Anywhere';
    else els.bannerTitle.textContent = state.partner ? partnerName(state.partner) : 'Any hotel';
    els.bannerText.textContent = text || "Fill in your details to see how many points you need and the value you'll get.";
    const src = bannerPhoto(dest);
    if (!els.bannerImg.src.endsWith(src)) els.bannerImg.src = src;
  };

  // ── Wizard steps ──
  const goTo = n => {
    state.step = n;
    state.maxStep = Math.max(state.maxStep, n);
    panes.forEach(p => { p.hidden = Number(p.dataset.pane) !== n; });
    stepBtns.forEach(b => {
      const i = Number(b.dataset.step);
      b.classList.toggle('is-active', i === n);
      b.classList.toggle('is-done', i < n);
      b.disabled = i > state.maxStep;
      if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    showError(0);
    const top = form.closest('.rt-card').getBoundingClientRect().top;
    if (top < 0) window.scrollBy({ top: top - 110, behavior: 'smooth' });
  };

  const validate = n => {
    if (n === 1 && state.mode === 'airline') {
      if (!els.origin.value.trim()) return 'Tell us where you are flying from.';
      if (!els.dest.value.trim()) return 'Tell us where you are flying to.';
    }
    if (n === 2) {
      const card = selectedCard();
      if (!card) return 'Choose your bank and credit card.';
      if (!noPartnerCard(card) && !state.partner) return `Choose ${state.mode === 'hotel' ? 'a hotel' : 'an airline'} partner.`;
    }
    if (n === 3) {
      const card = selectedCard();
      if (!card || noPartnerCard(card)) return '';
      if (state.exact && state.mode === 'airline' && !els.cabin.value && parseNumber(els.points.value) === 0) return 'Choose a cabin class.';
      if (!state.exact && !parseNumber(els.price.value) && !parseNumber(els.points.value)) return 'Enter your price so we can estimate the points you need.';
    }
    return '';
  };

  // Moves forward only through steps that pass validation; otherwise stops at the first one that does not.
  const advance = target => {
    for (let n = 1; n < target; n++) {
      if (n === 3 && noPartnerCard(selectedCard())) continue;
      if (n === 3 && state.step !== 3) prepareStep3(false);
      const msg = validate(n);
      if (msg) { if (n === 3) prepareStep3(); else goTo(n); showError(n, msg); return; }
    }
    if (target === 3 && noPartnerCard(selectedCard())) target = 4;
    if (target === 3) prepareStep3(); else if (target === 4) showResults(); else goTo(target);
  };

  // ── Step 1: trip ──
  const updateRouteHint = () => {
    const from = els.origin.value, to = els.dest.value;
    if (state.mode !== 'airline' || !from.trim() || !to.trim() || !state.red) { els.routeHint.hidden = true; return; }
    const priced = flightCharts().filter(pid => cabinsFor(pid, from, to).length);
    if (priced.length) {
      const names = priced.map(partnerName);
      els.routeHint.textContent = `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]} publish${names.length > 1 ? '' : 'es'} award prices for ${prettyPlace(from)} to ${prettyPlace(to)}.`;
      els.routeHint.hidden = false;
    } else if (document.activeElement !== els.dest) {
      const known = flightCharts().some(pid => zonesOf(chartOf(pid), to).length);
      els.routeHint.textContent = known
        ? 'No award chart we hold publishes a fixed price for this route. We can still estimate from your ticket price.'
        : `We do not have "${to.trim()}" in our award charts, so we will estimate from your ticket price. Pick a place from the list for exact award prices.`;
      els.routeHint.hidden = false;
    } else {
      els.routeHint.hidden = true;
    }
  };

  const setMode = mode => {
    state.mode = mode;
    typeBtns.forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    els.flightFields.hidden = mode !== 'airline';
    els.hotelNote.hidden = mode !== 'hotel';
    els.partnerLabel.textContent = COPY[mode].partner;
    els.priceLabel.textContent = COPY[mode].price;
    els.routeHint.hidden = true;
    if (state.data) populateBanks();
    renderBanner();
  };

  // ── Step 2: card and partner ──
  const partnerStatus = (card, pid) => {
    const chart = chartOf(pid);
    if (!chart) return 'estimate';
    if (isHotelChart(chart)) return 'priced';
    return cabinsFor(pid, els.origin.value, els.dest.value).length ? 'priced' : 'unpriced';
  };
  const STATUS_TEXT = { priced: 'award price available', unpriced: 'no price for this route', estimate: 'estimate only' };

  const populateBanks = () => {
    const bankIds = new Set(cardsForMode().map(c => c.b));
    const banks = Array.from(bankIds).map(id => ({ value: id, text: state.banks.get(id) || id })).sort((a, b) => a.text.localeCompare(b.text));
    setOptions(els.bank, 'Select your bank', banks, false);
    setOptions(els.card, 'Select a bank first', [], true);
    onCardChange();
  };

  const populateCards = () => {
    const cards = cardsForMode().filter(c => c.b === els.bank.value).sort((a, b) => a.n.localeCompare(b.n));
    if (!els.bank.value) setOptions(els.card, 'Select a bank first', [], true);
    else setOptions(els.card, 'Select your card', cards.map(c => ({ value: c.id, text: c.n })), false);
    onCardChange();
  };

  const onCardChange = () => {
    const card = selectedCard();
    if (!card) {
      setOptions(els.partner, 'Select a card first', [], true);
    } else if (noPartnerCard(card)) {
      setOptions(els.partner, 'No transfer partner recorded', [], true);
    } else {
      const order = { priced: 0, unpriced: 1, estimate: 2 };
      const partners = routesFor(card).map(r => ({ r, st: partnerStatus(card, r[0]) }))
        .sort((a, b) => order[a.st] - order[b.st] || partnerName(a.r[0]).localeCompare(partnerName(b.r[0])))
        .map(({ r, st }) => ({ value: r[0], text: `${state.data.partners[r[0]].n} (${ratioText(r[1], r[2])}) · ${STATUS_TEXT[st]}` }));
      setOptions(els.partner, 'Select a partner', partners, false);
      const priced = routesFor(card).filter(r => partnerStatus(card, r[0]) === 'priced');
      if (priced.length === 1) els.partner.value = priced[0][0]; // only one can price this trip: pick it for them
    }
    onPartnerChange();
  };

  const onPartnerChange = () => {
    const card = selectedCard();
    state.partner = els.partner.value;
    els.points.value = '';
    els.manual.hidden = true;
    els.manualToggle.setAttribute('aria-expanded', 'false');
    els.manualToggle.hidden = !state.partner;
    els.priceField.hidden = noPartnerCard(card);
    if (noPartnerCard(card)) {
      els.partnerNote.textContent = 'We have no airline or hotel transfer partner recorded for this card yet. You can still see how its points compare across other ways to redeem.';
      els.partnerNote.hidden = false;
    } else if (state.partner) {
      const st = partnerStatus(card, state.partner);
      els.partnerNote.textContent = st === 'priced' ? `${partnerName(state.partner)} publishes an award price for this trip, so we will work out the exact points.`
        : st === 'unpriced' ? `${unpricedText(state.partner, els.origin.value, els.dest.value)} We will estimate from your price instead.`
        : `We do not hold a published award chart for ${partnerName(state.partner)} yet, so we will estimate from your price. If you know the exact points, you can add them in step 3.`;
      els.partnerNote.hidden = false;
    } else {
      els.partnerNote.hidden = true;
    }
    renderAside();
    renderBanner();
  };

  // ── Step 3: details ──
  const setTrip = n => {
    state.trip = n;
    tripButtons.forEach(b => { const on = Number(b.dataset.trip) === n; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  };

  const prepareStep3 = (show = true) => {
    const chart = state.partner ? chartOf(state.partner) : null;
    state.exact = false;
    els.detailFlight.hidden = true; els.detailHotel.hidden = true; els.tripType.hidden = true; els.zone.hidden = true;
    if (chart && isHotelChart(chart)) {
      state.exact = true;
      els.detailHotel.hidden = false;
    } else if (chart && state.mode === 'airline') {
      const cabins = cabinsFor(state.partner, els.origin.value, els.dest.value);
      if (cabins.length) {
        state.exact = true;
        els.detailFlight.hidden = false;
        const prev = els.cabin.value;
        setOptions(els.cabin, 'Select cabin', cabins.map(c => ({ value: c, text: CABIN[c] })), false);
        els.cabin.value = cabins.includes(prev) ? prev : (cabins.includes('e') ? 'e' : cabins[0]);
        els.tripType.hidden = !ROUND_TRIP_DOUBLES.has(state.partner);
        if (els.tripType.hidden) setTrip(1);
        const O = originZones(chart, els.origin.value), D = destZones(chart, O, els.dest.value);
        els.zone.textContent = `${partnerName(state.partner)} prices this as ${zoneText(chart, O)} to ${zoneText(chart, D)}.`;
        els.zone.hidden = false;
      } else {
        els.zone.textContent = `${unpricedText(state.partner, els.origin.value, els.dest.value)} We estimate from your price instead.`;
        els.zone.hidden = false;
      }
    }
    els.priceLabel.textContent = state.exact ? `${COPY[state.mode].price} (optional)` : COPY[state.mode].price;
    els.priceHint.textContent = state.exact
      ? 'Add it to see your rupee value per point. Use the price excluding taxes and fees.'
      : 'We use it to estimate the points you need. Use the price excluding taxes and fees.';
    els.next3.querySelector('span').textContent = state.exact ? 'Calculate points' : 'Estimate points';
    if (show) goTo(3);
  };

  // ── Working out the points ──
  const context = () => ({
    from: els.origin.value, to: els.dest.value, cabin: els.cabin.value, pax: Number(els.pax.value) || 1, trip: state.trip,
    nights: Math.max(1, parseNumber(els.nights.value)), price: parseNumber(els.price.value), balance: parseNumber(els.balance.value), manual: parseNumber(els.points.value)
  });

  // Prices one partner for the trip. kind: 'manual' | 'chart' | 'none' (no exact price: estimate instead).
  const buildPlan = (card, route, c) => {
    const pid = route[0];
    const chart = chartOf(pid);
    const xf = xferOf(card, pid);
    const [minTransfer, multiple] = xf;
    let kind = 'none', list = [], mult = 1, descr = '';
    if (c.manual > 0) {
      kind = 'manual'; list = [{ label: 'Your partner points', units: c.manual }];
    } else if (chart && isHotelChart(chart)) {
      const sorted = chart.rows.slice().sort((a, b) => a[3] - b[3]);
      kind = 'chart'; mult = c.nights; descr = `${c.nights} night${c.nights === 1 ? '' : 's'}`;
      list = sorted.map((r, i) => ({ label: `Tier ${i + 1} of ${sorted.length}${i === 0 ? ' (lowest)' : i === sorted.length - 1 ? ' (highest)' : ''}`, units: r[3] }));
    } else if (chart && state.mode === 'airline') {
      const O = originZones(chart, c.from), D = destZones(chart, O, c.to);
      const multiZone = O.length > 1 || D.length > 1; // e.g. the United States is priced as East and West Coast
      list = chart.rows.filter(r => O.includes(r[0]) && D.includes(r[1]) && r[2] === c.cabin).sort((a, b) => a[3] - b[3]).map(r => {
        const tier = r[7] >= 0 ? chart.labels[r[7]] : '';
        const label = tier ? (/^(Saver|Advantage)$/.test(tier) ? `${tier} award` : tier) : `${CABIN[c.cabin]} award`;
        return { label: multiZone ? `${regionName(chart, r[0])} to ${regionName(chart, r[1])}: ${label}` : label, units: r[3], starting: r[4] === 1 };
      });
      if (list.length) {
        kind = 'chart';
        mult = c.pax * (ROUND_TRIP_DOUBLES.has(pid) ? c.trip : 1);
        descr = `${c.pax} passenger${c.pax === 1 ? '' : 's'}${ROUND_TRIP_DOUBLES.has(pid) && c.trip === 2 ? ', round trip' : ''}`;
      }
    }
    const items = list.map(m => {
      const partnerUnits = m.units * mult;
      let points = Math.ceil(partnerUnits * route[1] / route[2]);
      let adjusted = '';
      if (multiple && points % multiple) { points = Math.ceil(points / multiple) * multiple; adjusted = `rounded up to a multiple of ${inr.format(multiple)}`; }
      if (minTransfer && points < minTransfer) { points = minTransfer; adjusted = `raised to the ${inr.format(minTransfer)}-point transfer minimum`; }
      return { ...m, partnerUnits, points, adjusted, perPoint: c.price ? c.price / points : null };
    });
    return { kind, items, descr, chart, xf, route };
  };

  const renderTransfer = (card, plan) => {
    const [, multiple, , , cap, capWindow] = plan.xf;
    els.transfer.replaceChildren();
    els.transfer.appendChild(el('h4', 'calc-transfer-title', 'Transfer rules'));
    const line = (k, v) => { const d = el('div', 'calc-transfer-row'); d.appendChild(el('span', null, k)); d.appendChild(el('strong', null, v)); els.transfer.appendChild(d); };
    line('Ratio', `${trim(plan.route[1])} card points : ${trim(plan.route[2])} ${partnerName(plan.route[0])} ${unitWord()}${plan.route[3] ? ' (up to)' : ''}`);
    if (plan.xf[0]) line('Minimum transfer', `${inr.format(plan.xf[0])} points`);
    if (multiple) line('In multiples of', `${inr.format(multiple)} points`);
    const t = plan.xf[2] ? plan.xf[2].replace(/^upto(?=\s)/i, 'Up to') : (plan.xf[3] ? `Up to ${Math.ceil(plan.xf[3] / 24)} days` : '');
    if (t) line('Processing time', t.charAt(0).toUpperCase() + t.slice(1));
    if (cap) line('Transfer limit', `${inr.format(cap)} points ${WINDOW[capWindow] || ''}`.trim());
    if (!plan.xf.some(v => v != null)) els.transfer.appendChild(el('p', 'calc-transfer-none', 'No minimums, limits or timings are recorded for this route yet. Check your bank before transferring.'));
    const over = plan.items.filter(i => cap && i.points > cap);
    if (over.length) {
      els.transfer.appendChild(el('p', 'calc-transfer-warn', `${over.map(o => o.label).join(' and ')} ${over.length > 1 ? 'are' : 'is'} above the ${inr.format(cap)}-point transfer limit ${WINDOW[capWindow] || ''}, so ${over.length > 1 ? 'they' : 'it'} may need more than one transfer window.`.replace(/\s+,/g, ',')));
    }
    els.transfer.hidden = false;
  };

  const clearResult = () => {
    state.plan = null;
    els.verdict.dataset.tier = 'none';
    els.badge.textContent = 'Waiting';
    els.caption.textContent = 'Estimated card points needed';
    els.value.textContent = '--';
    els.label.textContent = 'Waiting for your inputs';
    els.detail.textContent = 'Choose your card, a transfer partner and the trip to see how many points you need.';
    els.balanceLine.hidden = true; els.using.hidden = true; els.note.hidden = true;
    els.options.hidden = true; els.options.replaceChildren();
    els.compare.hidden = true; els.compare.replaceChildren();
    els.transfer.hidden = true; els.transfer.replaceChildren();
    els.asof.hidden = true;
  };

  // Other partners that can price the same trip, cheapest first. Click one to switch.
  const renderCompare = (card, c, current) => {
    els.compare.replaceChildren();
    els.compare.hidden = true;
    if (state.mode !== 'airline') return;
    const quotes = routesFor(card).map(r => ({ r, p: buildPlan(card, r, { ...c, manual: 0 }) })).filter(q => q.p.kind === 'chart' && q.p.items.length)
      .map(q => ({ pid: q.r[0], plan: q.p, best: q.p.items[0] })).sort((a, b) => a.best.points - b.best.points);
    if (quotes.length < 2) return;
    els.compare.appendChild(el('h4', 'rt-compare-title', 'Compare partners for this trip'));
    quotes.forEach((q, i) => {
      const b = el('button', `rt-compare-row${q.pid === current ? ' is-current' : ''}`);
      b.type = 'button';
      const left = el('span', 'rt-compare-name');
      left.appendChild(el('strong', null, partnerName(q.pid)));
      left.appendChild(el('span', null, `${q.best.label}${q.best.starting ? ', starting price' : ''} · ${ratioText(q.plan.route[1], q.plan.route[2])}`));
      const right = el('span', 'rt-compare-pts');
      right.appendChild(el('strong', null, `${q.best.starting ? 'from ' : ''}${inr.format(q.best.points)} pts`));
      if (i === 0) right.appendChild(el('span', 'calc-chip is-ok', q.best.starting ? 'Lowest starting price' : 'Fewest points'));
      if (q.pid === current) right.appendChild(el('span', 'calc-chip', 'Selected'));
      b.appendChild(left); b.appendChild(right);
      b.addEventListener('click', () => { if (q.pid === current) return; els.partner.value = q.pid; onPartnerChange(); showResults(); });
      els.compare.appendChild(b);
    });
    if (quotes.some(q => q.best.starting)) els.compare.appendChild(el('p', 'rt-compare-note', 'A "starting" price is the lowest published for that zone. The exact award can cost more.'));
    els.compare.hidden = false;
  };

  const showResults = () => {
    const card = selectedCard();
    goTo(4);
    clearResult();
    if (!card) { renderOther(); return; }
    if (noPartnerCard(card)) {
      els.badge.textContent = 'Other ways';
      els.caption.textContent = 'No transfer partner recorded';
      els.label.textContent = "See how this card's points compare";
      els.detail.textContent = 'We have no airline or hotel transfer partner recorded for this card yet. The comparison below shows what its points are worth in other ways.';
      renderAside(); renderBanner('We have no transfer partner for this card yet. See the other ways to redeem below.');
      renderOther();
      return;
    }
    const route = routeOf(card, state.partner);
    if (!route) { renderOther(); return; }
    const c = context();
    const plan = buildPlan(card, route, c);
    renderAside();

    // No exact price: estimate from typical rupee values.
    if (plan.kind === 'none') {
      const lo = roundEst(c.price / BENCH.high), mid = roundEst(c.price / BENCH.mid), hi = roundEst(c.price / BENCH.low);
      els.verdict.dataset.tier = 'none';
      els.badge.textContent = 'Estimate';
      els.caption.textContent = 'Estimated card points needed';
      els.value.textContent = `~${inr.format(mid)}`;
      els.label.textContent = `Estimate: ${inr.format(lo)} to ${inr.format(hi)} card points`;
      els.detail.textContent = `Without an exact award price we estimate using typical values of ₹${BENCH.low} to ₹${BENCH.high} per point (₹${BENCH.mid} shown). Add the exact partner points in step 3 for a precise answer.`;
      els.using.textContent = `Card points shown in ${card.c || "your card's points"}, at a ${ratioText(route[1], route[2])} transfer ratio to ${partnerName(state.partner)}.`;
      els.using.hidden = false;
      renderTransfer(card, plan);
      renderBanner(`About ${inr.format(mid)} card points (estimate). Add exact partner points for a precise answer.`);
      renderOther();
      return;
    }

    const best = plan.items[0];
    const balance = c.balance;
    state.plan = { partner: state.partner, perPoint: best.perPoint };
    els.caption.textContent = plan.kind === 'manual' ? 'Card points needed' : (plan.items.length > 1 ? 'Estimated card points needed (cheapest award)' : 'Estimated card points needed');
    els.value.textContent = inr.format(best.points);

    // Headline: value tier when a price is given, otherwise whether the balance covers it.
    const diff = balance ? balance - best.points : null;
    if (best.perPoint != null) {
      const tier = TIERS.find(t => best.perPoint >= t.min);
      els.verdict.dataset.tier = tier.tier;
      els.badge.textContent = tier.badge;
      els.label.textContent = `₹${best.perPoint.toFixed(2)} per point: ${tier.label}`;
      els.detail.textContent = tier.detail;
    } else {
      els.verdict.dataset.tier = diff == null ? 'none' : (diff >= 0 ? 'high' : 'low');
      els.badge.textContent = diff == null ? (plan.kind === 'manual' ? 'Your points' : 'Award chart') : (diff >= 0 ? 'Covered' : 'Short');
      els.label.textContent = 'Add your price to see your rupee value per point';
      els.detail.textContent = `This is what the ${partnerName(state.partner)} award costs in ${card.c || 'your card'} points.`;
    }
    if (diff != null) {
      els.balanceLine.textContent = diff >= 0 ? `Your balance covers it, with ${inr.format(diff)} points to spare.` : `You are ${inr.format(-diff)} points short.`;
      els.balanceLine.dataset.ok = String(diff >= 0);
      els.balanceLine.hidden = false;
    }

    const currency = card.c ? ` (${card.c})` : '';
    els.using.textContent = `${inr.format(best.partnerUnits)} ${partnerName(state.partner)} ${unitWord()}${plan.descr ? ` for ${plan.descr}` : ''} at a ${ratioText(route[1], route[2])} ratio needs ${inr.format(best.points)} card points${currency}.${best.adjusted ? ` ${best.adjusted.charAt(0).toUpperCase()}${best.adjusted.slice(1)}.` : ''}`;
    els.using.hidden = false;
    if (route[3]) {
      els.note.textContent = 'The bank publishes this ratio as "up to", so your actual ratio may be lower and you may need more card points.';
      els.note.hidden = false;
    }

    if (plan.items.length > 1) {
      plan.items.forEach(i => {
        const row = el('div', 'calc-opt');
        const left = el('div', 'calc-opt-main');
        left.appendChild(el('strong', null, i.label));
        left.appendChild(el('span', null, `${inr.format(i.partnerUnits)} ${unitWord()}${i.starting ? ', starting at' : ''}`));
        row.appendChild(left);
        const right = el('div', 'calc-opt-side');
        right.appendChild(el('strong', null, `${inr.format(i.points)} pts`));
        if (balance) right.appendChild(el('span', `calc-chip ${balance >= i.points ? 'is-ok' : 'is-short'}`, balance >= i.points ? 'Covered' : `Short ${inr.format(i.points - balance)}`));
        if (i.perPoint != null) right.appendChild(el('span', 'calc-chip', `₹${i.perPoint.toFixed(2)} / pt`));
        row.appendChild(right);
        els.options.appendChild(row);
      });
      els.options.hidden = false;
    }
    renderTransfer(card, plan);
    if (plan.kind !== 'manual') renderCompare(card, c, state.partner);

    if (plan.kind === 'chart' && plan.chart.asOf) {
      const when = new Date(plan.chart.asOf);
      els.asof.textContent = `Award chart effective ${Number.isNaN(when.getTime()) ? 'date not recorded' : when.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Prices exclude taxes and fees, and seat availability is not guaranteed.`;
      els.asof.hidden = false;
    }
    renderBanner(`You need about ${inr.format(best.points)} card points${best.perPoint != null ? `, a value of ₹${best.perPoint.toFixed(2)} per point` : '. Add your price to see the value you get'}.`);
    renderOther();
  };

  // ── Other ways to redeem ──
  const renderOther = () => {
    const card = selectedCard();
    els.ways.replaceChildren();
    if (!card || state.step < 4) { els.other.hidden = true; return; }
    const balance = parseNumber(els.balance.value);
    const modes = (state.red && state.red.modes && state.red.modes[card.id]) || {};
    const list = Object.entries(modes).map(([k, [value, ceil]]) => ({ label: WAY[k] || k, value, ceil: !!ceil }));
    if (state.plan && state.plan.perPoint != null) list.push({ label: `Your planned transfer (${partnerName(state.plan.partner)})`, value: state.plan.perPoint, planned: true });
    list.sort((a, b) => b.value - a.value);
    els.other.hidden = false;
    els.otherTitle.textContent = `How ${card.c || 'your points'} compare`;
    if (!list.length) {
      els.otherSub.textContent = 'We have no published redemption values for this card yet. Add a cash price to see the value of a transfer.';
      return;
    }
    els.otherSub.textContent = balance ? `Rupee value of ${inr.format(balance)} points, best first.` : 'Rupee value per point, best first. Add your balance to see totals.';
    const max = list[0].value || 1;
    list.forEach((w, i) => {
      const li = el('li', `calc-way${i === 0 ? ' is-best' : ''}${w.planned ? ' is-planned' : ''}`);
      const head = el('div', 'calc-way-head');
      head.appendChild(el('strong', null, w.label));
      if (i === 0) head.appendChild(el('span', 'calc-way-tag', 'Best value'));
      li.appendChild(head);
      const bar = el('div', 'calc-way-bar'); const fill = el('span'); fill.style.width = `${Math.max(4, (w.value / max) * 100)}%`; bar.appendChild(fill); li.appendChild(bar);
      const meta = el('div', 'calc-way-meta');
      meta.appendChild(el('span', null, `${w.ceil ? 'Up to ' : ''}₹${w.value.toFixed(2)} per point`));
      if (balance) meta.appendChild(el('strong', null, `${w.ceil ? 'Up to ' : ''}₹${inr.format(Math.round(balance * w.value))}`));
      li.appendChild(meta);
      els.ways.appendChild(li);
    });
  };

  const restart = () => {
    els.origin.value = 'India'; els.dest.value = '';
    els.balance.value = ''; els.price.value = ''; els.points.value = ''; els.nights.value = '1';
    setTrip(1);
    state.maxStep = 1; state.partner = ''; state.exact = false; state.plan = null;
    setMode('airline');
    els.bank.value = ''; populateCards();
    els.routeHint.hidden = true;
    showError(0);
    state.step = 1;
    renderOther();
    goTo(1);
  };

  const showLoadError = () => {
    setOptions(els.bank, 'Could not load banks', [], true);
    showError(2, 'We could not load card data. Please refresh the page and try again.');
  };

  const load = async () => {
    try {
      // Everything except the transfer ratios is optional: without it the tool still works, with less detail.
      const optional = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const artRequest = optional('/data/card-art.json');
      const redRequest = optional('/data/redemption-data.json');
      const recRequest = optional('/data/recommender-data.json');
      const airRequest = optional('/data/airports.json');
      const res = await fetch('/data/calculator-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.art = (await artRequest) || {};
      state.red = await redRequest;
      const rec = (await recRequest) || { banks: [], cards: [] };
      const airData = await airRequest;
      if (airData && airData.airports) {
        state.air = airData.airports.map(([code, name, city, ci]) => {
          const country = airData.countries[ci];
          return { code, name, city, country, label: `${city} (${code})`, cityKey: norm(city), countryKey: norm(country), codeKey: code.toLowerCase(), nameKey: norm(`${name} ${city}`) };
        });
        state.air.forEach(ap => { state.airByLabel.set(norm(ap.label), ap); state.airByCode.set(ap.codeKey, ap); });
      }

      [...(rec.banks || []), ...state.data.banks].forEach(b => state.banks.set(b.id, b.name));
      (rec.cards || []).forEach(c => state.rec.set(c.id, c));
      // Transfer ratios come from the calculator data; recommender data names the cards that have none.
      const byId = new Map();
      (rec.cards || []).forEach(c => byId.set(c.id, { id: c.id, n: c.n, b: c.b, c: c.c, r: [] }));
      state.data.cards.forEach(c => byId.set(c.id, { ...(byId.get(c.id) || {}), id: c.id, n: c.n, b: c.b, c: c.c || (byId.get(c.id) || {}).c, r: c.r }));
      byId.forEach(card => { if (card.r.length || hasModes(card)) state.cards.set(card.id, card); });

      if (state.data.generatedAt && els.source) {
        const when = new Date(state.data.generatedAt);
        if (!Number.isNaN(when.getTime())) {
          els.source.textContent = `Transfer ratios last refreshed ${when.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Always confirm the current ratio with your bank before transferring.`;
        }
      }
      els.pax.replaceChildren();
      for (let i = 1; i <= 9; i++) { const o = el('option', null, String(i)); o.value = String(i); els.pax.appendChild(o); }
      populateBanks();
      updateRouteHint();
    } catch (err) {
      showLoadError();
    }
  };

  // ── Events ──
  typeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  ['input', 'change'].forEach(ev => {
    els.origin.addEventListener(ev, updateRouteHint);
    els.dest.addEventListener(ev, updateRouteHint);
  });
  els.dest.addEventListener('blur', () => setTimeout(updateRouteHint, 150));
  els.dest.addEventListener('input', () => renderBanner());
  els.swap.addEventListener('click', () => {
    const a = els.origin.value;
    els.origin.value = els.dest.value;
    els.dest.value = a;
    updateRouteHint();
    renderBanner();
  });
  els.next1.addEventListener('click', () => advance(2));
  els.next2.addEventListener('click', () => advance(3));
  els.next3.addEventListener('click', () => advance(4));
  els.restart.addEventListener('click', restart);
  els.change.addEventListener('click', () => goTo(2));
  document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
    let n = Number(b.dataset.back);
    if (n === 3 && noPartnerCard(selectedCard())) n = 2;
    if (n === 3) prepareStep3(); else goTo(n);
  }));
  stepBtns.forEach(b => b.addEventListener('click', () => {
    if (b.disabled) return;
    const n = Number(b.dataset.step);
    if (n < state.step) { if (n === 3) prepareStep3(); else goTo(n); } else if (n > state.step) advance(n);
  }));
  els.bank.addEventListener('change', populateCards);
  els.card.addEventListener('change', onCardChange);
  els.partner.addEventListener('change', onPartnerChange);
  tripButtons.forEach(b => b.addEventListener('click', () => setTrip(Number(b.dataset.trip))));
  [els.price, els.points, els.nights, els.balance].forEach(input => input.addEventListener('input', () => formatInput(input)));
  els.manualToggle.addEventListener('click', () => {
    const open = els.manual.hidden;
    els.manual.hidden = !open;
    els.manualToggle.setAttribute('aria-expanded', String(open));
    if (open) els.points.focus();
  });
  form.addEventListener('submit', event => event.preventDefault());

  makeCombo({ input: els.origin, list: els.originList, items: () => placeItems(true), popular: POPULAR_ORIGIN, heading: 'Popular departure places', after: () => els.dest.focus() });
  makeCombo({ input: els.dest, list: els.destList, items: () => placeItems(false), popular: POPULAR_DEST, heading: 'Popular destinations', after: () => els.next1.focus() });

  renderAside();
  renderBanner();
  load();
})();
