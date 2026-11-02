const test = require('node:test');
const assert = require('node:assert');
const { NormalizedPlan } = require('../src/models/plan');
const { computeStandardValueScore, computeDataPackScore } = require('../src/scoring/valueScore');
const { computeTransparencyScore } = require('../src/scoring/transparencyScore');
const { scorePlan } = require('../src/scoring/categoryScorer');

test('Scoring — Standard Value Score Determinism and Bounds', (t) => {
  const plan = new NormalizedPlan({
    id: 'test_plan',
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    isUnlimited5G: true
  });

  const res1 = computeStandardValueScore(plan);
  const res2 = computeStandardValueScore(plan);

  assert.strictEqual(res1.score, res2.score, 'Scoring must be deterministic');
  assert.ok(res1.score >= 0 && res1.score <= 100, 'Score must be between 0 and 100');
  assert.ok(res1.score >= 70, '₹349 2GB/day Unlimited 5G plan must score competitively');
});

test('Scoring — 28-day vs 30-day Validity Stability', (t) => {
  // Plan A: ₹299 for 28 days (13 recharges/year)
  const plan28 = new NormalizedPlan({
    price: 299,
    validityDays: 28,
    dailyDataGB: 1.5
  });

  // Plan B: ₹299 for 30 days (12 recharges/year)
  const plan30 = new NormalizedPlan({
    price: 299,
    validityDays: 30,
    dailyDataGB: 1.5,
    isCalendarMonth: true
  });

  const score28 = computeStandardValueScore(plan28);
  const score30 = computeStandardValueScore(plan30);

  assert.ok(score30.score > score28.score, '30-day plan must reward 12-recharge cycle efficiency over 28-day 13-cycle renewal');
});

test('Scoring — Data Add-On Specialized Scorer', (t) => {
  const dataPack = new NormalizedPlan({
    price: 100,
    totalDataGB: 15.0,
    dailyDataGB: 0,
    categories: ['Data Packs']
  });

  const res = computeDataPackScore(dataPack);
  assert.ok(res.score >= 80, 'Low cost per GB (₹6.67/GB) must score high on data pack scorer');
  assert.strictEqual(res.breakdown.costPerGB, 6.67);
});

test('Scoring — Transparency Score Disclosures', (t) => {
  // Fully disclosed plan with clear asterisks and throttle rules
  const transparentPlan = new NormalizedPlan({
    price: 349,
    validityDays: 28,
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    postQuotaSpeed: '64 Kbps',
    rawStar: ['Post which unlimited @ 64 Kbps', 'Unlimited 5G data for eligible subscribers'],
    rawNotes: ['JioHotstar: Mobile subscription'],
    isUnlimited5G: true
  });

  const tScore1 = computeTransparencyScore(transparentPlan);
  assert.ok(tScore1.score >= 85, 'Fully disclosed plan must achieve high transparency score');
  assert.strictEqual(tScore1.coverage, 'Comprehensive');

  // Plan with missing throttle disclosures and vague validity
  const vaguePlan = new NormalizedPlan({
    price: 50,
    validityDays: null,
    dailyDataGB: 0,
    totalDataGB: 0
  });

  const tScore2 = computeTransparencyScore(vaguePlan);
  assert.ok(tScore2.score < 70, 'Incomplete plan must receive lower transparency score');
});

test('Scoring — Top-Up Voucher Custom Category Logic', (t) => {
  const topup = new NormalizedPlan({
    price: 100,
    categories: ['Top-up Voucher']
  });

  scorePlan(topup);
  assert.strictEqual(topup.valueScore, null, 'Top-up vouchers without service validity must not fabricate 0-100 score');
  assert.strictEqual(topup.scoreCategoryType, 'topup_voucher');
  assert.ok(topup.transparencyScore > 0, 'Transparency score remains active independently');
});
