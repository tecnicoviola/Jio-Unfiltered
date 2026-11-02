const test = require('node:test');
const assert = require('node:assert');
const { parseRupeeAmount, parseValidity, parseDataAllowance, normalizeFromRawApi } = require('../src/extractors/normalizer');

test('Extraction — Rupee Amount Parsing', (t) => {
  assert.strictEqual(parseRupeeAmount('₹349'), 349);
  assert.strictEqual(parseRupeeAmount('₹ 3,599'), 3599);
  assert.strictEqual(parseRupeeAmount('349'), 349);
  assert.strictEqual(parseRupeeAmount('₹ 1,234.50'), 1234.5);
  assert.strictEqual(parseRupeeAmount(null), 0);
  assert.strictEqual(parseRupeeAmount('invalid'), 0);
});

test('Extraction — Validity Normalization', (t) => {
  // Standard days
  const val28 = parseValidity('28 Days');
  assert.strictEqual(val28.days, 28);
  assert.strictEqual(val28.isCalendarMonth, false);

  const val84 = parseValidity('84 days');
  assert.strictEqual(val84.days, 84);

  const val365 = parseValidity('365 Days');
  assert.strictEqual(val365.days, 365);

  // Calendar month
  const valCal = parseValidity('1 Calendar Month');
  assert.strictEqual(valCal.days, 30);
  assert.strictEqual(valCal.isCalendarMonth, true);

  // Active base plan dependency
  const valBase = parseValidity('Existing Plan Validity');
  assert.strictEqual(valBase.days, null);
  assert.strictEqual(valBase.isBasePlanDependent, true);

  // Missing or unknown
  const valMissing = parseValidity('');
  assert.strictEqual(valMissing.days, null);
});

test('Extraction — Daily vs Total Data Disambiguation', (t) => {
  // 2 GB/day with 28 days
  const d1 = parseDataAllowance('2 GB/day', 28);
  assert.strictEqual(d1.dailyDataGB, 2.0);
  assert.strictEqual(d1.totalDataGB, 56.0);
  assert.strictEqual(d1.isUnlimited5G, false);

  // 1.5 GB/day with Unlimited 5G
  const d2 = parseDataAllowance('Unlimited 5G + 1.5 GB/Day', 28);
  assert.strictEqual(d2.dailyDataGB, 1.5);
  assert.strictEqual(d2.totalDataGB, 42.0);
  assert.strictEqual(d2.isUnlimited5G, true);

  // Pure bulk total data
  const d3 = parseDataAllowance('Total data 25 GB', 30);
  assert.strictEqual(d3.dailyDataGB, 0);
  assert.strictEqual(d3.totalDataGB, 25.0);

  // MB/day conversion (rounded to 2 decimal places: 500/1024 = 0.49)
  const d4 = parseDataAllowance('500 MB/day', 28);
  assert.strictEqual(d4.dailyDataGB, 0.49);
});

test('Extraction — Full Raw API Plan Normalization', (t) => {
  const rawSample = {
    id: '1018982',
    voucherId: '1018982',
    name: '349',
    amount: '349',
    planName: 'Rs 349_28D_2GB/D',
    primeData: {
      offerBenefits1: 'Unlimited 5G',
      offerBenefits2: '+ 2 GB/Day',
      offerBenefits3: '28',
      offerBenefits4: 'Days'
    },
    misc: {
      subscriptions: [{ title: 'JioTV' }, { title: 'JioHotstar' }],
      notes: ['Free 18-month Pro Plan of Google Gemini worth ₹35100'],
      star: ['Unlimited 5G data for eligible subscribers', 'Post which unlimited @ 64 Kbps'],
      details: [
        { header: 'Pack validity', value: '28 Days' },
        { header: 'Total data', value: '56 GB' },
        { header: 'Data at high speed*', value: '2 GB/Day' }
      ]
    }
  };

  const plan = normalizeFromRawApi(rawSample, 'Popular Plans', 'Top Trending Plans');
  assert.strictEqual(plan.id, '1018982');
  assert.strictEqual(plan.price, 349);
  assert.strictEqual(plan.validityDays, 28);
  assert.strictEqual(plan.dailyDataGB, 2.0);
  assert.strictEqual(plan.totalDataGB, 56.0);
  assert.strictEqual(plan.isUnlimited5G, true);
  assert.strictEqual(plan.effectiveDailyCost, 12.46);
  assert.strictEqual(plan.effective30DayCost, 373.93);
  assert.strictEqual(plan.effectiveAnnualCost, 4549.46);
  assert.strictEqual(plan.subscriptions.length, 2);
  assert.strictEqual(plan.promotions.length, 1);
  assert.match(plan.promotions[0], /Gemini/i);
});

test('Extraction — Malformed or Incomplete Data Handling', (t) => {
  const malformed = {
    name: '',
    amount: null,
    misc: null
  };
  const plan = normalizeFromRawApi(malformed, 'Unknown');
  assert.strictEqual(plan.price, 0);
  assert.strictEqual(plan.validityDays, null);
  assert.strictEqual(plan.effectiveDailyCost, null);
});

test('UI Improvement — Native Card Compact Insights & Cost Logic', (t) => {
  const { generateCompactInsight } = require('../src/extractors/domExtractor');

  // 1. Annual long-validity plan (Card 2 reference: Rs 3599, 365 Days)
  const annualPlan = {
    price: 3599,
    validityDays: 365,
    dailyDataGB: 2.5,
    totalDataGB: 912.5,
    isUnlimited5G: true
  };
  assert.strictEqual(
    generateCompactInsight(annualPlan),
    'Best value for long-term usage with consistent data benefits.'
  );

  // 2. Everyday 28-day plan (Card 1 reference: Rs 399, 28 Days)
  const everydayPlan = {
    price: 399,
    validityDays: 28,
    dailyDataGB: 2.5,
    totalDataGB: 70,
    isUnlimited5G: true
  };
  assert.strictEqual(
    generateCompactInsight(everydayPlan),
    'Good balance of data and validity for everyday usage.'
  );

  // 3. Monetary Top-up voucher / flexible balance (Card 3 reference: Rs 1000)
  const topupPlan = {
    price: 1000,
    validityDays: null,
    dailyDataGB: 0,
    totalDataGB: 0,
    categories: ['Top-up Voucher']
  };
  assert.strictEqual(
    generateCompactInsight(topupPlan),
    'Suitable for long-term use with flexible benefits.'
  );

  // 4. Data add-on requiring active base plan
  const dataAddonPlan = {
    price: 61,
    validityDays: null,
    totalDataGB: 6,
    isBasePlanDependent: true,
    categories: ['Data Packs']
  };
  assert.strictEqual(
    generateCompactInsight(dataAddonPlan),
    'Data add-on requiring an active base recharge to function.'
  );
});
