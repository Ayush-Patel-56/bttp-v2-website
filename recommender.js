(() => {
  const app = document.getElementById('rec-app');
  if (!app) return;

  const $ = id => document.getElementById(id);
  const inr = new Intl.NumberFormat('en-IN');

  // ── Static copy ──
  const ICON = {
    travel: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    dining: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
    shopping: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    groceries: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    fuel: '<path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M3 22h12"/><path d="M15 11h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8.5L19 5"/><path d="M6 8h6"/>',
    bills: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    entertainment: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    general: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    points: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    lounge: '<path d="M4 20V8l8-5 8 5v12"/><path d="M9 20v-6h6v6"/>',
    premium: '<path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.3 9.4l6-.9z"/>',
    fee: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>'
  };
  const svg = key => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[key]}</svg>`;

  const CATEGORIES = [
    { id: 'travel', label: 'Travel' },
    { id: 'dining', label: 'Dining' },
    { id: 'shopping', label: 'Shopping' },
    { id: 'groceries', label: 'Groceries' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'bills', label: 'Bills & utilities' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'general', label: 'Everything else' }
  ];
  const CAT_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

  const GOALS = [
    { id: 'points', label: 'Maximise points' },
    { id: 'travel', label: 'Travel benefits' },
    { id: 'lounge', label: 'Lounge access' },
    { id: 'premium', label: 'Premium lifestyle' },
    { id: 'fee', label: 'Low annual fee' }
  ];
  const GOAL_ICON = { points: 'points', travel: 'travel', lounge: 'lounge', premium: 'premium', fee: 'fee' };

  const FEES = [
    { value: 0, label: 'Free (₹0)', short: 'Free' },
    { value: 1000, label: 'Up to ₹1,000', short: 'Up to ₹1,000' },
    { value: 5000, label: 'Up to ₹5,000', short: 'Up to ₹5,000' },
    { value: 10000, label: 'Up to ₹10,000', short: 'Up to ₹10,000' },
    { value: 20000, label: 'Up to ₹20,000', short: 'Up to ₹20,000' },
    { value: Infinity, label: 'No limit', short: 'No limit' }
  ];

  const PARTNER_NAME = {
    cathay: 'Cathay Asia Miles',
    ba_executive_club: 'British Airways Executive Club',
    loganair_clan: 'Loganair Loyalty',
    atmos_rewards: 'Atmos Rewards',
    united_mileageplus: 'United MileagePlus',
    jal_mileage_bank: 'JAL Mileage Bank',
    ethiopian_shebamiles: 'Ethiopian ShebaMiles',
    thai_royal_orchid_plus: 'Thai Royal Orchid Plus',
    southwest_rapid_rewards: 'Southwest Rapid Rewards',
    velocity_frequent_flyer: 'Velocity Frequent Flyer',
    vietnam_airlines_lotusmiles: 'Vietnam Lotusmiles',
    saudia_alfursan: 'Saudia Alfursan'
  };

  const BENEFITS = [
    ['l', 'Airport lounge access'],
    ['g', 'Golf privileges'],
    ['q', 'Concierge service'],
    ['m', 'Membership benefits'],
    ['w', 'Welcome benefit']
  ];

  const PAGE_SIZE = 9;

  // ── State ──
  const state = {
    step: 1,
    spend: 0,
    cats: new Set(),
    partners: new Set(),
    fee: Infinity,
    goals: new Set(),
    cards: [],
    partnersMeta: {},
    banks: {},
    art: {},
    ranked: [],
    shown: PAGE_SIZE,
    showAllPartners: false
  };

  const els = {
    wizard: $('rec-wizard'),
    results: $('rec-results'),
    error: $('rec-error'),
    spend: $('rec-spend'),
    next: $('rec-next'),
    back: $('rec-back'),
    skip: $('rec-skip'),
    stepNo: $('rec-stepno'),
    cats: $('rec-cats'),
    partners: $('rec-partners'),
    fees: $('rec-fees'),
    goals: $('rec-goals'),
    partnerMore: $('rec-partner-more'),
    partnerClear: $('rec-partner-clear'),
    cards: $('rec-cards'),
    showMore: $('rec-show-more'),
    modal: $('rec-modal'),
    modalBody: $('rec-modal-body')
  };
  const panes = Array.from(document.querySelectorAll('.rec-pane'));
  const stepBtns = Array.from(document.querySelectorAll('[data-step-btn]'));

  // ── Helpers ──
  // The database stores some names in plain title case ("Sbi", "Hdfc"). Fix the known abbreviations and brand spellings for display only.
  const NAME_FIX = { sbi: 'SBI', hdfc: 'HDFC', icici: 'ICICI', rbl: 'RBL', hpcl: 'HPCL', bpcl: 'BPCL', irctc: 'IRCTC', dmi: 'DMI', tvs: 'TVS', xl: 'XL', idfc: 'IDFC', hsbc: 'HSBC', pnb: 'PNB', bob: 'BoB', rupay: 'RuPay', krisflyer: 'KrisFlyer', indusind: 'IndusInd' };
  const tidyName = n => (n || '').replace(/[A-Za-z]+/g, w => NAME_FIX[w.toLowerCase()] || w);
  const digits = v => (/^\s*-/.test(v) ? '' : v.replace(/[^\d.]/g, '').split('.')[0].slice(0, 9));
  const trim = (n, d = 2) => String(Number(n.toFixed(d)));
  const partnerName = id => {
    if (PARTNER_NAME[id]) return PARTNER_NAME[id];
    const p = state.partnersMeta[id];
    return p ? p.n.replace(/\s*\(.*?\)\s*/g, ' ').trim() : id;
  };
  const feeText = fee => {
    if (fee == null) return null;
    if (fee === 0) return 'Free';
    if (fee >= 1000) return `₹${trim(fee / 1000, 1)}K`;
    return `₹${inr.format(fee)}`;
  };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const summarise = (set, none) => (set.size ? `${set.size} selected` : none);

  // ── Wizard UI ──
  const toggleButton = (parent, cls, labelHtml, pressed, onClick) => {
    const b = el('button', cls);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    b.innerHTML = labelHtml;
    b.addEventListener('click', () => {
      const next = onClick();
      b.setAttribute('aria-pressed', String(next));
    });
    parent.appendChild(b);
    return b;
  };

  const buildCategories = () => {
    els.cats.replaceChildren();
    CATEGORIES.forEach(c => {
      toggleButton(els.cats, 'rec-tile', `<span class="rec-tile-icon">${svg(c.id)}</span><span class="rec-tile-label">${c.label}</span><span class="rec-tick" aria-hidden="true">✓</span>`, state.cats.has(c.id), () => {
        state.cats.has(c.id) ? state.cats.delete(c.id) : state.cats.add(c.id);
        syncProfile();
        return state.cats.has(c.id);
      });
    });
  };

  const buildGoals = () => {
    els.goals.replaceChildren();
    GOALS.forEach(g => {
      toggleButton(els.goals, 'rec-goal', `<span class="rec-tile-icon">${svg(GOAL_ICON[g.id])}</span><span class="rec-tile-label">${g.label}</span><span class="rec-tick" aria-hidden="true">✓</span>`, state.goals.has(g.id), () => {
        state.goals.has(g.id) ? state.goals.delete(g.id) : state.goals.add(g.id);
        syncProfile();
        return state.goals.has(g.id);
      });
    });
  };

  const buildFees = () => {
    els.fees.replaceChildren();
    FEES.forEach(f => {
      const b = el('button', 'rec-opt', f.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.fee === f.value));
      b.addEventListener('click', () => {
        state.fee = f.value;
        els.fees.querySelectorAll('.rec-opt').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
        syncProfile();
      });
      els.fees.appendChild(b);
    });
  };

  const buildPartners = () => {
    // Partners that at least one card offers, most widely offered first.
    const counts = {};
    state.cards.forEach(c => (c.r || []).forEach(r => { counts[r[0]] = (counts[r[0]] || 0) + 1; }));
    const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || partnerName(a).localeCompare(partnerName(b)));
    const visible = state.showAllPartners ? ids : ids.slice(0, 12);
    els.partners.replaceChildren();
    visible.forEach(id => {
      const b = el('button', 'rec-chip', partnerName(id));
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state.partners.has(id)));
      b.addEventListener('click', () => {
        state.partners.has(id) ? state.partners.delete(id) : state.partners.add(id);
        b.setAttribute('aria-pressed', String(state.partners.has(id)));
        syncProfile();
      });
      els.partners.appendChild(b);
    });
    els.partnerMore.hidden = ids.length <= 12;
    els.partnerMore.textContent = state.showAllPartners ? 'Show fewer partners' : `Show all ${ids.length} partners`;
  };

  const syncProfile = () => {
    $('rec-p-spend').textContent = state.spend ? `₹${inr.format(state.spend)}` : 'Not set';
    $('rec-p-cats').textContent = summarise(state.cats, 'Not set');
    $('rec-p-partners').textContent = summarise(state.partners, 'Open');
    $('rec-p-fee').textContent = (FEES.find(f => f.value === state.fee) || FEES[5]).short;
    $('rec-p-goals').textContent = summarise(state.goals, 'Not set');
    $('rec-cat-count').textContent = summarise(state.cats, 'None selected');
    $('rec-partner-count').textContent = summarise(state.partners, 'None selected');
    $('rec-goal-count').textContent = summarise(state.goals, 'None selected');
    els.partnerClear.hidden = state.partners.size === 0;
  };

  const goToStep = n => {
    state.step = n;
    panes.forEach(p => { p.hidden = Number(p.dataset.step) !== n; });
    stepBtns.forEach(b => {
      const i = Number(b.dataset.stepBtn);
      b.classList.toggle('is-active', i === n);
      b.classList.toggle('is-done', i < n);
      b.disabled = i > n;
      if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    els.stepNo.textContent = `Step ${n} of 4`;
    els.back.hidden = n === 1;
    els.skip.hidden = n === 4;
    els.next.innerHTML = n === 4 ? 'Find my card <span aria-hidden="true">→</span>' : 'Next <span aria-hidden="true">→</span>';
    els.error.hidden = true;
  };

  // ── Scoring ──
  // Rate for a category, in points per Rs 100. Falls back to the card's base rate.
  const rateFor = (card, cat) => {
    if (cat !== 'general' && card.k && card.k[cat] != null) return card.k[cat];
    return card.e != null ? card.e : null;
  };

  const percentileOf = (value, sorted) => {
    if (sorted.length < 2) return 0.5;
    let below = 0;
    for (const v of sorted) if (v < value) below++;
    return below / (sorted.length - 1);
  };

  const bestTransfer = (card, preferred) => {
    const routes = card.r || [];
    if (!routes.length) return null;
    const pool = preferred.size ? routes.filter(r => preferred.has(r[0])) : routes;
    const list = pool.length ? pool : routes;
    return list.reduce((best, r) => (r[2] / r[1] > best[2] / best[1] ? r : best), list[0]);
  };

  const rank = () => {
    const cats = state.cats.size ? Array.from(state.cats) : ['general'];
    const spend = state.spend;
    const limit = state.fee;

    const rows = state.cards.map(card => {
      // Equal split of spend over the chosen categories; categories with no known rate are left out.
      const known = cats.map(c => ({ c, ppc: rateFor(card, c) })).filter(x => x.ppc != null);
      const avgPpc = known.length ? known.reduce((s, x) => s + x.ppc, 0) / known.length : null;
      const coverage = known.length / cats.length;
      const retPct = avgPpc != null && card.v != null ? avgPpc * card.v : null; // % of spend returned
      const estPoints = avgPpc != null && spend ? Math.round(spend * avgPpc / 100) : null;
      return { card, avgPpc, coverage, retPct, estPoints };
    });

    const retSorted = rows.map(r => r.retPct).filter(v => v != null).sort((a, b) => a - b);
    const nonGeneral = cats.filter(c => c !== 'general');
    const excluded = [];

    const scored = rows.filter(r => {
      if (Number.isFinite(limit) && r.card.f != null && r.card.f > limit) { excluded.push(r); return false; }
      return true;
    }).map(r => {
      const { card } = r;
      const routes = card.r || [];
      const pointsScore = r.retPct != null ? percentileOf(r.retPct, retSorted) : (r.avgPpc != null ? 0.25 : 0);

      const parts = [{ w: 0.25, s: pointsScore }];
      if (nonGeneral.length) {
        const hit = nonGeneral.filter(c => card.k && card.k[c] != null && (card.e == null || card.k[c] > card.e)).length;
        parts.push({ w: 0.15, s: hit / nonGeneral.length });
      }
      if (state.partners.size) {
        const have = routes.filter(x => state.partners.has(x[0])).length;
        parts.push({ w: 0.12, s: have / state.partners.size });
      }
      if (Number.isFinite(limit)) parts.push({ w: 0.10, s: card.f != null ? 1 : 0.5 });

      if (state.goals.size) {
        const g = {
          points: pointsScore,
          travel: Math.min(1, 0.6 * Math.min(routes.length / 8, 1) + 0.4 * (card.k && card.k.travel != null ? 1 : 0)),
          lounge: card.l ? 1 : 0,
          premium: Math.min(1, ((card.g ? 1 : 0) + (card.q ? 1 : 0) + (card.m ? 1 : 0)) / 2),
          fee: card.f != null ? Math.max(0, 1 - card.f / 10000) : 0.2
        };
        const picked = Array.from(state.goals).map(k => g[k]);
        parts.push({ w: 0.38, s: picked.reduce((a, b) => a + b, 0) / picked.length });
      }

      const total = parts.reduce((a, p) => a + p.w * p.s, 0) / parts.reduce((a, p) => a + p.w, 0);
      const have = [card.e != null, card.f != null, routes.length > 0].filter(Boolean).length;
      const missing = [];
      if (card.e == null) missing.push('earn rate');
      if (card.f == null) missing.push('annual fee');
      if (!routes.length) missing.push('transfer partners');
      const hits = state.partners.size ? routes.filter(x => state.partners.has(x[0])).length : 0;
      return { ...r, routes, hits, score: total * (0.8 + 0.2 * (have / 3)), missing };
    });

    // When someone picks an airline or hotel, cards that actually transfer to one of them come before cards that do not.
    const wantsPartner = state.partners.size > 0;
    scored.sort((a, b) => (wantsPartner ? (b.hits > 0) - (a.hits > 0) : 0) || b.score - a.score || a.card.n.localeCompare(b.card.n));
    return { scored, excluded };
  };

  // ── Rendering results ──
  const makeArt = card => {
    const art = state.art[card.id];
    const wrap = el('div', 'rec-art');
    if (art) {
      const img = el('img', 'rec-art-img');
      img.src = `/assets/cards/${art.f}`;
      img.width = art.w;
      img.height = art.h;
      img.alt = `${card.n} credit card`;
      img.loading = 'lazy';
      img.decoding = 'async';
      wrap.appendChild(img);
    } else {
      wrap.classList.add('is-fallback');
      const f = el('div', 'rec-fallback');
      f.appendChild(el('span', 'rec-fallback-brand', 'BTTP'));
      f.appendChild(el('span', 'rec-fallback-name', card.n));
      wrap.appendChild(f);
    }
    return wrap;
  };

  const stat = (label, value, sub) => {
    const d = el('div', 'rec-stat');
    d.appendChild(el('span', 'rec-stat-label', label));
    d.appendChild(el('strong', 'rec-stat-value', value));
    if (sub) d.appendChild(el('span', 'rec-stat-sub', sub));
    return d;
  };

  const labelFor = i => (i === 0 ? ['Best match', 'is-top'] : i < 3 ? ['Strong match', 'is-strong'] : ['Also consider', 'is-also']);

  const cardTile = (r, i) => {
    const { card } = r;
    const [label, cls] = labelFor(i);
    const art = el('article', 'rec-card');
    const head = el('div', 'rec-card-head');
    head.appendChild(el('span', 'rec-card-bank', (state.banks[card.b] || card.b).toUpperCase()));
    head.appendChild(el('span', 'rec-rank', `#${i + 1}`));
    art.appendChild(head);
    const titleRow = el('div', 'rec-card-title');
    titleRow.appendChild(el('h3', 'rec-card-name', card.n));
    titleRow.appendChild(el('span', `rec-tag ${cls}`, label));
    art.appendChild(titleRow);
    art.appendChild(makeArt(card));

    const est = el('div', 'rec-est');
    const top = el('div', 'rec-est-top');
    if (r.estPoints != null) {
      top.appendChild(el('strong', 'rec-est-value', `~${inr.format(r.estPoints)}`));
    } else if (r.avgPpc != null) {
      top.appendChild(el('strong', 'rec-est-value', `${trim(r.avgPpc, 1)}`));
    } else {
      top.appendChild(el('strong', 'rec-est-value rec-muted', '—'));
    }
    top.appendChild(el('span', 'rec-est-unit', card.c || 'Points currency not recorded'));
    est.appendChild(el('p', 'rec-est-label', r.estPoints != null ? 'ESTIMATED MONTHLY POINTS' : r.avgPpc != null ? 'POINTS PER ₹100 (ADD A SPEND FOR AN ESTIMATE)' : 'ESTIMATED MONTHLY POINTS'));
    est.appendChild(top);
    if (r.retPct != null) {
      est.appendChild(el('p', 'rec-est-note', `≈ ${trim(r.retPct, 1)}% back at ₹${trim(card.v, 2)} per point (statement-credit value)`));
    } else if (r.avgPpc != null) {
      est.appendChild(el('p', 'rec-est-note', 'Rupee value per point not available'));
    } else {
      est.appendChild(el('p', 'rec-est-note', 'Earn rate not published for your categories'));
    }
    if (r.avgPpc != null && r.coverage < 1) est.appendChild(el('p', 'rec-est-note', `Based on ${Math.round(r.coverage * state.cats.size)} of ${state.cats.size} categories`));

    const stats = el('div', 'rec-stats');
    stats.appendChild(stat('BASE EARN', card.e != null ? trim(card.e, 2) : 'N/A', card.e != null ? 'pts / ₹100' : 'not published'));
    const f = feeText(card.f);
    stats.appendChild(stat('ANNUAL FEE', f || 'N/A', f ? (card.f === 0 ? 'lifetime free' : 'per year') : 'not published'));
    const t = bestTransfer({ r: r.routes }, state.partners);
    stats.appendChild(t
      ? stat('TRANSFER', `${t[3] ? '≤' : ''}${trim(t[2] / t[1], 2)}x`, partnerName(t[0]))
      : stat('TRANSFER', 'N/A', 'none listed'));
    est.appendChild(stats);
    art.appendChild(est);

    const tags = el('div', 'rec-tags');
    BENEFITS.filter(([k]) => card[k] && k !== 'w').forEach(([, text]) => tags.appendChild(el('span', 'rec-benefit', text)));
    if (tags.childElementCount) art.appendChild(tags);

    if (card.p) art.appendChild(el('p', 'rec-flag', 'Issuer status: paused. Check availability before applying.'));
    if (r.missing.length) art.appendChild(el('p', 'rec-partial', `Partial data: ${r.missing.join(', ')} not yet recorded.`));

    const btn = el('button', 'rec-btn rec-btn-accent', 'View full benefits →');
    btn.type = 'button';
    btn.addEventListener('click', () => openModal(r, btn));
    art.appendChild(btn);
    return art;
  };

  const renderCards = () => {
    els.cards.replaceChildren();
    state.ranked.slice(0, state.shown).forEach((r, i) => els.cards.appendChild(cardTile(r, i)));
    els.showMore.hidden = state.shown >= state.ranked.length;
    els.showMore.textContent = `Show more cards (${state.ranked.length - state.shown} left)`;
  };

  const showResults = () => {
    const { scored, excluded } = rank();
    state.ranked = scored;
    state.shown = PAGE_SIZE;
    $('rec-results-sub').textContent = `Ranked from ${state.cards.length} cards with rewards data${excluded.length ? `. ${excluded.length} over your fee limit hidden` : ''}.`;
    $('rec-results-count').textContent = `${scored.length} recommendation${scored.length === 1 ? '' : 's'}`;
    els.wizard.hidden = true;
    els.results.hidden = false;
    if (!scored.length) {
      els.cards.replaceChildren(el('p', 'rec-empty', 'No cards match that annual fee limit. Try a higher limit.'));
      els.showMore.hidden = true;
    } else {
      renderCards();
    }
    const heading = $('rec-results-title');
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  // ── Modal ──
  let lastTrigger = null;
  const openModal = (r, trigger) => {
    lastTrigger = trigger;
    const { card } = r;
    const body = els.modalBody;
    body.replaceChildren();

    const head = el('div', 'rec-modal-head');
    const titles = el('div');
    titles.appendChild(el('p', 'rec-card-bank', (state.banks[card.b] || card.b).toUpperCase()));
    const h = el('h3', 'rec-modal-title', card.n);
    h.id = 'rec-modal-title';
    titles.appendChild(h);
    head.appendChild(titles);
    const close = el('button', 'rec-btn rec-btn-ghost rec-btn-small', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => els.modal.close());
    head.appendChild(close);
    body.appendChild(head);

    const section = (title, ...nodes) => {
      const s = el('section', 'rec-modal-section');
      s.appendChild(el('h4', 'rec-modal-h', title));
      nodes.forEach(n => s.appendChild(n));
      body.appendChild(s);
      return s;
    };
    const row = (left, right) => {
      const d = el('div', 'rec-modal-row');
      d.appendChild(el('span', null, left));
      d.appendChild(el('strong', null, right));
      return d;
    };

    const earn = [];
    earn.push(row('Base earn', card.e != null ? `${trim(card.e, 2)} pts / ₹100` : 'Not published'));
    Object.entries(card.k || {}).forEach(([c, v]) => earn.push(row(CAT_LABEL[c] || c, `${trim(v, 2)} pts / ₹100`)));
    if (card.c) earn.push(row('Points currency', card.c));
    if (card.v != null) earn.push(row('Baseline value', `₹${trim(card.v, 2)} per point`));
    section('Earn rates', ...earn);

    section('Annual fee', row('Fee', card.f == null ? 'Not published' : card.f === 0 ? 'Free' : `₹${inr.format(card.f)}`), el('p', 'rec-modal-note', 'As recorded from issuer documents. GST and fee waivers are not included.'));

    const perks = BENEFITS.filter(([k]) => card[k]).map(([, t]) => el('span', 'rec-benefit', t));
    if (perks.length) {
      const wrap = el('div', 'rec-tags');
      perks.forEach(p => wrap.appendChild(p));
      section('Recorded benefits', wrap);
    } else {
      section('Recorded benefits', el('p', 'rec-modal-note', 'No benefits recorded yet for this card.'));
    }

    if (r.routes.length) {
      const wrap = el('div', 'rec-tags');
      r.routes.slice().sort((a, b) => b[2] / b[1] - a[2] / a[1]).forEach(rt => {
        const chip = el('span', `rec-benefit${state.partners.has(rt[0]) ? ' is-picked' : ''}`, `${partnerName(rt[0])} (${trim(rt[1], 2)}:${trim(rt[2], 2)})${rt[3] ? ' up to' : ''}`);
        wrap.appendChild(chip);
      });
      section('All transfer partners', wrap, el('p', 'rec-modal-note', 'Ratio is card points : partner points.'));
    } else {
      section('Transfer partners', el('p', 'rec-modal-note', 'No transfer partners recorded for this card yet.'));
    }

    if (r.missing.length) body.appendChild(el('p', 'rec-partial', `Partial data: ${r.missing.join(', ')} not yet recorded.`));
    els.modal.showModal();
  };

  els.modal.addEventListener('click', e => { if (e.target === els.modal) els.modal.close(); });
  els.modal.addEventListener('close', () => { if (lastTrigger) lastTrigger.focus(); });

  // ── Events ──
  els.spend.addEventListener('input', () => {
    const raw = els.spend.value;
    const d = digits(raw);
    state.spend = d ? Number(d) : 0;
    // keep a typed decimal as typed (40000.5) and tidy it when the box is left
    if (raw.includes('.') && !/^\s*-/.test(raw)) els.spend.value = raw.replace(/[^\d.,]/g, '').replace(/\./g, (m, i, str) => (str.indexOf('.') === i ? '.' : ''));
    else els.spend.value = d ? inr.format(state.spend) : '';
    syncProfile();
  });
  els.spend.addEventListener('blur', () => { els.spend.value = state.spend ? inr.format(state.spend) : ''; });
  els.spend.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); els.next.click(); } });

  els.next.addEventListener('click', () => {
    if (state.step < 4) goToStep(state.step + 1); else showResults();
  });
  els.back.addEventListener('click', () => goToStep(Math.max(1, state.step - 1)));
  // Skipping a step leaves its answers empty, so the ranking ignores them.
  els.skip.addEventListener('click', () => {
    if (state.step === 1) { state.spend = 0; els.spend.value = ''; }
    else if (state.step === 2) { state.cats.clear(); buildCategories(); }
    else if (state.step === 3) { state.partners.clear(); state.fee = Infinity; buildPartners(); buildFees(); }
    syncProfile();
    goToStep(state.step + 1);
  });
  stepBtns.forEach(b => b.addEventListener('click', () => { if (!b.disabled) goToStep(Number(b.dataset.stepBtn)); }));
  els.partnerClear.addEventListener('click', () => { state.partners.clear(); buildPartners(); syncProfile(); });
  els.partnerMore.addEventListener('click', () => { state.showAllPartners = !state.showAllPartners; buildPartners(); });
  els.showMore.addEventListener('click', () => { state.shown += PAGE_SIZE; renderCards(); });
  $('rec-restart').addEventListener('click', () => {
    state.spend = 0; state.cats.clear(); state.partners.clear(); state.fee = Infinity; state.goals.clear();
    state.showAllPartners = false;
    els.spend.value = '';
    buildCategories(); buildGoals(); buildFees(); buildPartners(); syncProfile();
    els.results.hidden = true;
    els.wizard.hidden = false;
    goToStep(1);
    els.wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Load data ──
  // Live data first (/api/tool-data reads the database), then the static copy in /data if the live call fails,
  // is slow, or returns something unusable. The static file is the safety net, so the tools never go blank.
  const loadSet = async (set, staticUrl) => {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`/api/tool-data?set=${set}`, { signal: ctl.signal });
      clearTimeout(timer);
      if (r.ok) {
        const d = await r.json();
        if (d && Array.isArray(d.cards) && d.cards.length) { d.__live = true; return d; }
      } else {
        await r.text().catch(() => {}); // read and discard the error body so the request closes
      }
    } catch (e) { /* fall through to the static copy */ }
    const s = await fetch(staticUrl);
    if (!s.ok) throw new Error(`${staticUrl} ${s.status}`);
    return s.json();
  };

  const init = async () => {
    els.next.disabled = true;
    try {
      const get = (url, optional) => fetch(url).then(r => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); }).catch(err => { if (optional) return {}; throw err; });
      const [rec, calc, art] = await Promise.all([loadSet('recommender', '/data/recommender-data.json'), loadSet('calculator', '/data/calculator-data.json'), get('/data/card-art.json', true)]);

      state.art = art;
      state.partnersMeta = calc.partners || {};
      [...(rec.banks || []), ...(calc.banks || [])].forEach(b => { state.banks[b.id] = b.name; });

      // Merge: recommender data carries earn/fee/benefits; calculator data carries transfer ratios.
      const byId = new Map();
      (rec.cards || []).forEach(c => byId.set(c.id, { ...c, n: tidyName(c.n) }));
      (calc.cards || []).forEach(c => {
        const existing = byId.get(c.id);
        if (existing) { existing.r = c.r; if (!existing.c && c.c) existing.c = c.c; }
        else byId.set(c.id, { id: c.id, n: tidyName(c.n), b: c.b, c: c.c, r: c.r });
      });
      state.cards = Array.from(byId.values());

      buildCategories(); buildGoals(); buildFees(); buildPartners(); syncProfile();
      els.next.disabled = false;
    } catch (err) {
      els.error.textContent = 'We could not load card data. Please refresh the page and try again.';
      els.error.hidden = false;
    }
  };

  goToStep(1);
  init();
})();
