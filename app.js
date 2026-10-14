/* Our Money: household budget preview. Vanilla JS, no build step.
   Data lives in memory and is mirrored to localStorage for this demo. */
(function () {
  'use strict';

  const STORE_KEY = 'our-money-demo-v1';
  const people = { shared: 'Ours', tim: 'Tim', scott: 'Scott' };

  /* ---------- state ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === window.DEMO_SEED.version && parsed.month === monthKey()) return parsed;
      }
    } catch (e) { /* storage unavailable, fall through to seed */ }
    return Object.assign(JSON.parse(JSON.stringify(window.DEMO_SEED)), { month: monthKey() });
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function monthKey() { const n = new Date(); return n.getFullYear() + '-' + (n.getMonth() + 1); }

  let state = load();
  const cat = id => state.categories.find(c => c.id === id);
  const acct = id => state.accounts.find(a => a.id === id);
  const groupOf = c => state.groups.find(g => g.id === c.group);

  /* ---------- formatting ---------- */
  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const money = (cents, exact) => (exact ? usd2 : usd0).format(cents / 100);
  const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayName = s => parseDate(s).toLocaleDateString('en-US', { weekday: 'short' });
  const shortDate = s => parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const longDate = s => parseDate(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* ---------- month math ---------- */
  function monthInfo() {
    const n = new Date();
    const days = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    const day = n.getDate();
    return {
      name: n.toLocaleDateString('en-US', { month: 'long' }),
      days, day, left: days - day + 1, pace: day / days,
      todayISO: new Date(n.getFullYear(), n.getMonth(), day).toISOString().slice(0, 10)
    };
  }
  const isThisMonth = iso => { const a = parseDate(iso), n = new Date(); return a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth(); };

  function spentIn(catId) {
    return state.tx.filter(t => t.category === catId && t.amount < 0 && isThisMonth(t.date))
      .reduce((s, t) => s - t.amount, 0);
  }
  function flexCats() { return state.categories.filter(c => c.group === 'flex'); }

  function totals() {
    const mi = monthInfo();
    const flex = flexCats();
    const planned = flex.reduce((s, c) => s + c.planned, 0);
    const spent = flex.reduce((s, c) => s + spentIn(c.id), 0);
    const expected = Math.round(planned * mi.pace);
    return { planned, spent, left: planned - spent, expected, paceDelta: expected - spent, perDay: Math.max(0, Math.floor((planned - spent) / mi.left)) };
  }

  /* ---------- shared pieces ---------- */
  // The pace bar: fill is what's been spent, the tick is where today sits in the month.
  function paceBar(spent, planned, opts = {}) {
    const mi = monthInfo();
    const pct = planned > 0 ? Math.min(spent / planned, 1) : 0;
    const over = spent > planned;
    const ahead = spent > planned * mi.pace + 1;
    const tone = over ? 'over' : ahead ? 'ahead' : 'under';
    const tick = opts.noTick ? '' : `<span class="tick" style="left:${(mi.pace * 100).toFixed(1)}%"></span>`;
    return `<div class="bar ${tone}${opts.big ? ' big' : ''}" role="img" aria-label="${money(spent)} of ${money(planned)} used${opts.noTick ? '' : ', ' + Math.round(mi.pace * 100) + ' percent of the month gone'}">
      <span class="fill" style="width:${(pct * 100).toFixed(1)}%"></span>${tick}</div>`;
  }
  function progressBar(value, target, tone = 'saved') {
    const pct = target > 0 ? Math.min(value / target, 1) : 0;
    return `<div class="bar ${tone}" role="img" aria-label="${money(value)} of ${money(target)}"><span class="fill" style="width:${(pct * 100).toFixed(1)}%"></span></div>`;
  }
  const ownerTag = o => `<span class="owner owner-${o}" title="${people[o]}">${o === 'shared' ? 'Ours' : people[o]}</span>`;

  /* ---------- views ---------- */
  function viewHome() {
    const mi = monthInfo();
    const t = totals();
    const paceWord = t.paceDelta >= 0
      ? `${money(t.paceDelta)} under where you'd expect by today.`
      : `${money(-t.paceDelta)} ahead of pace, so ease up a little.`;

    const catRows = flexCats().map(c => {
      const s = spentIn(c.id);
      const left = c.planned - s;
      return `<li class="cat-row">
        <div class="cat-line"><span class="cat-name">${esc(c.name)}</span>
          <span class="cat-left ${left < 0 ? 'neg' : ''}">${left < 0 ? money(-left) + ' over' : money(left) + ' left'}</span></div>
        ${paceBar(s, c.planned)}
      </li>`;
    }).join('');

    const allowances = state.categories.filter(c => c.group === 'allow').map(c => {
      const s = spentIn(c.id);
      return `<li class="allow"><span class="allow-name">${esc(c.name)}</span><span class="allow-left">${money(c.planned - s)}</span><span class="allow-of">left of ${money(c.planned)}</span></li>`;
    }).join('');

    const upcoming = state.bills.filter(b => !b.paid).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);
    const billStrip = upcoming.length ? upcoming.map(b => {
      const daysOut = Math.round((parseDate(b.due) - parseDate(mi.todayISO)) / 86400000);
      const soon = daysOut <= 3;
      return `<li class="bill-tile${soon ? ' soon' : ''}">
        <span class="bt-date"><span>${dayName(b.due)}</span><strong>${parseDate(b.due).getDate()}</strong></span>
        <span class="bt-name">${esc(b.name)}</span>
        <span class="bt-amt">${money(b.amount)}</span>
        <span class="bt-meta">${b.autopay ? 'Autopay' : 'Pay manually'}</span>
      </li>`;
    }).join('') : `<li class="empty-inline">Nothing left to pay this month.</li>`;

    const irs = state.taxes.plans.find(p => p.id === 'irs');
    const ny = state.taxes.plans.find(p => p.id === 'ny');
    const reserve = acct('reserve').balance;
    const nextEst = state.taxes.estimates.find(e => !e.paid);
    const nextNeed = nextEst ? nextEst.federal + nextEst.ny : 0;

    const funds = state.categories.filter(c => c.group === 'funds').map(c => `
      <li class="fund"><div class="cat-line"><span class="cat-name">${esc(c.name)}</span><span class="fund-amt">${money(c.saved)} <span class="of">of ${money(c.target)}</span></span></div>
      ${progressBar(c.saved, c.target)}</li>`).join('');

    return `
      <section class="hero" aria-labelledby="heroNum">
        <p class="hero-kicker">${mi.name}, day ${mi.day} of ${mi.days}</p>
        <h1 id="heroNum"><span class="hero-num">${money(t.left)}</span> <span class="hero-rest">left to spend</span></h1>
        <p class="hero-sub">${mi.left} days to go, about ${money(t.perDay)} a day. You're ${paceWord}</p>
        ${paceBar(t.spent, t.planned, { big: true })}
        <p class="legend"><span class="legend-tick"></span> The line marks where today falls in the month. Stay behind it and the month works.</p>
      </section>

      <section class="block" aria-labelledby="dueHead">
        <div class="block-head"><h2 id="dueHead">Coming up</h2><a href="#/bills" class="link">All bills</a></div>
        <ul class="bill-strip">${billStrip}</ul>
      </section>

      <section class="block" aria-labelledby="catHead">
        <div class="block-head"><h2 id="catHead">Everyday spending</h2><span class="muted">${money(t.spent)} of ${money(t.planned)}</span></div>
        <ul class="cat-list">${catRows}</ul>
      </section>

      <section class="block" aria-labelledby="allowHead">
        <div class="block-head"><h2 id="allowHead">Your own money</h2><span class="muted">No need to explain these</span></div>
        <ul class="allow-list">${allowances}</ul>
      </section>

      <section class="block taxes-mini" aria-labelledby="taxHead">
        <div class="block-head"><h2 id="taxHead">Taxes</h2><a href="#/taxes" class="link">Details</a></div>
        <div class="two-up">
          <div>
            <h3>Old balances</h3>
            <p class="big-figure">${money(irs.balance + ny.balance)}</p>
            ${progressBar(irs.original + ny.original - irs.balance - ny.balance, irs.original + ny.original, 'paid')}
            <p class="muted">${money(irs.original + ny.original - irs.balance - ny.balance)} paid off so far</p>
          </div>
          <div>
            <h3>Set aside for this year</h3>
            <p class="big-figure">${money(reserve)}</p>
            ${progressBar(reserve, nextNeed, reserve >= nextNeed ? 'saved' : 'ahead')}
            <p class="muted">${nextEst ? (reserve >= nextNeed ? 'Covers the ' : 'Need ' + money(nextNeed - reserve) + ' more for the ') + nextEst.q + ' payment on ' + shortDate(nextEst.due) : 'All estimates paid'}</p>
          </div>
        </div>
      </section>

      <section class="block" aria-labelledby="fundHead">
        <div class="block-head"><h2 id="fundHead">Saving up for</h2><span class="muted">Emergency fund ${money(acct('emergency').balance)}</span></div>
        <ul class="cat-list">${funds}</ul>
      </section>
    `;
  }

  let activityFilter = 'all';
  let activityQuery = '';
  function viewActivity() {
    const list = state.tx
      .filter(t => activityFilter === 'all' || t.owner === activityFilter)
      .filter(t => {
        if (!activityQuery) return true;
        const q = activityQuery.toLowerCase();
        const c = cat(t.category);
        return (!t.private && (t.payee || '').toLowerCase().includes(q)) || (c && c.name.toLowerCase().includes(q));
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const byDay = {};
    list.forEach(t => { (byDay[t.date] = byDay[t.date] || []).push(t); });

    const days = Object.keys(byDay).map(day => `
      <li class="day-group"><h3 class="day-head">${longDate(day)}</h3>
        <ul class="tx-list">${byDay[day].map(t => {
          const c = cat(t.category);
          const a = acct(t.account);
          const isIn = t.amount > 0;
          return `<li class="tx${t.private ? ' private' : ''}">
            <span class="tx-main">
              <span class="tx-payee">${t.private ? '<svg class="lock" aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Private purchase' : esc(t.payee)}</span>
              <span class="tx-sub">${c ? esc(c.name) : 'Transfer'} in ${a ? esc(a.name) : ''}</span>
            </span>
            ${ownerTag(t.owner)}
            <span class="tx-amt ${isIn ? 'in' : ''}">${isIn ? '+' : ''}${money(Math.abs(t.amount), true)}</span>
          </li>`;
        }).join('')}</ul></li>`).join('');

    const chip = (v, label) => `<button type="button" class="chip" data-filter="${v}" aria-pressed="${activityFilter === v}">${label}</button>`;
    return `
      <header class="page-head"><h1>Activity</h1><p class="muted">Everything coming in and going out this month.</p></header>
      <div class="filters">
        <div class="chips" role="group" aria-label="Show">${chip('all', 'Everyone')}${chip('shared', 'Ours')}${chip('tim', 'Tim')}${chip('scott', 'Scott')}</div>
        <label class="search"><span class="sr-only">Search</span><input type="search" id="txSearch" placeholder="Search by place or category" value="${esc(activityQuery)}"></label>
      </div>
      ${days ? `<ul class="days">${days}</ul>` : `<div class="empty"><p>No transactions match that.</p><button type="button" class="secondary" data-action="clear-filters">Show everything</button></div>`}
    `;
  }

  function viewBills() {
    const mi = monthInfo();
    const sorted = [...state.bills].sort((a, b) => a.due.localeCompare(b.due));
    const unpaid = sorted.filter(b => !b.paid);
    const paid = sorted.filter(b => b.paid);
    const weekEnd = new Date(parseDate(mi.todayISO)); weekEnd.setDate(weekEnd.getDate() + 7);
    const thisWeek = unpaid.filter(b => parseDate(b.due) <= weekEnd);
    const later = unpaid.filter(b => parseDate(b.due) > weekEnd);
    const due = unpaid.reduce((s, b) => s + b.amount, 0);
    const joint = acct('joint').balance;

    const row = b => `<li class="bill${b.paid ? ' is-paid' : ''}">
      <span class="bill-date"><span>${dayName(b.due)}</span><strong>${parseDate(b.due).getDate()}</strong></span>
      <span class="bill-main"><span class="bill-name">${esc(b.name)}</span>
        <span class="bill-sub">${b.autopay ? 'Autopay from ' : 'Pay from '}${esc(acct(b.account).name)}</span></span>
      <span class="bill-amt">${money(b.amount, true)}</span>
      <button type="button" class="check" data-bill="${b.id}" aria-pressed="${b.paid}" aria-label="${b.paid ? 'Mark ' + esc(b.name) + ' as unpaid' : 'Mark ' + esc(b.name) + ' as paid'}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button>
    </li>`;
    const section = (title, items, emptyMsg) => `<section class="block"><h2>${title}</h2>${items.length ? `<ul class="bill-list">${items.map(row).join('')}</ul>` : `<p class="muted">${emptyMsg}</p>`}</section>`;

    return `
      <header class="page-head"><h1>Bills</h1>
        <p class="muted">${money(due)} still to pay this month. Joint checking has ${money(joint)}${joint < due ? ', which is short. Move money before the next autopay.' : ', enough to cover it.'}</p></header>
      ${section('Next 7 days', thisWeek, 'Nothing due this week.')}
      ${section('Later this month', later, 'Nothing else this month.')}
      ${section('Paid', paid, 'Nothing paid yet.')}
    `;
  }

  function viewTaxes() {
    const tx = state.taxes;
    const reserve = acct('reserve').balance;
    const holding = acct('holding').balance;
    const salary = 520000;
    const lastK1 = tx.k1Deposits[tx.k1Deposits.length - 1];
    const reserveCut = Math.round(lastK1.amount * tx.reservePct / 100);

    const plans = tx.plans.map(p => {
      const paid = p.original - p.balance;
      const months = Math.ceil(p.balance / p.monthly);
      return `<article class="plan">
        <div class="plan-head"><h3>${esc(p.label)}</h3><span class="pill">${p.autopay ? 'Autopay on the ' + ordinal(p.dueDay) : 'Due the ' + ordinal(p.dueDay)}</span></div>
        <p class="big-figure">${money(p.balance)} <span class="of">left of ${money(p.original)}</span></p>
        ${progressBar(paid, p.original, 'paid')}
        <dl class="facts"><div><dt>Monthly payment</dt><dd>${money(p.monthly)}</dd></div>
          <div><dt>Since last check-in</dt><dd class="good">${money(p.previousBalance - p.balance)} down</dd></div>
          <div><dt>Paid off in about</dt><dd>${months} months</dd></div></dl>
        <p class="note">Interest keeps adding up until it's paid off, and one missed payment can cancel the plan. Keep autopay on.</p>
      </article>`;
    }).join('');

    const est = tx.estimates.map(e => `<li class="est${e.paid ? ' is-paid' : ''}">
      <span class="est-q">${e.q}</span>
      <span class="est-main"><span>${longDate(e.due)}</span><span class="muted">Federal ${money(e.federal)}, NY ${money(e.ny)}</span></span>
      <span class="est-state">${e.paid ? 'Paid' : 'Upcoming'}</span></li>`).join('');

    return `
      <header class="page-head"><h1>Taxes</h1><p class="muted">Two separate jobs: pay down the old balances, and keep this year's taxes covered so nothing new piles on.</p></header>

      <section class="block"><h2>Paying down the old balances</h2><div class="plans">${plans}</div></section>

      <section class="block flow" aria-labelledby="flowHead">
        <h2 id="flowHead">How Tim's pay becomes a steady paycheck</h2>
        <ol class="flow-steps">
          <li><span class="flow-label">K-1 payment lands in the holding account</span><span class="flow-amt">${money(lastK1.amount)}</span><span class="muted">${shortDate(lastK1.date)}</span></li>
          <li><span class="flow-label">${tx.reservePct}% moves to the tax reserve right away</span><span class="flow-amt">${money(reserveCut)}</span><span class="muted">Nothing is withheld from K-1 pay</span></li>
          <li><span class="flow-label">A fixed monthly salary goes to joint checking on the 1st</span><span class="flow-amt">${money(salary)}</span><span class="muted">Same amount every month</span></li>
          <li><span class="flow-label">Whatever's left stays as a cushion</span><span class="flow-amt">${money(holding)}</span><span class="muted">Swept after each quarterly payment</span></li>
        </ol>
      </section>

      <section class="block"><div class="block-head"><h2>This year's estimated payments</h2><span class="muted">Reserve ${money(reserve)}</span></div>
        <ul class="est-list">${est}</ul>
        <p class="note">Scott's W-4 has ${money(tx.w4Extra)} extra withheld per paycheck to cover part of Tim's tax. That money goes to the IRS automatically, so a slow month can't make you miss a payment.</p>
      </section>
    `;
  }
  function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  function viewCheckin() {
    const last = state.meetings[state.meetings.length - 1];
    const t = totals();
    const irs = state.taxes.plans.find(p => p.id === 'irs');
    const ny = state.taxes.plans.find(p => p.id === 'ny');
    const mi = monthInfo();
    const in30 = new Date(parseDate(mi.todayISO)); in30.setDate(in30.getDate() + 30);
    const big = state.bills.filter(b => !b.paid && b.amount >= 50000);
    const unpaidManual = state.bills.filter(b => !b.paid && !b.autopay);
    const joint = acct('joint').balance;
    const autopayDue = state.bills.filter(b => !b.paid && b.autopay).reduce((s, b) => s + b.amount, 0);
    const fundsSaved = state.categories.filter(c => c.group === 'funds').reduce((s, c) => s + c.saved, 0);
    const fundsTarget = state.categories.filter(c => c.group === 'funds').reduce((s, c) => s + c.target, 0);
    const debtNow = irs.balance + ny.balance;
    const debtThen = last.snapshot.irs + last.snapshot.ny;

    const items = [
      { title: 'How last month went', body: `Spent ${money(state.lastMonthSpent)} of ${money(state.lastMonthPlanned)} planned on everyday spending, ${money(state.lastMonthPlanned - state.lastMonthSpent)} under. This month is ${money(t.spent)} so far.` },
      { title: 'Savings goals', body: `${money(fundsSaved)} saved across your goals, ${Math.round(fundsSaved / fundsTarget * 100)}% of the way. Emergency fund went from ${money(last.snapshot.emergency)} to ${money(acct('emergency').balance)}.` },
      { title: 'Big things in the next 30 days', body: big.length ? big.map(b => `${esc(b.name)} ${money(b.amount)} on ${shortDate(b.due)}`).join('; ') + '.' : 'Nothing over $500 coming up.' },
      { title: 'Bills paid and scheduled', body: `${money(autopayDue)} of autopay is still coming out of joint checking, which has ${money(joint)}. ${joint >= autopayDue ? 'Covered.' : 'Short, top it up.'}${unpaidManual.length ? ' Pay by hand: ' + unpaidManual.map(b => esc(b.name)).join(', ') + '.' : ''}` },
      { title: 'Tax balances', body: `Down to ${money(debtNow)} from ${money(debtThen)} at the last check-in, ${money(debtThen - debtNow)} paid off.` }
    ];

    return `
      <header class="page-head"><h1>Monthly check-in</h1>
        <p class="muted">Twenty minutes, once a month. Last time was ${longDate(last.date)}.</p></header>
      <ol class="agenda">
        ${items.map(i => `<li><h2>${i.title}</h2><p>${i.body}</p></li>`).join('')}
        <li><h2>One win each</h2><label class="field"><span class="sr-only">Wins</span><textarea id="mWins" rows="2" placeholder="Tim: ...  Scott: ..."></textarea></label>
          <p class="muted">Last time: ${esc(last.wins)}</p></li>
        <li><h2>Anything stressing you out?</h2><label class="field"><span class="sr-only">Stress</span><textarea id="mStress" rows="2" placeholder="Say it here so it doesn't fester"></textarea></label>
          <p class="muted">Last time: ${esc(last.stressors)}</p></li>
        <li><h2>What we decided</h2><label class="field"><span class="sr-only">Decisions</span><textarea id="mDecide" rows="2" placeholder="Changes to the plan"></textarea></label>
          <p class="muted">Last time: ${esc(last.decisions)}</p></li>
      </ol>
      <button type="button" class="primary" data-action="save-meeting">Save check-in</button>
    `;
  }

  /* ---------- router ---------- */
  const routes = { home: viewHome, activity: viewActivity, bills: viewBills, taxes: viewTaxes, checkin: viewCheckin };
  function render() {
    const name = (location.hash.replace('#/', '') || 'home').split('?')[0];
    const view = routes[name] ? name : 'home';
    const main = document.getElementById('view');
    main.innerHTML = routes[view]();
    main.dataset.view = view;
    document.querySelectorAll('.nav a').forEach(a => a.setAttribute('aria-current', a.dataset.route === view ? 'page' : 'false'));
    document.title = view === 'home' ? 'Our Money' : `Our Money: ${view === 'checkin' ? 'Check-in' : view[0].toUpperCase() + view.slice(1)}`;
  }
  window.addEventListener('hashchange', () => { render(); document.getElementById('view').focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- interactions ---------- */
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-filter]');
    if (chip) { activityFilter = chip.dataset.filter; render(); return; }
    const billBtn = e.target.closest('[data-bill]');
    if (billBtn) {
      const b = state.bills.find(x => x.id === billBtn.dataset.bill);
      b.paid = !b.paid; save(); render();
      toast(b.paid ? `Marked ${b.name} as paid` : `Marked ${b.name} as unpaid`);
      return;
    }
    const act = e.target.closest('[data-action]');
    if (!act) return;
    if (act.dataset.action === 'clear-filters') { activityFilter = 'all'; activityQuery = ''; render(); }
    if (act.dataset.action === 'save-meeting') {
      const wins = document.getElementById('mWins').value.trim();
      const stressors = document.getElementById('mStress').value.trim();
      const decisions = document.getElementById('mDecide').value.trim();
      if (!wins && !stressors && !decisions) { toast('Write at least one note to save the check-in'); return; }
      const irs = state.taxes.plans.find(p => p.id === 'irs'); const ny = state.taxes.plans.find(p => p.id === 'ny');
      state.meetings.push({ id: 'm' + Date.now(), date: monthInfo().todayISO, wins: wins || 'None noted', stressors: stressors || 'None noted', decisions: decisions || 'None noted',
        snapshot: { spent: totals().spent, irs: irs.balance, ny: ny.balance, emergency: acct('emergency').balance } });
      save(); render(); toast('Check-in saved');
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'txSearch') {
      activityQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const s = document.getElementById('txSearch'); s.focus(); s.setSelectionRange(pos, pos);
    }
  });

  /* ---------- add transaction sheet ---------- */
  const sheet = document.getElementById('addSheet');
  const form = document.getElementById('addForm');
  function fillSelects() {
    const groups = state.groups.filter(g => g.id !== 'income');
    document.getElementById('catSelect').innerHTML = groups.map(g =>
      `<optgroup label="${esc(g.name)}">${state.categories.filter(c => c.group === g.id).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('') +
      `<optgroup label="Income">${state.categories.filter(c => c.group === 'income').map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`;
    document.getElementById('acctSelect').innerHTML = state.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
    document.getElementById('catSelect').value = 'groceries';
  }
  document.getElementById('addBtn').addEventListener('click', () => {
    fillSelects(); form.reset(); document.getElementById('catSelect').value = 'groceries';
    if (typeof sheet.showModal === 'function') sheet.showModal(); else sheet.setAttribute('open', '');
    setTimeout(() => form.amount.focus(), 50);
  });
  document.getElementById('addCancel').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const raw = form.amount.value.replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{0,2})?$/.test(raw) || Number(raw) === 0) { toast('Enter an amount like 24.50'); form.amount.focus(); return; }
    const cents = Math.round(Number(raw) * 100);
    const dir = form.dir.value;
    const t = {
      id: 't' + Date.now(), date: monthInfo().todayISO, payee: form.payee.value.trim(), category: form.category.value,
      account: form.account.value, owner: form.owner.value, private: form.private.checked, note: form.note.value.trim(),
      amount: dir === 'in' ? cents : -cents
    };
    state.tx.push(t); save(); sheet.close(); render();
    toast(`Saved ${money(cents, true)} ${t.private ? 'private purchase' : 'at ' + t.payee}`);
  });

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  render();
})();
