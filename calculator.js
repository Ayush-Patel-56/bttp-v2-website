(() => {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const els = {
    bank: $('calc-bank'), card: $('calc-card'), balance: $('calc-balance'), partner: $('calc-partner'), price: $('calc-price'), points: $('calc-points'),
    error: $('calc-error'), partnerLabel: $('calc-partner-label'), priceLabel: $('calc-price-label'), priceHint: $('calc-price-hint'), priceField: $('calc-price-field'),
    route: $('calc-route'), flight: $('calc-flight'), hotel: $('calc-hotel'),
    origin: $('calc-origin'), dest: $('calc-dest'), originList: $('calc-origin-list'), destList: $('calc-dest-list'), zone: $('calc-zone'),
    cabin: $('calc-cabin'), pax: $('calc-pax'), tripType: $('calc-trip-type'), nights: $('calc-nights'),
    partnerNote: $('calc-partner-note'), manualToggle: $('calc-manual-toggle'), manual: $('calc-manual'),
    cardVisual: $('calc-card-visual'), cardName: $('calc-card-name'), cardBank: $('calc-card-bank'),
    art: $('calc-art'), artImg: $('calc-art-img'), artName: $('calc-art-name'), artBank: $('calc-art-bank'),
    cardCurrency: $('calc-card-currency'), cardValue: $('calc-card-value'),
    verdict: $('calc-verdict'), badge: $('calc-badge'), caption: $('calc-caption'), value: $('calc-value'), label: $('calc-label'), detail: $('calc-detail'),
    balanceLine: $('calc-balance-line'), using: $('calc-using'), note: $('calc-note'), options: $('calc-options'), transfer: $('calc-transfer'), asof: $('calc-asof'),
    other: $('calc-other'), otherTitle: $('calc-other-title'), otherSub: $('calc-other-sub'), ways: $('calc-ways'), source: $('calc-source')
  };
  const toggles = Array.from(document.querySelectorAll('.calc-toggle-btn[data-mode]'));
  const tripButtons = Array.from(document.querySelectorAll('[data-trip]'));

  const COPY = {
    airline: { partner: 'Select airline partner', price: 'Ticket price' },
    hotel: { partner: 'Select hotel partner', price: 'Stay price' }
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
  // Typical rupee value per point. Used only to estimate when a partner has no award chart.
  const BENCH = { low: 1, mid: 2, high: 4 };

  // Rupee-per-point cut-offs, highest first. Same thresholds as the page's benchmark badges.
  const TIERS = [
    { min: 4, tier: 'high', badge: 'High Value', label: 'Excellent redemption value', detail: 'This is the kind of redemption that usually justifies using points instead of defaulting to cashback.' },
    { min: 2, tier: 'good', badge: 'Good Value', label: 'Strong redemption value', detail: 'This is comfortably above the low-value range and generally worth serious consideration.' },
    { min: 1, tier: 'okay', badge: 'Okay Value', label: 'Average redemption value', detail: 'This is usable, but there may be better ways to use the same points on flights or hotels.' },
    { min: 0, tier: 'low', badge: 'Low Value', label: 'Low redemption value', detail: 'This is where vouchers and cashback often leave a lot of value on the table.' }
  ];

  const inr = new Intl.NumberFormat('en-IN');
  const state = { data: null, red: null, art: {}, banks: new Map(), mode: 'airline', cards: new Map(), partner: '', chart: null, trip: 1, plan: null };

  const digits = value => value.replace(/[^\d]/g, '');
  const parseNumber = value => Number(digits(value)) || 0;
  const formatInput = input => { const d = digits(input.value); input.value = d ? inr.format(Number(d)) : ''; };
  const trim = (n, d = 2) => String(Number(n.toFixed(d)));
  const ratioText = (from, to) => `${inr.format(from)} : ${inr.format(to)}`;
  const roundEst = n => Math.max(500, Math.round(n / 500) * 500);
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

  // ── Award chart lookups: users type a country or city, the chart is keyed by pricing zone ──
  const rows = () => (state.chart ? state.chart.rows : []);
  const isHotelChart = () => rows().length > 0 && rows()[0][6] === 2;
  const regionName = i => state.chart.regions[i];
  const places = () => (state.chart && state.chart.places) || [];
  const regionsOf = input => {
    const v = input.value.trim().toLowerCase();
    return v ? Array.from(new Set(places().filter(p => p[0].toLowerCase() === v).map(p => p[1]))) : [];
  };
  const originRegions = () => (els.origin.disabled && state.chart ? Array.from(new Set(rows().map(r => r[0]))) : regionsOf(els.origin));
  const reachable = O => new Set(rows().filter(r => O.includes(r[0])).map(r => r[1]));
  const destRegions = () => { const ok = reachable(originRegions()); return regionsOf(els.dest).filter(i => ok.has(i)); };
  const zoneText = regions => regions.map(regionName).join(' / ');

  // ── Search box for places: popular choices first, type to search everything ──
  const POPULAR_DEST = ['Singapore', 'United Arab Emirates', 'Thailand', 'United Kingdom', 'United States', 'Japan', 'Australia', 'Malaysia', 'Indonesia',
    'Hong Kong SAR, China', 'Hong Kong', 'Maldives', 'Sri Lanka', 'Nepal', 'Vietnam', 'France', 'Germany', 'Italy', 'Switzerland', 'Canada', 'Turkey',
    'Spain', 'Netherlands', 'Dubai', 'London', 'Paris', 'Bangkok', 'Tokyo', 'New York'];
  const POPULAR_ORIGIN = ['India', 'Singapore', 'United Arab Emirates', 'United Kingdom', 'United States', 'Australia', 'Thailand', 'Malaysia', 'Canada', 'Germany', 'France', 'Dubai', 'London'];
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
  const norm = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // Unique places for the current chart. `ok` says whether the programme prices it from the chosen origin.
  const placeItems = originOnly => {
    const map = new Map();
    const origins = new Set(rows().map(r => r[0]));
    const reach = originOnly ? null : reachable(originRegions());
    places().forEach(([name, region, kind]) => {
      if (originOnly && !origins.has(region)) return;
      const it = map.get(name) || { name, kind, ok: false };
      if (originOnly || reach.has(region)) it.ok = true;
      map.set(name, it);
    });
    return Array.from(map.values());
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
      // mousedown, not click: the input would lose focus and close the list first.
      li.addEventListener('mousedown', e => { e.preventDefault(); choose(item); });
      list.appendChild(li);
      shown.push(item);
    };
    const kindText = k => (k === 'y' ? 'City' : 'Country');
    const build = fresh => {
      const raw = input.value;
      const q = fresh ? '' : norm(raw);
      const all = cfg.items();
      list.replaceChildren(); shown = []; active = -1;
      if (!q) {
        const byName = new Map(all.map(i => [i.name, i]));
        let pop = cfg.popular.map(n => byName.get(n)).filter(i => i && i.ok).slice(0, 12);
        if (!pop.length) pop = all.filter(i => i.ok).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
        if (pop.length) {
          list.appendChild(el('li', 'calc-combo-head', cfg.heading));
          pop.forEach(i => row(i, kindText(i.kind)));
        }
        list.appendChild(el('li', 'calc-combo-foot', `Type to search all ${all.length} places`));
      } else {
        const rank = i => { const n = norm(i.name); return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[\s,()-]+/).some(w => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : 9; };
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
        const sub = x => (x.i.ok ? kindText(x.i.kind) : 'No price from here');
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

  // ── Result helpers ──
  const resetResult = message => {
    state.plan = null;
    els.verdict.dataset.tier = 'none';
    els.cardVisual.dataset.state = els.card.value ? 'selected' : 'empty';
    els.badge.textContent = 'Waiting';
    els.caption.textContent = 'Estimated card points needed';
    els.value.textContent = '--';
    els.label.textContent = 'Waiting for your inputs';
    els.detail.textContent = message || 'Choose your card, a transfer partner and the trip to see how many points you need.';
    els.cardValue.textContent = '—';
    els.balanceLine.hidden = true;
    els.using.hidden = true;
    els.note.hidden = true;
    els.options.hidden = true; els.options.replaceChildren();
    els.transfer.hidden = true; els.transfer.replaceChildren();
    els.asof.hidden = true;
    els.error.hidden = true;
  };

  const updateCardVisual = () => {
    const card = selectedCard();
    const bankName = card ? state.banks.get(card.b) : null;
    const art = card ? state.art[card.id] : null;
    if (art) {
      els.artImg.src = `/assets/cards/${art.f}`;
      els.artImg.width = art.w; els.artImg.height = art.h;
      els.artImg.alt = `${card.n} credit card`;
      els.art.classList.toggle('is-vertical', art.h > art.w);
      els.artName.textContent = card.n;
      els.artBank.textContent = bankName || '';
    }
    els.art.hidden = !art;
    els.cardVisual.hidden = !!art;
    els.cardName.textContent = card ? card.n : 'Select a card';
    els.cardBank.textContent = bankName || 'Choose your bank and card';
    els.cardCurrency.textContent = card && card.c ? card.c : '—';
    els.cardVisual.dataset.state = card ? 'selected' : 'empty';
  };

  // ── Route UI for partners that have an award chart ──
  const clearRoute = () => {
    [els.origin, els.dest].forEach(i => { i.value = ''; i.disabled = false; });
    setOptions(els.cabin, 'Select cabin', [], true);
    els.zone.hidden = true;
    els.tripType.hidden = true;
  };

  const setTrip = n => {
    state.trip = n;
    tripButtons.forEach(b => { const on = Number(b.dataset.trip) === n; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  };

  const onOriginChange = () => {
    const O = originRegions();
    els.dest.disabled = !O.length;
    if (!O.length) els.dest.value = '';
    onDestChange();
  };

  const onDestChange = () => {
    const O = originRegions(), D = destRegions();
    const cabins = Array.from(new Set(rows().filter(r => O.includes(r[0]) && D.includes(r[1])).map(r => r[2])))
      .sort((a, b) => CABIN_ORDER.indexOf(a) - CABIN_ORDER.indexOf(b));
    setOptions(els.cabin, 'Select cabin', cabins.map(c => ({ value: c, text: CABIN[c] })), !D.length, true);
    if (O.length && D.length) {
      els.zone.textContent = `${partnerName(state.partner)} prices this as ${zoneText(O)} to ${zoneText(D)}.`;
      els.zone.hidden = false;
    } else if (els.dest.value.trim() && O.length) {
      const known = regionsOf(els.dest);
      if (known.length) {
        const pair = `${zoneText(O)} to ${zoneText(known)}`;
        els.zone.textContent = state.partner === 'krisflyer'
          ? `KrisFlyer does not publish a fixed price for ${pair}. Its award chart marks these routes "use the mileage calculator", so check the exact miles on singaporeair.com.`
          : `${partnerName(state.partner)} does not publish a price for ${pair} in the award chart we hold. Check the exact price on the airline's site.`;
        els.zone.hidden = false;
      } else if (document.activeElement === els.dest) {
        // Still typing: the list below is the guide, so do not flash an error yet.
        els.zone.hidden = true;
      } else {
        els.zone.textContent = `We could not find "${els.dest.value.trim()}". Pick a country or city from the list.`;
        els.zone.hidden = false;
      }
    } else {
      els.zone.hidden = true;
    }
    compute();
  };

  // ── Selects ──
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
      const partners = routesFor(card)
        .map(r => ({ value: r[0], text: `${state.data.partners[r[0]].n} (${ratioText(r[1], r[2])})` }))
        .sort((a, b) => a.text.localeCompare(b.text));
      setOptions(els.partner, 'Select a partner', partners, false);
    }
    updateCardVisual();
    onPartnerChange();
  };

  const onPartnerChange = () => {
    const card = selectedCard();
    state.partner = els.partner.value;
    const chart = state.partner && state.red && state.red.charts ? state.red.charts[state.partner] : null;
    state.chart = chart && chart.rows && chart.rows.length ? chart : null;
    const noPartner = noPartnerCard(card);

    // The manual box starts closed whenever the partner changes.
    els.points.value = '';
    els.manual.hidden = true;
    els.manualToggle.setAttribute('aria-expanded', 'false');
    els.manualToggle.hidden = !state.partner;
    els.priceField.hidden = noPartner;

    if (noPartner) {
      els.route.hidden = true;
      els.partnerNote.textContent = 'We have no airline or hotel transfer partner recorded for this card yet. See how its points compare across other ways to redeem below.';
      els.partnerNote.hidden = false;
    } else if (state.chart) {
      els.route.hidden = false;
      els.partnerNote.hidden = true;
      clearRoute();
      if (isHotelChart()) {
        els.flight.hidden = true; els.hotel.hidden = false;
      } else {
        els.flight.hidden = false; els.hotel.hidden = true;
        const origins = new Set(rows().map(r => r[0]));
        const originPlaces = places().filter(p => origins.has(p[1]));
        if (origins.size === 1) {
          // One departure zone only (Maharaja Club from India, Finnair from Helsinki): fixed.
          els.origin.value = originPlaces.length === 1 ? originPlaces[0][0] : regionName(Array.from(origins)[0]);
          els.origin.disabled = true;
        } else if (originPlaces.some(p => p[0] === 'India')) {
          els.origin.value = 'India';
        }
        els.tripType.hidden = !ROUND_TRIP_DOUBLES.has(state.partner);
        if (els.tripType.hidden) setTrip(1);
        onOriginChange();
      }
    } else {
      els.route.hidden = true;
      if (state.partner) {
        els.partnerNote.textContent = `We do not hold a published award chart for ${partnerName(state.partner)} yet, so we estimate from your price. If you know the exact points, add them below.`;
        els.partnerNote.hidden = false;
      } else {
        els.partnerNote.hidden = true;
      }
    }

    // Labels depend on whether a chart can fill in the points for us.
    const base = COPY[state.mode].price;
    els.priceLabel.textContent = state.chart ? `${base} (optional)` : base;
    els.priceHint.textContent = state.chart
      ? 'Add it to see your rupee value per point. Use the price excluding taxes and fees.'
      : 'We use it to estimate the points you need. Use the price excluding taxes and fees.';
    resetResult();
    compute();
  };

  const setMode = mode => {
    state.mode = mode;
    toggles.forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    els.partnerLabel.textContent = COPY[mode].partner;
    els.priceLabel.textContent = COPY[mode].price;
    if (state.data) populateBanks();
  };

  // ── Work out which partner-point prices apply ──
  const priceOptions = () => {
    const manual = parseNumber(els.points.value);
    if (manual > 0) return { kind: 'manual', list: [{ label: 'Your partner points', units: manual }], mult: 1, descr: '' };
    if (!state.chart) return { kind: 'none' };

    if (isHotelChart()) {
      const nights = Math.max(1, parseNumber(els.nights.value));
      const sorted = rows().slice().sort((a, b) => a[3] - b[3]);
      return {
        kind: 'chart', mult: nights, descr: `${nights} night${nights === 1 ? '' : 's'}`,
        list: sorted.map((r, i) => ({ label: `Tier ${i + 1} of ${sorted.length}${i === 0 ? ' (lowest)' : i === sorted.length - 1 ? ' (highest)' : ''}`, units: r[3] }))
      };
    }
    const O = originRegions(), D = destRegions(), c = els.cabin.value;
    if (!O.length || !D.length || !c) return { kind: 'incomplete' };
    const multiZone = O.length > 1 || D.length > 1; // e.g. the United States is priced as East and West Coast
    const list = rows().filter(r => O.includes(r[0]) && D.includes(r[1]) && r[2] === c).sort((a, b) => a[3] - b[3]).map(r => {
      const tier = r[7] >= 0 ? state.chart.labels[r[7]] : '';
      const kind = tier ? (/^(Saver|Advantage)$/.test(tier) ? `${tier} award` : tier) : `${CABIN[c]} award`;
      return { label: multiZone ? `${regionName(r[0])} to ${regionName(r[1])}: ${kind}` : kind, units: r[3], starting: r[4] === 1 };
    });
    const pax = Number(els.pax.value) || 1;
    const trip = ROUND_TRIP_DOUBLES.has(state.partner) ? state.trip : 1;
    return { kind: list.length ? 'chart' : 'incomplete', list, mult: pax * trip, descr: `${pax} passenger${pax === 1 ? '' : 's'}${trip === 2 ? ', round trip' : ''}` };
  };

  // ── Transfer rules block ──
  const renderTransfer = (card, route, xf, items) => {
    const [minTransfer, multiple, procText, procHours, cap, capWindow] = xf;
    els.transfer.replaceChildren();
    els.transfer.appendChild(el('h4', 'calc-transfer-title', 'Transfer rules'));
    const line = (k, v) => { const d = el('div', 'calc-transfer-row'); d.appendChild(el('span', null, k)); d.appendChild(el('strong', null, v)); els.transfer.appendChild(d); };
    line('Ratio', `${trim(route[1])} card points : ${trim(route[2])} ${partnerName(state.partner)} ${unitWord()}${route[3] ? ' (up to)' : ''}`);
    if (minTransfer) line('Minimum transfer', `${inr.format(minTransfer)} points`);
    if (multiple) line('In multiples of', `${inr.format(multiple)} points`);
    if (procText) { const t = procText.replace(/^upto(?=\s)/i, 'Up to'); line('Processing time', t.charAt(0).toUpperCase() + t.slice(1)); }
    else if (procHours) line('Processing time', `Up to ${Math.ceil(procHours / 24)} days`);
    if (cap) line('Transfer limit', `${inr.format(cap)} points ${WINDOW[capWindow] || ''}`.trim());
    if (!minTransfer && !multiple && !procText && !procHours && !cap) els.transfer.appendChild(el('p', 'calc-transfer-none', 'No minimums, limits or timings are recorded for this route yet. Check your bank before transferring.'));
    const over = (items || []).filter(i => cap && i.points > cap);
    if (over.length) {
      els.transfer.appendChild(el('p', 'calc-transfer-warn', `${over.map(o => o.label).join(' and ')} ${over.length > 1 ? 'are' : 'is'} above the ${inr.format(cap)}-point transfer limit ${WINDOW[capWindow] || ''}, so ${over.length > 1 ? 'they' : 'it'} may need more than one transfer window.`.replace(/\s+,/g, ',')));
    }
    els.transfer.hidden = false;
  };

  const compute = () => {
    const card = selectedCard();
    if (!card) { resetResult(); renderOther(); return; }
    if (noPartnerCard(card)) {
      resetResult('No airline or hotel transfer partner is recorded for this card yet. See how its points compare below.');
      renderOther();
      return;
    }
    const route = card.r.find(r => r[0] === state.partner);
    if (!route) { resetResult(); renderOther(); return; }
    const price = parseNumber(els.price.value);
    const balance = parseNumber(els.balance.value);
    const xf = xferOf(card, state.partner);
    const [minTransfer, multiple] = xf;
    const o = priceOptions();
    els.error.hidden = true;

    if (o.kind === 'incomplete') {
      resetResult('Choose where you are flying to and your cabin, and the points needed will appear here.');
      renderTransferOnly(card, route, xf);
      renderOther();
      return;
    }

    // No chart and no exact points: an estimate from typical rupee values.
    if (o.kind === 'none') {
      state.plan = null;
      if (!price) { resetResult('Enter your price and we will estimate the points you need.'); renderTransferOnly(card, route, xf); renderOther(); return; }
      const lo = roundEst(price / BENCH.high), mid = roundEst(price / BENCH.mid), hi = roundEst(price / BENCH.low);
      els.verdict.dataset.tier = 'none';
      els.badge.textContent = 'Estimate';
      els.caption.textContent = 'Estimated card points needed';
      els.value.textContent = `~${inr.format(mid)}`;
      els.label.textContent = `Estimate: ${inr.format(lo)} to ${inr.format(hi)} card points`;
      els.detail.textContent = `Without an award chart we estimate using typical values of ₹${BENCH.low} to ₹${BENCH.high} per point (₹${BENCH.mid} shown). Add the exact points below for a precise answer.`;
      els.cardValue.textContent = '—';
      els.cardVisual.dataset.state = 'selected';
      els.balanceLine.hidden = true;
      els.using.textContent = `Card points shown in ${card.c || 'your card\'s points'}, at a ${ratioText(route[1], route[2])} transfer ratio to ${partnerName(state.partner)}.`;
      els.using.hidden = false;
      els.note.hidden = true; els.options.hidden = true; els.options.replaceChildren(); els.asof.hidden = true;
      renderTransfer(card, route, xf, []);
      renderOther();
      return;
    }

    // Exact path: award chart or the user's own miles. Round to the bank's transfer rules.
    const items = o.list.map(m => {
      const partnerUnits = m.units * o.mult;
      let points = Math.ceil(partnerUnits * route[1] / route[2]);
      let adjusted = '';
      if (multiple && points % multiple) { points = Math.ceil(points / multiple) * multiple; adjusted = `rounded up to a multiple of ${inr.format(multiple)}`; }
      if (minTransfer && points < minTransfer) { points = minTransfer; adjusted = `raised to the ${inr.format(minTransfer)}-point transfer minimum`; }
      return { ...m, partnerUnits, points, adjusted, perPoint: price ? price / points : null };
    });
    const best = items[0];
    state.plan = { partner: state.partner, perPoint: best.perPoint };

    els.caption.textContent = o.kind === 'manual' ? 'Card points needed' : (items.length > 1 ? 'Estimated card points needed (cheapest award)' : 'Estimated card points needed');
    els.value.textContent = inr.format(best.points);

    // Headline: value tier when a price is given, otherwise whether the balance covers it.
    const diff = balance ? balance - best.points : null;
    if (best.perPoint != null) {
      const tier = TIERS.find(t => best.perPoint >= t.min);
      els.verdict.dataset.tier = tier.tier;
      els.badge.textContent = tier.badge;
      els.label.textContent = `₹${best.perPoint.toFixed(2)} per point: ${tier.label}`;
      els.detail.textContent = tier.detail;
      els.cardValue.textContent = `₹${best.perPoint.toFixed(2)}`;
      els.cardVisual.dataset.state = 'result';
    } else {
      els.verdict.dataset.tier = diff == null ? 'none' : (diff >= 0 ? 'high' : 'low');
      els.badge.textContent = diff == null ? (o.kind === 'manual' ? 'Your points' : 'Award chart') : (diff >= 0 ? 'Covered' : 'Short');
      els.label.textContent = 'Add your price to see your rupee value per point';
      els.detail.textContent = `This is what the ${partnerName(state.partner)} award costs in ${card.c || 'your card'} points.`;
      els.cardValue.textContent = '—';
      els.cardVisual.dataset.state = 'selected';
    }
    if (diff != null) {
      els.balanceLine.textContent = diff >= 0 ? `Your balance covers it, with ${inr.format(diff)} points to spare.` : `You are ${inr.format(-diff)} points short.`;
      els.balanceLine.dataset.ok = String(diff >= 0);
      els.balanceLine.hidden = false;
    } else {
      els.balanceLine.hidden = true;
    }

    const currency = card.c ? ` (${card.c})` : '';
    const forWhat = o.descr ? ` for ${o.descr}` : '';
    els.using.textContent = `${inr.format(best.partnerUnits)} ${partnerName(state.partner)} ${unitWord()}${forWhat} at a ${ratioText(route[1], route[2])} ratio needs ${inr.format(best.points)} card points${currency}.${best.adjusted ? ` ${best.adjusted.charAt(0).toUpperCase()}${best.adjusted.slice(1)}.` : ''}`;
    els.using.hidden = false;

    if (route[3]) {
      els.note.textContent = 'The bank publishes this ratio as "up to", so your actual ratio may be lower and you may need more card points.';
      els.note.hidden = false;
    } else {
      els.note.hidden = true;
    }

    els.options.replaceChildren();
    if (items.length > 1) {
      items.forEach(i => {
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
    } else {
      els.options.hidden = true;
    }

    renderTransfer(card, route, xf, items);

    if (o.kind === 'chart' && state.chart.asOf) {
      const when = new Date(state.chart.asOf);
      els.asof.textContent = `Award chart effective ${Number.isNaN(when.getTime()) ? 'date not recorded' : when.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Prices exclude taxes and fees, and seat availability is not guaranteed.`;
      els.asof.hidden = false;
    } else {
      els.asof.hidden = true;
    }
    renderOther();
  };

  // Transfer rules are useful even before the trip is complete.
  const renderTransferOnly = (card, route, xf) => { if (xf.length) renderTransfer(card, route, xf, []); };

  // ── Other ways to redeem ──
  const renderOther = () => {
    const card = selectedCard();
    els.ways.replaceChildren();
    if (!card) { els.other.hidden = true; return; }
    const balance = parseNumber(els.balance.value);
    const modes = (state.red && state.red.modes && state.red.modes[card.id]) || {};
    const list = Object.entries(modes).map(([k, [value, ceil]]) => ({ label: WAY[k] || k, value, ceil: !!ceil }));
    if (state.plan && state.plan.perPoint != null) list.push({ label: `Your planned transfer (${partnerName(state.plan.partner)})`, value: state.plan.perPoint, planned: true });
    list.sort((a, b) => b.value - a.value);
    els.other.hidden = false;
    els.otherTitle.textContent = `How ${card.c || 'your points'} compare`;
    if (!list.length) {
      els.otherSub.textContent = 'We have no published redemption values for this card yet. Add a cash price above to see the value of a transfer.';
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

  const showLoadError = () => {
    setOptions(els.bank, 'Could not load banks', [], true);
    els.error.textContent = 'We could not load card data. Please refresh the page and try again.';
    els.error.hidden = false;
  };

  const load = async () => {
    try {
      // Everything except the transfer ratios is optional: without it the tool still works, with less detail.
      const optional = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const artRequest = optional('/data/card-art.json');
      const redRequest = optional('/data/redemption-data.json');
      const recRequest = optional('/data/recommender-data.json');
      const res = await fetch('/data/calculator-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.art = (await artRequest) || {};
      state.red = await redRequest;
      const rec = (await recRequest) || { banks: [], cards: [] };

      [...(rec.banks || []), ...state.data.banks].forEach(b => state.banks.set(b.id, b.name));
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
    } catch (err) {
      showLoadError();
    }
  };

  toggles.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  els.bank.addEventListener('change', populateCards);
  els.card.addEventListener('change', onCardChange);
  els.partner.addEventListener('change', onPartnerChange);
  ['input', 'change'].forEach(ev => {
    els.origin.addEventListener(ev, onOriginChange);
    els.dest.addEventListener(ev, onDestChange);
  });
  els.cabin.addEventListener('change', compute);
  els.pax.addEventListener('change', compute);
  tripButtons.forEach(b => b.addEventListener('click', () => { setTrip(Number(b.dataset.trip)); compute(); }));
  [els.price, els.points, els.nights, els.balance].forEach(input => {
    input.addEventListener('input', () => { formatInput(input); compute(); });
  });
  els.manualToggle.addEventListener('click', () => {
    const open = els.manual.hidden;
    els.manual.hidden = !open;
    els.manualToggle.setAttribute('aria-expanded', String(open));
    if (open) els.points.focus();
  });
  form.addEventListener('submit', event => event.preventDefault());

  makeCombo({ input: els.origin, list: els.originList, items: () => placeItems(true), popular: POPULAR_ORIGIN, heading: 'Popular departure places', after: () => els.dest.focus() });
  makeCombo({ input: els.dest, list: els.destList, items: () => placeItems(false), popular: POPULAR_DEST, heading: 'Popular destinations', after: () => { if (!els.cabin.disabled) els.cabin.focus(); } });

  load();
})();
