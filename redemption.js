(() => {
  const form = document.getElementById('red-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const inr = new Intl.NumberFormat('en-IN');
  const trim = (n, d = 2) => String(Number(n.toFixed(d)));
  const digits = v => v.replace(/[^\d]/g, '');
  const num = v => Number(digits(v)) || 0;

  const els = {
    bank: $('red-bank'), card: $('red-card'), balance: $('red-balance'), partner: $('red-partner'),
    origin: $('red-origin'), dest: $('red-dest'), originList: $('red-origin-list'), destList: $('red-dest-list'), zone: $('red-zone'), cabin: $('red-cabin'), pax: $('red-pax'), nights: $('red-nights'), fare: $('red-fare'),
    flight: $('red-flight'), hotel: $('red-hotel'), tripType: $('red-trip-type'), noPlan: $('red-no-plan'), trip: $('red-trip'), error: $('red-error'),
    artStage: $('red-art-stage'), artName: $('red-art-name'), artBank: $('red-art-bank'),
    verdict: $('red-verdict'), badge: $('red-badge'), caption: $('red-caption'), needed: $('red-needed'), label: $('red-label'), detail: $('red-detail'),
    options: $('red-options'), transfer: $('red-transfer'), asof: $('red-asof'),
    other: $('red-other'), otherTitle: $('red-other-title'), otherSub: $('red-other-sub'), ways: $('red-ways')
  };

  const CABIN = { e: 'Economy', p: 'Premium economy', b: 'Business', f: 'First', r: 'Room' };
  const CABIN_ORDER = ['e', 'p', 'b', 'f'];
  const WAY = {
    s: 'Statement credit', v: 'Vouchers', f: 'Flight bookings (bank portal)', h: 'Hotel bookings (bank portal)',
    m: 'Merchandise', p: 'Points + pay', b: 'Blended portal redemption'
  };
  const WINDOW = { month: 'per month', calendar_year: 'per calendar year', day: 'per day', year: 'per year' };
  const PARTNER_NAME = { krisflyer: 'KrisFlyer', maharaja_club: 'Maharaja Club', finnair_plus: 'Finnair Plus', wyndham_rewards: 'Wyndham Rewards' };
  // KrisFlyer's chart states a round trip costs twice the one-way miles. The other charts do not say, so no multiplier is applied.
  const ROUND_TRIP_DOUBLES = new Set(['krisflyer']);
  const TIERS = [
    { min: 4, tier: 'high', text: 'Excellent value' },
    { min: 2, tier: 'good', text: 'Strong value' },
    { min: 1, tier: 'okay', text: 'Average value' },
    { min: 0, tier: 'low', text: 'Low value' }
  ];

  const state = { calc: null, red: null, art: {}, cards: new Map(), banks: new Map(), partner: '', trip: 1, plan: null };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const setOptions = (select, placeholder, items, disabled, keep) => {
    const prev = keep ? select.value : '';
    select.replaceChildren();
    const first = el('option', null, placeholder);
    first.value = '';
    select.appendChild(first);
    items.forEach(i => { const o = el('option', null, i.text); o.value = i.value; select.appendChild(o); });
    if (prev && items.some(i => String(i.value) === prev)) select.value = prev;
    select.disabled = disabled;
  };
  const partnerName = id => PARTNER_NAME[id] || (state.calc.partners[id] ? state.calc.partners[id].n : id);
  const chartIds = () => Object.keys(state.red.charts);
  const cardPartners = card => (card.r || []).filter(r => state.red.charts[r[0]]);
  const hasModes = card => !!state.red.modes[card.id];

  // ── Card art ──
  const showArt = card => {
    els.artStage.replaceChildren();
    els.artName.textContent = card ? card.n : 'Select a card';
    els.artBank.textContent = card ? (state.banks.get(card.b) || '') : 'Choose your bank and card';
    if (!card) { els.artStage.appendChild(fallback('Select a card')); return; }
    const art = state.art[card.id];
    if (art) {
      const img = el('img', 'red-art-img');
      img.src = `/assets/cards/${art.f}`; img.width = art.w; img.height = art.h; img.alt = `${card.n} credit card`; img.decoding = 'async';
      if (art.h > art.w) img.classList.add('is-vertical');
      els.artStage.appendChild(img);
    } else {
      els.artStage.appendChild(fallback(card.n));
    }
  };
  const fallback = name => {
    const f = el('div', 'red-fallback');
    f.appendChild(el('span', 'red-fallback-brand', 'BTTP'));
    f.appendChild(el('span', 'red-fallback-name', name));
    return f;
  };

  // ── Reset helpers ──
  const resetResult = () => {
    state.plan = null;
    els.verdict.dataset.tier = 'none';
    els.badge.textContent = 'Waiting';
    els.needed.textContent = '--';
    els.label.textContent = 'Waiting for your inputs';
    els.detail.textContent = 'Choose a card, a transfer partner and a route to see what it costs in your card points.';
    els.options.hidden = true; els.options.replaceChildren();
    els.transfer.hidden = true; els.transfer.replaceChildren();
    els.asof.hidden = true;
    els.error.hidden = true;
  };

  // ── Selects ──
  const selectedCard = () => state.cards.get(els.card.value) || null;

  const populateBanks = () => {
    const ids = new Set();
    state.cards.forEach(c => ids.add(c.b));
    const banks = Array.from(ids).map(id => ({ value: id, text: state.banks.get(id) || id })).sort((a, b) => a.text.localeCompare(b.text));
    setOptions(els.bank, 'Select your bank', banks, false);
    setOptions(els.card, 'Select a bank first', [], true);
    onCardChange();
  };

  const onBankChange = () => {
    const cards = Array.from(state.cards.values()).filter(c => c.b === els.bank.value).sort((a, b) => a.n.localeCompare(b.n));
    if (!els.bank.value) setOptions(els.card, 'Select a bank first', [], true);
    else setOptions(els.card, 'Select your card', cards.map(c => ({ value: c.id, text: c.n })), false);
    onCardChange();
  };

  const onCardChange = () => {
    const card = selectedCard();
    showArt(card);
    resetResult();
    state.partner = '';
    const partners = card ? cardPartners(card) : [];
    if (!card) {
      setOptions(els.partner, 'Select a card first', [], true);
      els.noPlan.hidden = true; els.trip.hidden = false;
      setFlightMode(true); clearRoute();
    } else if (!partners.length) {
      els.trip.hidden = true;
      els.noPlan.hidden = false;
      els.noPlan.textContent = 'We cannot plan a flight or hotel redemption for this card yet: none of its transfer partners has an award chart we can price by region. You can still compare other ways to redeem below.';
    } else {
      els.noPlan.hidden = true; els.trip.hidden = false;
      setOptions(els.partner, 'Select a partner', partners.map(r => ({ value: r[0], text: `${partnerName(r[0])} (${trim(r[1])} : ${trim(r[2])})` })), false);
      if (partners.length === 1) { els.partner.value = partners[0][0]; }
    }
    onPartnerChange();
    renderOther();
  };

  const rows = () => (state.partner ? state.red.charts[state.partner].rows : []);
  const isHotel = () => rows().length > 0 && rows()[0][6] === 2;

  const setFlightMode = flight => { els.flight.hidden = !flight; els.hotel.hidden = flight; };
  const regionName = i => state.red.charts[state.partner].regions[i];

  // ── Places: users pick a country or city, we map it to the programme's pricing zone ──
  const places = () => (state.partner ? state.red.charts[state.partner].places || [] : []);
  const fillList = (list, items) => {
    list.replaceChildren();
    Array.from(new Set(items.map(p => p[0]))).sort((a, b) => a.localeCompare(b)).forEach(name => {
      const o = document.createElement('option');
      o.value = name;
      list.appendChild(o);
    });
  };
  const regionsOf = input => {
    const v = input.value.trim().toLowerCase();
    return v ? Array.from(new Set(places().filter(p => p[0].toLowerCase() === v).map(p => p[1]))) : [];
  };
  const originRegions = () => (els.origin.disabled && state.partner ? Array.from(new Set(rows().map(r => r[0]))) : regionsOf(els.origin));
  const reachable = O => new Set(rows().filter(r => O.includes(r[0])).map(r => r[1]));
  const destRegions = () => { const ok = reachable(originRegions()); return regionsOf(els.dest).filter(i => ok.has(i)); };

  const clearRoute = () => {
    [els.origin, els.dest].forEach(i => { i.value = ''; i.disabled = true; });
    els.originList.replaceChildren(); els.destList.replaceChildren();
    setOptions(els.cabin, 'Select cabin', [], true);
    els.tripType.hidden = true;
    els.zone.hidden = true;
  };

  const onPartnerChange = () => {
    state.partner = els.partner.value;
    resetResult();
    if (!state.partner) { setFlightMode(true); clearRoute(); return; }
    if (isHotel()) {
      setFlightMode(false);
      $('red-fare-label').textContent = 'Cash price for the whole stay (optional)';
    } else {
      setFlightMode(true);
      $('red-fare-label').textContent = 'Cash fare for this trip (optional)';
      const origins = new Set(rows().map(r => r[0]));
      const originPlaces = places().filter(p => origins.has(p[1]));
      fillList(els.originList, originPlaces);
      els.origin.value = '';
      els.origin.disabled = false;
      if (origins.size === 1) {
        // One departure zone only (Maharaja Club from India, Finnair from Helsinki): fixed.
        els.origin.value = originPlaces.length === 1 ? originPlaces[0][0] : regionName(Array.from(origins)[0]);
        els.origin.disabled = true;
      } else if (originPlaces.some(p => p[0] === 'India')) {
        els.origin.value = 'India';
      }
      els.dest.value = '';
      els.tripType.hidden = !ROUND_TRIP_DOUBLES.has(state.partner);
      if (els.tripType.hidden) setTrip(1);
      onOriginChange();
    }
    compute();
  };

  const onOriginChange = () => {
    const O = originRegions();
    els.dest.disabled = !O.length;
    if (!O.length) els.dest.value = '';
    const ok = reachable(O);
    fillList(els.destList, places().filter(p => ok.has(p[1])));
    onDestChange();
  };

  const zoneText = regions => regions.map(regionName).join(' / ');
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
      const name = els.dest.value.trim();
      if (known.length) {
        // A real place, but the programme prints no fixed price for this pair of zones.
        const pair = `${zoneText(O)} to ${zoneText(known)}`;
        els.zone.textContent = state.partner === 'krisflyer'
          ? `KrisFlyer does not publish a fixed price for ${pair}. Its award chart marks these routes "use the mileage calculator", so check the exact miles on singaporeair.com before you plan.`
          : `${partnerName(state.partner)} does not publish a price for ${pair} in the award chart we hold. Check the exact price on the airline's site.`;
      } else {
        els.zone.textContent = `We could not find "${name}". Pick a country or city from the list.`;
      }
      els.zone.hidden = false;
    } else {
      els.zone.hidden = true;
    }
    compute();
  };

  const setTrip = n => {
    state.trip = n;
    document.querySelectorAll('[data-trip]').forEach(b => {
      const on = Number(b.dataset.trip) === n;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };

  // ── Plan ──
  const compute = () => {
    const card = selectedCard();
    if (!card || !state.partner) { resetResult(); renderOther(); return; }
    const route = (card.r || []).find(r => r[0] === state.partner);
    if (!route) { resetResult(); renderOther(); return; }
    const [, from, to, ceiling] = route;
    const chart = state.red.charts[state.partner];
    const xf = (state.red.xfer[card.id] || {})[state.partner] || [];
    const [minTransfer, multiple, procText, procHours, cap, capWindow] = xf;
    const balance = num(els.balance.value);
    const fare = num(els.fare.value);

    let matches = [], mult = 1, descr = '';
    if (isHotel()) {
      const nights = Math.max(1, num(els.nights.value));
      matches = rows().slice().sort((a, b) => a[3] - b[3]).map((r, i, all) => ({ row: r, label: `Tier ${i + 1} of ${all.length}${i === 0 ? ' (lowest)' : i === all.length - 1 ? ' (highest)' : ''}`, unitsText: `${inr.format(r[3])} per night` }));
      mult = nights;
      descr = `${nights} night${nights === 1 ? '' : 's'}`;
    } else {
      const O = originRegions(), D = destRegions(), c = els.cabin.value;
      if (!O.length || !D.length || !c) { resetResult(); renderOther(); return; }
      const multiZone = O.length > 1 || D.length > 1; // e.g. "United States" is priced differently for East and West Coast
      matches = rows().filter(r => O.includes(r[0]) && D.includes(r[1]) && r[2] === c).sort((a, b) => a[3] - b[3])
        .map(r => {
          const tier = r[7] >= 0 ? chart.labels[r[7]] : '';
          const kind = tier ? (/^(Saver|Advantage)$/.test(tier) ? `${tier} award` : tier) : `${CABIN[c]} award`;
          return { row: r, label: multiZone ? `${regionName(r[0])} to ${regionName(r[1])}: ${kind}` : kind, unitsText: null };
        });
      const pax = Number(els.pax.value) || 1;
      const trip = ROUND_TRIP_DOUBLES.has(state.partner) ? state.trip : 1;
      mult = pax * trip;
      descr = `${pax} passenger${pax === 1 ? '' : 's'}${trip === 2 ? ', round trip' : ''}`;
    }
    if (!matches.length) { resetResult(); els.label.textContent = 'No price published'; els.detail.textContent = 'The award chart has no price for that combination.'; renderOther(); return; }

    const options = matches.map(m => {
      const partnerUnits = m.row[3] * mult;
      let points = Math.ceil(partnerUnits * from / to);
      let adjusted = '';
      if (multiple && points % multiple) { points = Math.ceil(points / multiple) * multiple; adjusted = `rounded up to a multiple of ${inr.format(multiple)}`; }
      if (minTransfer && points < minTransfer) { points = minTransfer; adjusted = `raised to the ${inr.format(minTransfer)}-point transfer minimum`; }
      return { ...m, partnerUnits, points, adjusted, starting: m.row[4] === 1, perPoint: fare ? fare / points : null, overCap: !!(cap && points > cap) };
    });
    state.plan = { card, options, from, to, ceiling, descr, partner: state.partner };
    const best = options[0];

    // Headline
    els.caption.textContent = isHotel() ? 'Card points for your stay (lowest tier)' : 'Card points needed (cheapest award)';
    els.needed.textContent = inr.format(best.points);
    if (balance) {
      const diff = balance - best.points;
      els.verdict.dataset.tier = diff >= 0 ? 'high' : 'low';
      els.badge.textContent = diff >= 0 ? 'Covered' : 'Short';
      els.label.textContent = diff >= 0 ? `You have enough, with ${inr.format(diff)} to spare` : `You are ${inr.format(-diff)} points short`;
    } else {
      els.verdict.dataset.tier = 'none';
      els.badge.textContent = 'Estimate';
      els.label.textContent = 'Add your balance to see if it is enough';
    }
    els.detail.textContent = `${inr.format(best.partnerUnits)} ${partnerName(state.partner)} ${isHotel() ? 'points' : 'miles'} at ${trim(from)} : ${trim(to)}${ceiling ? ' (published as "up to")' : ''} for ${descr}.${best.adjusted ? ` ${best.adjusted.charAt(0).toUpperCase()}${best.adjusted.slice(1)}.` : ''}`;

    // Options
    els.options.replaceChildren();
    if (options.length > 1 || best.starting) {
      options.forEach((o, i) => {
        const row = el('div', 'red-option');
        const left = el('div', 'red-option-main');
        left.appendChild(el('strong', null, o.label));
        left.appendChild(el('span', null, `${inr.format(o.partnerUnits)} ${isHotel() ? 'points' : 'miles'}${o.starting ? ', starting at' : ''}`));
        row.appendChild(left);
        const right = el('div', 'red-option-side');
        right.appendChild(el('strong', null, `${inr.format(o.points)} pts`));
        if (balance) right.appendChild(el('span', `red-chip ${balance >= o.points ? 'is-ok' : 'is-short'}`, balance >= o.points ? 'Covered' : `Short ${inr.format(o.points - balance)}`));
        if (o.perPoint != null) {
          const t = TIERS.find(x => o.perPoint >= x.min);
          right.appendChild(el('span', `red-chip is-${t.tier}`, `₹${o.perPoint.toFixed(2)} / pt`));
        }
        row.appendChild(right);
        els.options.appendChild(row);
      });
      els.options.hidden = false;
    } else {
      els.options.hidden = true;
      if (best.perPoint != null) {
        const t = TIERS.find(x => best.perPoint >= x.min);
        els.detail.textContent += ` At your cash fare that is ₹${best.perPoint.toFixed(2)} per card point (${t.text.toLowerCase()}).`;
      }
    }

    // Transfer rules
    els.transfer.replaceChildren();
    els.transfer.appendChild(el('h4', 'red-transfer-title', 'Transfer rules'));
    const line = (k, v) => { const d = el('div', 'red-transfer-row'); d.appendChild(el('span', null, k)); d.appendChild(el('strong', null, v)); els.transfer.appendChild(d); };
    line('Ratio', `${trim(from)} card points : ${trim(to)} ${partnerName(state.partner)} ${isHotel() ? 'points' : 'miles'}${ceiling ? ' (up to)' : ''}`);
    if (minTransfer) line('Minimum transfer', `${inr.format(minTransfer)} points`);
    if (multiple) line('In multiples of', `${inr.format(multiple)} points`);
    if (procText) { const t = procText.replace(/^upto(?=\s)/i, 'Up to'); line('Processing time', t.charAt(0).toUpperCase() + t.slice(1)); }
    else if (procHours) line('Processing time', `Up to ${Math.ceil(procHours / 24)} days`);
    if (cap) line('Transfer limit', `${inr.format(cap)} points ${WINDOW[capWindow] || ''}`.trim());
    if (!minTransfer && !multiple && !procText && !procHours && !cap) els.transfer.appendChild(el('p', 'red-transfer-none', 'No minimums, limits or timings are recorded for this route yet. Check your bank before transferring.'));
    const over = options.filter(o => o.overCap);
    if (over.length) els.transfer.appendChild(el('p', 'red-transfer-warn', `${over.map(o => o.label).join(' and ')} ${over.length > 1 ? 'are' : 'is'} above the ${inr.format(cap)}-point transfer limit ${WINDOW[capWindow] || ''}, so ${over.length > 1 ? 'they' : 'it'} may need more than one transfer window.`.replace(/\s+,/g, ',')));
    els.transfer.hidden = false;

    els.asof.textContent = `Award chart effective ${chart.asOf ? new Date(chart.asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'date not recorded'}. Prices exclude taxes and fees, and availability is not guaranteed.`;
    els.asof.hidden = false;
    els.error.hidden = true;
    renderOther();
  };

  // ── Other ways to redeem ──
  const renderOther = () => {
    const card = selectedCard();
    els.ways.replaceChildren();
    if (!card) { els.other.hidden = true; return; }
    const balance = num(els.balance.value);
    const modes = state.red.modes[card.id] || {};
    const list = Object.entries(modes).map(([k, [value, ceil]]) => ({ label: WAY[k] || k, value, ceil: !!ceil }));
    if (state.plan && state.plan.options[0].perPoint != null) {
      list.push({ label: `Your planned transfer (${partnerName(state.plan.partner)})`, value: state.plan.options[0].perPoint, planned: true });
    }
    list.sort((a, b) => b.value - a.value);
    els.other.hidden = false;
    els.otherTitle.textContent = `How ${card.c || 'your points'} compare`;
    if (!list.length) {
      els.otherSub.textContent = 'We have no published redemption values for this card yet. Add a cash fare above to see the value of a transfer.';
      return;
    }
    els.otherSub.textContent = balance ? `Rupee value of ${inr.format(balance)} points, best first.` : 'Rupee value per point, best first. Add your balance to see totals.';
    const max = list[0].value || 1;
    list.forEach((w, i) => {
      const li = el('li', `red-way${i === 0 ? ' is-best' : ''}${w.planned ? ' is-planned' : ''}`);
      const head = el('div', 'red-way-head');
      head.appendChild(el('strong', null, w.label));
      if (i === 0) head.appendChild(el('span', 'red-way-tag', 'Best value'));
      li.appendChild(head);
      const bar = el('div', 'red-way-bar'); const fill = el('span'); fill.style.width = `${Math.max(4, (w.value / max) * 100)}%`; bar.appendChild(fill); li.appendChild(bar);
      const meta = el('div', 'red-way-meta');
      meta.appendChild(el('span', null, `${w.ceil ? 'Up to ' : ''}₹${w.value.toFixed(2)} per point`));
      if (balance) meta.appendChild(el('strong', null, `${w.ceil ? 'Up to ' : ''}₹${inr.format(Math.round(balance * w.value))}`));
      li.appendChild(meta);
      els.ways.appendChild(li);
    });
  };

  // ── Events ──
  els.bank.addEventListener('change', onBankChange);
  els.card.addEventListener('change', onCardChange);
  els.partner.addEventListener('change', onPartnerChange);
  ['input', 'change'].forEach(ev => {
    els.origin.addEventListener(ev, onOriginChange);
    els.dest.addEventListener(ev, onDestChange);
  });
  els.cabin.addEventListener('change', compute);
  els.pax.addEventListener('change', compute);
  document.querySelectorAll('[data-trip]').forEach(b => b.addEventListener('click', () => { setTrip(Number(b.dataset.trip)); compute(); }));
  [els.balance, els.fare, els.nights].forEach(input => input.addEventListener('input', () => {
    const d = digits(input.value);
    input.value = d ? inr.format(Number(d)) : '';
    compute();
  }));
  form.addEventListener('submit', e => e.preventDefault());

  // ── Load ──
  const init = async () => {
    try {
      const get = (url, optional) => fetch(url).then(r => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); }).catch(err => { if (optional) return {}; throw err; });
      const [calc, rec, red, art] = await Promise.all([get('/data/calculator-data.json'), get('/data/recommender-data.json'), get('/data/redemption-data.json'), get('/data/card-art.json', true)]);
      state.calc = calc; state.red = red; state.art = art;
      [...(rec.banks || []), ...(calc.banks || [])].forEach(b => state.banks.set(b.id, b.name));

      const byId = new Map();
      (rec.cards || []).forEach(c => byId.set(c.id, { id: c.id, n: c.n, b: c.b, c: c.c }));
      (calc.cards || []).forEach(c => byId.set(c.id, { ...(byId.get(c.id) || {}), id: c.id, n: c.n, b: c.b, c: c.c || (byId.get(c.id) || {}).c, r: c.r }));
      byId.forEach(card => { if (cardPartners(card).length || hasModes(card)) state.cards.set(card.id, card); });

      els.pax.replaceChildren();
      for (let i = 1; i <= 9; i++) { const o = el('option', null, String(i)); o.value = String(i); els.pax.appendChild(o); }
      populateBanks();
    } catch (err) {
      setOptions(els.bank, 'Could not load banks', [], true);
      els.error.textContent = 'We could not load card data. Please refresh the page and try again.';
      els.error.hidden = false;
    }
  };

  showArt(null);
  init();
})();
