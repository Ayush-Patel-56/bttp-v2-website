(() => {
  const form = document.getElementById('calc-form');
  if (!form) return;

  const $ = id => document.getElementById(id);
  const els = {
    bank: $('calc-bank'),
    card: $('calc-card'),
    partner: $('calc-partner'),
    price: $('calc-price'),
    points: $('calc-points'),
    submit: $('calc-submit'),
    error: $('calc-error'),
    partnerLabel: $('calc-partner-label'),
    priceLabel: $('calc-price-label'),
    cardVisual: $('calc-card-visual'),
    cardName: $('calc-card-name'),
    cardBank: $('calc-card-bank'),
    cardCurrency: $('calc-card-currency'),
    cardValue: $('calc-card-value'),
    verdict: $('calc-verdict'),
    badge: $('calc-badge'),
    value: $('calc-value'),
    label: $('calc-label'),
    detail: $('calc-detail'),
    using: $('calc-using'),
    note: $('calc-note'),
    source: $('calc-source')
  };
  const toggles = Array.from(document.querySelectorAll('.calc-toggle-btn'));

  const COPY = {
    airline: { partner: 'Select airline partner', price: 'Ticket price', none: 'Select a card first' },
    hotel: { partner: 'Select hotel partner', price: 'Stay price', none: 'Select a card first' }
  };

  // Rupee-per-point cut-offs, highest first. Same thresholds as the page's benchmark badges.
  const TIERS = [
    { min: 4, tier: 'high', badge: 'High Value', label: 'Excellent redemption value', detail: 'This is the kind of redemption that usually justifies using points instead of defaulting to cashback.' },
    { min: 2, tier: 'good', badge: 'Good Value', label: 'Strong redemption value', detail: 'This is comfortably above the low-value range and generally worth serious consideration.' },
    { min: 1, tier: 'okay', badge: 'Okay Value', label: 'Average redemption value', detail: 'This is usable, but there may be better ways to use the same points on flights or hotels.' },
    { min: 0, tier: 'low', badge: 'Low Value', label: 'Low redemption value', detail: 'This is where vouchers and cashback often leave a lot of value on the table.' }
  ];

  const inr = new Intl.NumberFormat('en-IN');
  const state = { data: null, mode: 'airline', cardsById: new Map() };

  const digits = value => value.replace(/[^\d]/g, '');
  const parseNumber = value => Number(digits(value)) || 0;
  const formatInput = input => {
    const d = digits(input.value);
    input.value = d ? inr.format(Number(d)) : '';
  };
  const ratioText = (from, to) => `${inr.format(from)} : ${inr.format(to)}`;

  const setOptions = (select, placeholder, items, disabled) => {
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.appendChild(first);
    items.forEach(({ value, text }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      select.appendChild(opt);
    });
    select.disabled = disabled;
  };

  const routesFor = card => card.r.filter(r => state.data.partners[r[0]] && state.data.partners[r[0]].k === state.mode);
  const cardsForMode = () => state.data.cards.filter(c => routesFor(c).length);

  const resetResult = () => {
    els.verdict.dataset.tier = 'none';
    els.cardVisual.dataset.state = els.card.value ? 'selected' : 'empty';
    els.badge.textContent = 'Neutral';
    els.value.textContent = '₹--';
    els.label.textContent = 'Waiting for your inputs';
    els.detail.textContent = 'Select your card and spending details to instantly calculate your reward value.';
    els.cardValue.textContent = '₹0.00';
    els.using.hidden = true;
    els.note.hidden = true;
    els.error.hidden = true;
  };

  const updateCardVisual = () => {
    const card = state.cardsById.get(els.card.value);
    els.cardName.textContent = card ? card.n : 'Select a card';
    const bank = state.data && card ? state.data.banks.find(b => b.id === card.b) : null;
    els.cardBank.textContent = bank ? bank.name : 'Choose your bank and card';
    els.cardCurrency.textContent = card && card.c ? card.c : '—';
    els.cardVisual.dataset.state = card ? 'selected' : 'empty';
  };

  const updateSubmit = () => {
    els.submit.disabled = !(els.card.value && els.partner.value && parseNumber(els.price.value) > 0 && parseNumber(els.points.value) > 0);
  };

  const populateBanks = () => {
    const bankIds = new Set(cardsForMode().map(c => c.b));
    const banks = state.data.banks.filter(b => bankIds.has(b.id)).map(b => ({ value: b.id, text: b.name }));
    setOptions(els.bank, 'Select your bank', banks, false);
    setOptions(els.card, 'Select a bank first', [], true);
    setOptions(els.partner, COPY[state.mode].none, [], true);
    updateCardVisual();
    resetResult();
    updateSubmit();
  };

  const populateCards = () => {
    const cards = cardsForMode().filter(c => c.b === els.bank.value).sort((a, b) => a.n.localeCompare(b.n));
    if (!els.bank.value) {
      setOptions(els.card, 'Select a bank first', [], true);
    } else {
      setOptions(els.card, 'Select your card', cards.map(c => ({ value: c.id, text: c.n })), false);
    }
    setOptions(els.partner, COPY[state.mode].none, [], true);
    updateCardVisual();
    resetResult();
    updateSubmit();
  };

  const populatePartners = () => {
    const card = state.cardsById.get(els.card.value);
    if (!card) {
      setOptions(els.partner, COPY[state.mode].none, [], true);
    } else {
      const partners = routesFor(card)
        .map(r => ({ value: r[0], text: `${state.data.partners[r[0]].n} (${ratioText(r[1], r[2])})` }))
        .sort((a, b) => a.text.localeCompare(b.text));
      setOptions(els.partner, 'Select a partner', partners, false);
    }
    updateCardVisual();
    resetResult();
    updateSubmit();
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

  const calculate = () => {
    const card = state.cardsById.get(els.card.value);
    const route = card && card.r.find(r => r[0] === els.partner.value);
    const price = parseNumber(els.price.value);
    const partnerPoints = parseNumber(els.points.value);
    if (!card || !route || !price || !partnerPoints) {
      els.error.textContent = 'Please fill in all fields.';
      els.error.hidden = false;
      return;
    }
    els.error.hidden = true;

    // route = [partnerId, cardUnits, partnerUnits, isCeiling]; cardUnits card points buy partnerUnits partner points.
    const cardPoints = Math.ceil(partnerPoints * route[1] / route[2]);
    const perPoint = price / cardPoints;
    const tier = TIERS.find(t => perPoint >= t.min);

    els.verdict.dataset.tier = tier.tier;
    els.badge.textContent = tier.badge;
    els.value.textContent = `₹${perPoint.toFixed(2)}`;
    els.label.textContent = tier.label;
    els.detail.textContent = tier.detail;
    els.cardValue.textContent = `₹${perPoint.toFixed(2)}`;
    els.cardVisual.dataset.state = 'result';

    const currency = card.c ? ` (${card.c})` : '';
    els.using.textContent = `Needs ${inr.format(cardPoints)} card points${currency} at a ${ratioText(route[1], route[2])} transfer ratio.`;
    els.using.hidden = false;

    if (route[3]) {
      els.note.textContent = 'The bank publishes this ratio as "up to", so your actual ratio may be lower and the real value per point lower too.';
      els.note.hidden = false;
    } else {
      els.note.hidden = true;
    }
  };

  const showLoadError = () => {
    setOptions(els.bank, 'Could not load banks', [], true);
    els.error.textContent = 'We could not load card data. Please refresh the page and try again.';
    els.error.hidden = false;
  };

  const load = async () => {
    try {
      const res = await fetch('/data/calculator-data.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      state.data.cards.forEach(c => state.cardsById.set(c.id, c));
      if (state.data.generatedAt && els.source) {
        const when = new Date(state.data.generatedAt);
        if (!Number.isNaN(when.getTime())) {
          els.source.textContent = `Transfer ratios last refreshed ${when.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}. Always confirm the current ratio with your bank before transferring.`;
        }
      }
      populateBanks();
    } catch (err) {
      showLoadError();
    }
  };

  toggles.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  els.bank.addEventListener('change', populateCards);
  els.card.addEventListener('change', populatePartners);
  els.partner.addEventListener('change', () => { resetResult(); updateSubmit(); });
  [els.price, els.points].forEach(input => {
    input.addEventListener('input', () => { formatInput(input); resetResult(); updateSubmit(); });
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    calculate();
  });

  load();
})();
