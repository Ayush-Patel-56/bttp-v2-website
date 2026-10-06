(() => {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const els = {
    bank: $('calc-bank'), card: $('calc-card'), partner: $('calc-partner'), price: $('calc-price'), points: $('calc-points'),
    error: $('calc-error'), partnerLabel: $('calc-partner-label'), priceLabel: $('calc-price-label'), priceHint: $('calc-price-hint'),
    route: $('calc-route'), flight: $('calc-flight'), hotel: $('calc-hotel'),
    origin: $('calc-origin'), dest: $('calc-dest'), originList: $('calc-origin-list'), destList: $('calc-dest-list'), zone: $('calc-zone'),
    cabin: $('calc-cabin'), pax: $('calc-pax'), tripType: $('calc-trip-type'), nights: $('calc-nights'),
    partnerNote: $('calc-partner-note'), manualToggle: $('calc-manual-toggle'), manual: $('calc-manual'),
    cardVisual: $('calc-card-visual'), cardName: $('calc-card-name'), cardBank: $('calc-card-bank'),
    art: $('calc-art'), artImg: $('calc-art-img'), artName: $('calc-art-name'), artBank: $('calc-art-bank'),
    cardCurrency: $('calc-card-currency'), cardValue: $('calc-card-value'),
    verdict: $('calc-verdict'), badge: $('calc-badge'), caption: $('calc-caption'), value: $('calc-value'), label: $('calc-label'), detail: $('calc-detail'),
    using: $('calc-using'), note: $('calc-note'), options: $('calc-options'), asof: $('calc-asof'), xlink: $('calc-xlink'), source: $('calc-source')
  };
  const toggles = Array.from(document.querySelectorAll('.calc-toggle-btn[data-mode]'));
  const tripButtons = Array.from(document.querySelectorAll('[data-trip]'));

  const COPY = {
    airline: { partner: 'Select airline partner', price: 'Ticket price', none: 'Select a card first' },
    hotel: { partner: 'Select hotel partner', price: 'Stay price', none: 'Select a card first' }
  };
  const CABIN = { e: 'Economy', p: 'Premium economy', b: 'Business', f: 'First', r: 'Room' };
  const CABIN_ORDER = ['e', 'p', 'b', 'f'];
  // KrisFlyer's chart states a round trip costs twice the one-way miles. The other charts do not say so.
  const ROUND_TRIP_DOUBLES = new Set(['krisflyer']);
  // Typical rupee value per point. Used only to give a rough range when a partner has no award chart.
  const BENCH = { low: 1, mid: 2, high: 4 };

  // Rupee-per-point cut-offs, highest first. Same thresholds as the page's benchmark badges.
  const TIERS = [
    { min: 4, tier: 'high', badge: 'High Value', label: 'Excellent redemption value', detail: 'This is the kind of redemption that usually justifies using points instead of defaulting to cashback.' },
    { min: 2, tier: 'good', badge: 'Good Value', label: 'Strong redemption value', detail: 'This is comfortably above the low-value range and generally worth serious consideration.' },
    { min: 1, tier: 'okay', badge: 'Okay Value', label: 'Average redemption value', detail: 'This is usable, but there may be better ways to use the same points on flights or hotels.' },
    { min: 0, tier: 'low', badge: 'Low Value', label: 'Low redemption value', detail: 'This is where vouchers and cashback often leave a lot of value on the table.' }
  ];

  const inr = new Intl.NumberFormat('en-IN');
  const state = { data: null, red: null, art: {}, mode: 'airline', cardsById: new Map(), partner: '', chart: null, trip: 1 };

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

  const selectedCard = () => state.cardsById.get(els.card.value) || null;
  const routesFor = card => card.r.filter(r => state.data.partners[r[0]] && state.data.partners[r[0]].k === state.mode);
  const cardsForMode = () => state.data.cards.filter(c => routesFor(c).length);
  const partnerName = id => (state.data.partners[id] ? state.data.partners[id].n.replace(/\s*\(.*?\)\s*/g, ' ').trim() : id);
  const unitWord = () => (state.mode === 'hotel' ? 'points' : 'miles');

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
  const fillList = (list, items) => {
    list.replaceChildren();
    Array.from(new Set(items.map(p => p[0]))).sort((a, b) => a.localeCompare(b)).forEach(name => { const o = el('option'); o.value = name; list.appendChild(o); });
  };

  // ── Result helpers ──
  const resetResult = (message) => {
    els.verdict.dataset.tier = 'none';
    els.cardVisual.dataset.state = els.card.value ? 'selected' : 'empty';
    els.badge.textContent = 'Waiting';
    els.caption.textContent = 'Estimated card points needed';
    els.value.textContent = '--';
    els.label.textContent = 'Waiting for your inputs';
    els.detail.textContent = message || 'Choose your card, a transfer partner and the trip to see how many points you need.';
    els.cardValue.textContent = '—';
    els.using.hidden = true;
    els.note.hidden = true;
    els.options.hidden = true; els.options.replaceChildren();
    els.asof.hidden = true;
    els.xlink.hidden = !(selectedCard() && state.partner);
    els.error.hidden = true;
  };

  const updateCardVisual = () => {
    const card = selectedCard();
    const bank = state.data && card ? state.data.banks.find(b => b.id === card.b) : null;
    const art = card ? state.art[card.id] : null;
    if (art) {
      els.artImg.src = `/assets/cards/${art.f}`;
      els.artImg.width = art.w; els.artImg.height = art.h;
      els.artImg.alt = `${card.n} credit card`;
      els.art.classList.toggle('is-vertical', art.h > art.w);
      els.artName.textContent = card.n;
      els.artBank.textContent = bank ? bank.name : '';
    }
    els.art.hidden = !art;
    els.cardVisual.hidden = !!art;
    els.cardName.textContent = card ? card.n : 'Select a card';
    els.cardBank.textContent = bank ? bank.name : 'Choose your bank and card';
    els.cardCurrency.textContent = card && card.c ? card.c : '—';
    els.cardVisual.dataset.state = card ? 'selected' : 'empty';
  };

  // ── Route UI for partners that have an award chart ──
  const clearRoute = () => {
    [els.origin, els.dest].forEach(i => { i.value = ''; i.disabled = false; });
    els.originList.replaceChildren(); els.destList.replaceChildren();
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
    const ok = reachable(O);
    fillList(els.destList, places().filter(p => ok.has(p[1])));
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
      } else {
        els.zone.textContent = `We could not find "${els.dest.value.trim()}". Pick a country or city from the list.`;
      }
      els.zone.hidden = false;
    } else {
      els.zone.hidden = true;
    }
    compute();
  };

  // ── Selects ──
  const populateBanks = () => {
    const bankIds = new Set(cardsForMode().map(c => c.b));
    const banks = state.data.banks.filter(b => bankIds.has(b.id)).map(b => ({ value: b.id, text: b.name }));
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
      setOptions(els.partner, COPY[state.mode].none, [], true);
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
    state.partner = els.partner.value;
    const chart = state.partner && state.red && state.red.charts ? state.red.charts[state.partner] : null;
    state.chart = chart && chart.rows && chart.rows.length ? chart : null;

    // The manual box starts closed whenever the partner changes.
    els.points.value = '';
    els.manual.hidden = true;
    els.manualToggle.setAttribute('aria-expanded', 'false');
    els.manualToggle.hidden = !state.partner;

    if (state.chart) {
      els.route.hidden = false;
      els.partnerNote.hidden = true;
      clearRoute();
      if (isHotelChart()) {
        els.flight.hidden = true; els.hotel.hidden = false;
      } else {
        els.flight.hidden = false; els.hotel.hidden = true;
        const origins = new Set(rows().map(r => r[0]));
        const originPlaces = places().filter(p => origins.has(p[1]));
        fillList(els.originList, originPlaces);
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
        els.partnerNote.textContent = `We do not hold a published award chart for ${partnerName(state.partner)} yet, so we give a rough estimate from your price. If you know the exact points, add them below.`;
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

  const showValue = (card, price, best) => {
    const perPoint = price ? price / best.points : null;
    if (perPoint == null) {
      els.verdict.dataset.tier = 'none';
      els.badge.textContent = 'Estimate';
      els.label.textContent = 'Add your price to see your rupee value per point';
      els.detail.textContent = `This is what the ${partnerName(state.partner)} award costs in ${card.c || 'your card'} points.`;
      els.cardValue.textContent = '—';
      els.cardVisual.dataset.state = 'selected';
      return;
    }
    const tier = TIERS.find(t => perPoint >= t.min);
    els.verdict.dataset.tier = tier.tier;
    els.badge.textContent = tier.badge;
    els.label.textContent = `₹${perPoint.toFixed(2)} per point: ${tier.label}`;
    els.detail.textContent = tier.detail;
    els.cardValue.textContent = `₹${perPoint.toFixed(2)}`;
    els.cardVisual.dataset.state = 'result';
  };

  const compute = () => {
    const card = selectedCard();
    const route = card && card.r.find(r => r[0] === state.partner);
    if (!card || !route) { resetResult(); return; }
    const price = parseNumber(els.price.value);
    const o = priceOptions();
    els.error.hidden = true;
    els.xlink.hidden = false;

    if (o.kind === 'incomplete') {
      resetResult('Choose where you are flying to and your cabin, and the points needed will appear here.');
      return;
    }

    // No chart and no exact points: a rough range from typical rupee values.
    if (o.kind === 'none') {
      if (!price) { resetResult('Enter your price and we will estimate the points you need.'); return; }
      const lo = roundEst(price / BENCH.high), mid = roundEst(price / BENCH.mid), hi = roundEst(price / BENCH.low);
      els.verdict.dataset.tier = 'none';
      els.badge.textContent = 'Rough estimate';
      els.caption.textContent = 'Rough card points estimate';
      els.value.textContent = `~${inr.format(mid)}`;
      els.label.textContent = `Roughly ${inr.format(lo)} to ${inr.format(hi)} card points`;
      els.detail.textContent = `Without an award chart we use typical values of ₹${BENCH.low} to ₹${BENCH.high} per point (₹${BENCH.mid} shown). Add the exact points below for a precise answer.`;
      els.cardValue.textContent = '—';
      els.cardVisual.dataset.state = 'selected';
      els.using.textContent = `Card points shown in ${card.c || 'your card\'s points'}, at a ${ratioText(route[1], route[2])} transfer ratio to ${partnerName(state.partner)}.`;
      els.using.hidden = false;
      els.note.hidden = true; els.options.hidden = true; els.options.replaceChildren(); els.asof.hidden = true;
      return;
    }

    const items = o.list.map(m => {
      const partnerUnits = m.units * o.mult;
      const points = Math.ceil(partnerUnits * route[1] / route[2]);
      return { ...m, partnerUnits, points, perPoint: price ? price / points : null };
    });
    const best = items[0];

    els.caption.textContent = o.kind === 'manual' ? 'Card points needed' : (items.length > 1 ? 'Estimated card points needed (cheapest award)' : 'Estimated card points needed');
    els.value.textContent = inr.format(best.points);
    showValue(card, price, best);

    const currency = card.c ? ` (${card.c})` : '';
    const forWhat = o.descr ? ` for ${o.descr}` : '';
    els.using.textContent = `${inr.format(best.partnerUnits)} ${partnerName(state.partner)} ${unitWord()}${forWhat} at a ${ratioText(route[1], route[2])} ratio needs ${inr.format(best.points)} card points${currency}.`;
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
        if (i.perPoint != null) right.appendChild(el('span', 'calc-chip', `₹${i.perPoint.toFixed(2)} / pt`));
        row.appendChild(right);
        els.options.appendChild(row);
      });
      els.options.hidden = false;
    } else {
      els.options.hidden = true;
    }

    if (o.kind === 'chart' && state.chart.asOf) {
      const when = new Date(state.chart.asOf);
      els.asof.textContent = `Award chart effective ${Number.isNaN(when.getTime()) ? 'date not recorded' : when.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Prices exclude taxes and fees, and seat availability is not guaranteed.`;
      els.asof.hidden = false;
    } else {
      els.asof.hidden = true;
    }
  };

  const showLoadError = () => {
    setOptions(els.bank, 'Could not load banks', [], true);
    els.error.textContent = 'We could not load card data. Please refresh the page and try again.';
    els.error.hidden = false;
  };

  const load = async () => {
    try {
      // Card art and award charts are optional: without them every card uses the themed design and
      // every partner falls back to the rough estimate.
      const optional = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
      const artRequest = optional('/data/card-art.json');
      const redRequest = optional('/data/redemption-data.json');
      const res = await fetch('/data/calculator-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.art = (await artRequest) || {};
      state.red = await redRequest;
      state.data.cards.forEach(c => state.cardsById.set(c.id, c));
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
  [els.price, els.points, els.nights].forEach(input => {
    input.addEventListener('input', () => { formatInput(input); compute(); });
  });
  els.manualToggle.addEventListener('click', () => {
    const open = els.manual.hidden;
    els.manual.hidden = !open;
    els.manualToggle.setAttribute('aria-expanded', String(open));
    if (open) els.points.focus();
  });
  form.addEventListener('submit', event => event.preventDefault());

  load();
})();
