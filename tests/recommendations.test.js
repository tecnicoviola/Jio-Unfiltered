const test = require('node:test');
const assert = require('node:assert');
const { NormalizedPlan } = require('../src/models/plan');
const { PlanCatalogue } = require('../src/identity/deduplicator');
const { scorePlan } = require('../src/scoring/categoryScorer');
const { generateTopRecommendations } = require('../src/recommendations/topRecommendations');
const { filterAndRankByNeeds } = require('../src/recommendations/bestForNeeds');

function createSampleCatalogue() {
  const catalogue = new PlanCatalogue();

  const plans = [
    new NormalizedPlan({
      id: '1018982',
      price: 349,
      validityDays: 28,
      dailyDataGB: 2.0,
      totalDataGB: 56.0,
      isUnlimited5G: true,
      category: 'Popular Plans',
      subscriptions: [{ title: 'JioHotstar' }]
    }),
    new NormalizedPlan({
      id: '1013056',
      price: 719,
      validityDays: 84,
      dailyDataGB: 2.0,
      totalDataGB: 168.0,
      isUnlimited5G: true,
      category: 'Popular Plans'
    }),
    new NormalizedPlan({
      id: '1013599',
      price: 3599,
      validityDays: 365,
      dailyDataGB: 2.5,
      totalDataGB: 912.5,
      isUnlimited5G: true,
      category: 'Annual Plans'
    }),
    new NormalizedPlan({
      id: '101299',
      price: 299,
      validityDays: 28,
      dailyDataGB: 1.5,
      totalDataGB: 42.0,
      isUnlimited5G: false,
      category: 'Popular Plans'
    }),
    new NormalizedPlan({
      id: '101189',
      price: 189,
      validityDays: 28,
      dailyDataGB: 0,
      totalDataGB: 2.0,
      isUnlimited5G: false,
      category: 'Value'
    }),
    new NormalizedPlan({
      id: '101449',
      price: 449,
      validityDays: 28,
      dailyDataGB: 3.0,
      totalDataGB: 84.0,
      isUnlimited5G: true,
      category: 'Popular Plans'
    })
  ];

  plans.forEach(p => {
    scorePlan(p);
    catalogue.addPlan(p, p.categories[0]);
  });

  return catalogue;
}

test('Recommendations — Top Recommendations Shortlist Generation', (t) => {
  const catalogue = createSampleCatalogue();
  const { shortlist, coverage } = generateTopRecommendations(catalogue);

  assert.ok(shortlist.length >= 4, 'Should generate shortlist across all available profiles');
  assert.strictEqual(coverage.uniquePlansCount, 6);

  const bestOverall = shortlist.find(s => s.type === 'BEST_OVERALL');
  assert.ok(bestOverall, 'Must have a Best Overall recommendation');
  assert.ok(bestOverall.plan.valueScore >= 75);

  const bestLowerCost = shortlist.find(s => s.type === 'BEST_LOWER_COST');
  assert.ok(bestLowerCost, 'Must have a Best Lower-Cost recommendation');
  assert.ok(bestLowerCost.plan.price <= 300);

  const bestLongVal = shortlist.find(s => s.type === 'BEST_LONG_VALIDITY');
  assert.ok(bestLongVal, 'Must have a Long-Validity recommendation');
  assert.ok(bestLongVal.plan.validityDays >= 84);

  const bestData = shortlist.find(s => s.type === 'BEST_DATA_VALUE');
  assert.ok(bestData, 'Must have a Data-focused recommendation');
  assert.ok(bestData.plan.dailyDataGB >= 2.5);
});

test('Recommendations — Best for My Needs (Secondary SIM Profile)', (t) => {
  const catalogue = createSampleCatalogue();
  const allPlans = catalogue.getAllPlans();

  const result = filterAndRankByNeeds(allPlans, {
    primaryUseCase: 'secondary_sim',
    maxBudget: 250
  });

  assert.ok(result.winner, 'Must find a winner for Secondary SIM');
  assert.strictEqual(result.winner.price, 189, '₹189 low-cost value plan should win for Secondary SIM under ₹250 budget');
  assert.ok(result.winner.price <= 250);
});

test('Recommendations — Best for My Needs (Heavy Data & 5G Profile)', (t) => {
  const catalogue = createSampleCatalogue();
  const allPlans = catalogue.getAllPlans();

  const result = filterAndRankByNeeds(allPlans, {
    primaryUseCase: 'heavy_data',
    maxBudget: 500,
    need5G: true,
    minDailyDataGB: 2.5
  });

  assert.ok(result.winner, 'Must find winner for Heavy Data');
  assert.ok(result.winner.dailyDataGB >= 2.5);
  assert.strictEqual(result.winner.isUnlimited5G, true);
  assert.strictEqual(result.winner.price, 449, '3GB/day ₹449 plan must win under ₹500 budget');
});

test('Recommendations — Strict Hard Constraint Failure (No Plans Eligible)', (t) => {
  const catalogue = createSampleCatalogue();
  const allPlans = catalogue.getAllPlans();

  // Impossible constraint: budget <= ₹100 with 5G
  const result = filterAndRankByNeeds(allPlans, {
    maxBudget: 100,
    need5G: true
  });

  assert.strictEqual(result.winner, null, 'Must NOT quietly relax constraint to fabricate a result');
  assert.strictEqual(result.totalEligible, 0);
  assert.ok(result.unmetReason.includes('No Jio plan met all strict constraints'));
});
