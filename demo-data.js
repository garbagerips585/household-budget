/* Demo data only. Every number here is made up so the look and feel can be
   reviewed safely on a public preview. Amounts are integer cents. */
(function () {
  const now = new Date();
  const Y = now.getFullYear();
  const M = now.getMonth();
  const d = (day, monthOffset = 0) => {
    const dt = new Date(Y, M + monthOffset, day);
    return dt.toISOString().slice(0, 10);
  };
  const today = now.getDate();

  const accounts = [
    { id: 'joint', name: 'Joint checking', kind: 'checking', owner: 'shared', balance: 482150 },
    { id: 'holding', name: 'Tim holding account', kind: 'holding', owner: 'tim', balance: 614000 },
    { id: 'reserve', name: 'Tax reserve savings', kind: 'savings', owner: 'shared', balance: 612400 },
    { id: 'emergency', name: 'Emergency fund', kind: 'savings', owner: 'shared', balance: 210000 },
    { id: 'tim-card', name: 'Tim Visa', kind: 'credit_card', owner: 'tim', balance: -84312 },
    { id: 'scott-card', name: 'Scott Mastercard', kind: 'credit_card', owner: 'scott', balance: -41890 },
    { id: 'tim-personal', name: 'Tim spending', kind: 'checking', owner: 'tim', balance: 12040 },
    { id: 'scott-personal', name: 'Scott spending', kind: 'checking', owner: 'scott', balance: 18775 }
  ];

  const groups = [
    { id: 'fixed', name: 'Bills', bucket: 'fixed' },
    { id: 'flex', name: 'Everyday spending', bucket: 'flexible' },
    { id: 'funds', name: 'Saving up for', bucket: 'non_monthly' },
    { id: 'tax', name: 'Taxes', bucket: 'tax' },
    { id: 'allow', name: 'Personal allowances', bucket: 'flexible' },
    { id: 'income', name: 'Income', bucket: 'income' }
  ];

  const categories = [
    { id: 'mortgage', group: 'fixed', name: 'Mortgage', planned: 214000 },
    { id: 'utilities', group: 'fixed', name: 'Gas and electric', planned: 21000 },
    { id: 'lease', group: 'fixed', name: 'Car lease', planned: 57900 },
    { id: 'insurance', group: 'fixed', name: 'Insurance', planned: 18500 },
    { id: 'internet', group: 'fixed', name: 'Internet and phone', planned: 11500 },
    { id: 'subs', group: 'fixed', name: 'Subscriptions', planned: 6400 },

    { id: 'groceries', group: 'flex', name: 'Groceries', planned: 90000 },
    { id: 'dining', group: 'flex', name: 'Dining out', planned: 40000 },
    { id: 'charging', group: 'flex', name: 'Charging and transit', planned: 9000 },
    { id: 'household', group: 'flex', name: 'Household', planned: 25000 },
    { id: 'fun', group: 'flex', name: 'Fun together', planned: 20000 },
    { id: 'pets', group: 'flex', name: 'Health and pharmacy', planned: 12000 },

    { id: 'allow-tim', group: 'allow', name: 'Tim', planned: 25000, owner: 'tim' },
    { id: 'allow-scott', group: 'allow', name: 'Scott', planned: 25000, owner: 'scott' },

    { id: 'f-home', group: 'funds', name: 'Home repairs', planned: 15000, target: 300000, saved: 112000 },
    { id: 'f-gifts', group: 'funds', name: 'Holiday gifts', planned: 10000, target: 80000, saved: 61000, targetDate: `${Y}-12-01` },
    { id: 'f-car', group: 'funds', name: 'Car registration', planned: 2500, target: 15000, saved: 9000 },
    { id: 'f-trip', group: 'funds', name: 'Next vacation', planned: 20000, target: 400000, saved: 95000 },

    { id: 'irs-plan', group: 'tax', name: 'IRS payment plan', planned: 65000 },
    { id: 'ny-plan', group: 'tax', name: 'NY payment plan', planned: 17500 },
    { id: 'tax-reserve', group: 'tax', name: 'This year’s tax reserve', planned: 0 },

    { id: 'inc-scott', group: 'income', name: 'Scott paycheck' },
    { id: 'inc-tim', group: 'income', name: 'Tim monthly salary' }
  ];

  // Spending so far this month, spread across the days that have passed.
  const spendPlan = [
    ['Wegmans', 'groceries', 'shared', 'joint', [14248, 9812, 16730, 11206, 8840, 13115]],
    ['Aldi', 'groceries', 'shared', 'scott-card', [4612, 3988]],
    ['Tavern 58', 'dining', 'shared', 'tim-card', [8640]],
    ['Pizza Wheel', 'dining', 'shared', 'scott-card', [3210, 2895]],
    ['Starbucks', 'dining', 'scott', 'scott-card', [745, 610, 820]],
    ['ChargePoint', 'charging', 'shared', 'tim-card', [1840, 2210]],
    ['Target', 'household', 'shared', 'scott-card', [6421, 3388]],
    ['Home Depot', 'household', 'shared', 'tim-card', [8916]],
    ['Little Theatre', 'fun', 'shared', 'tim-card', [3600]],
    ['CVS', 'pets', 'shared', 'joint', [2399]],
    ['Card shop', 'allow-tim', 'tim', 'tim-personal', [5400, 3200]],
    ['Record store', 'allow-scott', 'scott', 'scott-personal', [4200]],
    ['Etsy', 'f-gifts', 'scott', 'scott-card', [5800], true]
  ];

  // Scale demo spending to the day of the month so the preview always shows
  // a healthy month, a little under pace.
  const daysInMonth = new Date(Y, M + 1, 0).getDate();
  const scale = Math.min(1.6, (today / daysInMonth) * 1.35);
  const tx = [];
  let n = 1;
  const span = Math.max(1, today);
  spendPlan.forEach(([payee, cat, owner, acct, amounts, priv]) => {
    amounts.forEach((amt, i) => {
      const day = Math.max(1, Math.round(((i + 1) / (amounts.length + 1)) * span));
      tx.push({ id: 't' + n++, date: d(day), payee, category: cat, owner, account: acct, amount: -Math.round(amt * scale), private: !!priv });
    });
  });

  // Income: Tim's fixed salary on the 1st, Scott's paychecks every other Friday.
  tx.push({ id: 't' + n++, date: d(1), payee: 'Transfer from holding account', category: 'inc-tim', owner: 'tim', account: 'joint', amount: 520000 });
  const firstFriday = (() => { const f = new Date(Y, M, 1); while (f.getDay() !== 5) f.setDate(f.getDate() + 1); return f.getDate(); })();
  [firstFriday, firstFriday + 14, firstFriday + 28].forEach(day => {
    if (day <= today && day <= new Date(Y, M + 1, 0).getDate()) {
      tx.push({ id: 't' + n++, date: d(day), payee: 'Target payroll', category: 'inc-scott', owner: 'scott', account: 'joint', amount: 228600 });
    }
  });

  // Bills for this month. Paid if the due date has passed.
  const billDefs = [
    ['Mortgage', 'mortgage', 1, 214000, true, 'joint'],
    ['Car lease', 'lease', 14, 57900, true, 'joint'],
    ['RG&E', 'utilities', 18, 21000, false, 'joint'],
    ['Car insurance', 'insurance', 9, 18500, true, 'joint'],
    ['Spectrum', 'internet', 22, 8000, true, 'tim-card'],
    ['Phone', 'internet', 25, 3500, true, 'scott-card'],
    ['Streaming', 'subs', 5, 6400, true, 'tim-card'],
    ['IRS payment plan', 'irs-plan', 28, 65000, true, 'joint'],
    ['NY payment plan', 'ny-plan', 20, 17500, true, 'joint'],
    ['Tim Visa payment', null, 26, 84312, false, 'joint'],
    ['Scott Mastercard payment', null, 12, 41890, false, 'joint']
  ];
  const lastDay = new Date(Y, M + 1, 0).getDate();
  const bills = billDefs.map(([name, cat, day, amt, autopay, acct], i) => ({
    id: 'b' + (i + 1), name, category: cat, due: d(Math.min(day, lastDay)), amount: amt, autopay, account: acct,
    paid: day < today
  }));

  // Taxes: old balances on payment plans, plus this year's estimates.
  const taxes = {
    plans: [
      { id: 'irs', agency: 'IRS', label: 'IRS payment plan', original: 2400000, balance: 1755000, monthly: 65000, dueDay: 28, autopay: true, previousBalance: 1820000 },
      { id: 'ny', agency: 'NY', label: 'New York payment plan', original: 420000, balance: 297500, monthly: 17500, dueDay: 20, autopay: true, previousBalance: 315000 }
    ],
    reservePct: 30,
    estimates: [
      { q: 'Q1', due: `${Y}-04-15`, federal: 450000, ny: 90000, paid: true },
      { q: 'Q2', due: `${Y}-06-15`, federal: 450000, ny: 90000, paid: true },
      { q: 'Q3', due: `${Y}-09-15`, federal: 450000, ny: 90000, paid: true },
      { q: 'Q4', due: `${Y + 1}-01-15`, federal: 450000, ny: 90000, paid: false }
    ],
    k1Deposits: [
      { date: d(3, -1), amount: 1083300 },
      { date: d(2), amount: 1083300 }
    ],
    w4Extra: 15000
  };

  const meetings = [
    { id: 'm1', date: d(today, -1), wins: 'Paid off the Visa in full. Made the Q3 estimate on time.', stressors: 'Furnace is making a noise.', decisions: 'Bump home repairs to $150 a month.', snapshot: { spent: 241300, irs: 1820000, ny: 315000, emergency: 160000 } }
  ];

  window.DEMO_SEED = { version: 1, accounts, groups, categories, tx, bills, taxes, meetings, lastMonthSpent: 248750, lastMonthPlanned: 266000 };
})();
