const test = require('node:test');
const assert = require('node:assert');
const { NormalizedPlan } = require('../src/models/plan');
const { generateFingerprint, getPlanPrimaryId, arePlansIdentical, PlanCatalogue } = require('../src/identity/deduplicator');

test('Identity — Fingerprint Generation', (t) => {
  const plan = new NormalizedPlan({
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    isUnlimited5G: true
  });
  const fp = generateFingerprint(plan);
  assert.strictEqual(fp, 'fp_349_28_2_56_5g_std');
});

test('Identity — Same Plan Across Multiple Categories Deduplication', (t) => {
  const catalogue = new PlanCatalogue();

  // First appearance in 'Popular Plans'
  const planA = new NormalizedPlan({
    id: '1018982',
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    category: 'Popular Plans'
  });
  catalogue.addPlan(planA, 'Popular Plans', 'Top Trending');

  // Second appearance in 'True 5G Unlimited Plans'
  const planB = new NormalizedPlan({
    id: '1018982',
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    category: 'True 5G Unlimited Plans'
  });
  catalogue.addPlan(planB, 'True 5G Unlimited Plans', 'True 5G Plans');

  // Third appearance in 'Entertainment Plans'
  const planC = new NormalizedPlan({
    id: '1018982',
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    category: 'Entertainment Plans'
  });
  catalogue.addPlan(planC, 'Entertainment Plans', 'Hotstar Plans');

  const all = catalogue.getAllPlans();
  assert.strictEqual(all.length, 1, 'Plan must be deduplicated into a single record');
  assert.strictEqual(catalogue.totalRawCardsParsed, 3, 'Raw card count tracks all 3 appearances');

  const saved = all[0];
  assert.strictEqual(saved.categories.length, 3, 'Must preserve all 3 category memberships');
  assert.ok(saved.categories.includes('Popular Plans'));
  assert.ok(saved.categories.includes('True 5G Unlimited Plans'));
  assert.ok(saved.categories.includes('Entertainment Plans'));
});

test('Identity — Distinguish Different Plans with Same Price', (t) => {
  const catalogue = new PlanCatalogue();

  // Plan 1: ₹198 for 14 days, 2GB/day
  const plan1 = new NormalizedPlan({
    id: 'plan_198_14d',
    price: 198,
    validityDays: 14,
    dailyDataGB: 2.0,
    totalDataGB: 28.0
  });

  // Plan 2: ₹198 Data Voucher (25GB total, no daily limit)
  const plan2 = new NormalizedPlan({
    id: 'plan_198_data_pack',
    price: 198,
    validityDays: 30,
    dailyDataGB: 0,
    totalDataGB: 25.0
  });

  catalogue.addPlan(plan1, 'Popular Plans');
  catalogue.addPlan(plan2, 'Data Packs');

  const all = catalogue.getAllPlans();
  assert.strictEqual(all.length, 2, 'Different plans with same price must NOT be merged');
  assert.strictEqual(arePlansIdentical(plan1, plan2), false);
});

test('Identity — Fallback Fingerprint Deduplication without Official ID', (t) => {
  const catalogue = new PlanCatalogue();

  const planDom1 = new NormalizedPlan({
    price: 299,
    validityDays: 28,
    dailyDataGB: 1.5,
    totalDataGB: 42.0,
    isUnlimited5G: false
  });

  const planDom2 = new NormalizedPlan({
    price: 299,
    validityDays: 28,
    dailyDataGB: 1.5,
    totalDataGB: 42.0,
    isUnlimited5G: false
  });

  catalogue.addPlan(planDom1, 'Popular Plans');
  catalogue.addPlan(planDom2, 'Value');

  assert.strictEqual(catalogue.getAllPlans().length, 1, 'Plans matching fingerprint must deduplicate correctly');
});
