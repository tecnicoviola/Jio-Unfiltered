const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { normalizeFromRawApi } = require('../src/extractors/normalizer');
const { PlanCatalogue } = require('../src/identity/deduplicator');
const { scoreAllPlans } = require('../src/scoring/categoryScorer');
const { generateTopRecommendations } = require('../src/recommendations/topRecommendations');
const { filterAndRankByNeeds } = require('../src/recommendations/bestForNeeds');

test('Live Jio Catalogue — Full 17-Category Dataset Ingestion & Deduplication', (t) => {
  const filePath = 'C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\fd0eb185-db8d-4adb-8506-13111a50f707\\scratch\\catalogue.json';
  if (!fs.existsSync(filePath)) {
    t.skip('Live catalogue file not available in scratch directory');
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.ok(Array.isArray(rawData.planCategories), 'Must have planCategories array');
  assert.strictEqual(rawData.planCategories.length, 17, 'Must have all 17 live Jio categories');

  const catalogue = new PlanCatalogue();
  let rawCount = 0;

  for (const cat of rawData.planCategories) {
    const catName = cat.type;
    if (Array.isArray(cat.subCategories)) {
      for (const sub of cat.subCategories) {
        const subName = sub.type;
        if (Array.isArray(sub.plans)) {
          for (const rawPlan of sub.plans) {
            rawCount++;
            const plan = normalizeFromRawApi(rawPlan, catName, subName);
            catalogue.addPlan(plan, catName, subName);
          }
        }
      }
    }
  }

  assert.strictEqual(rawCount, 193, 'Raw cards count matches live API');
  const allUnique = catalogue.getAllPlans();
  assert.ok(allUnique.length > 80 && allUnique.length < 150, `Unique deduplicated plans (${allUnique.length}) is expected range`);

  // Score all plans
  scoreAllPlans(allUnique);

  // Check critical known Jio plans
  const plan349 = allUnique.find(p => p.price === 349 && p.validityDays === 28);
  assert.ok(plan349, 'Real ₹349 28-day plan must exist');
  assert.strictEqual(plan349.id, '1018982', 'Real ₹349 plan ID matches Jio official identifier');
  assert.strictEqual(plan349.isUnlimited5G, true, 'Real ₹349 plan must have Unlimited 5G');
  assert.strictEqual(plan349.dailyDataGB, 2.0);
  assert.ok(plan349.categories.length >= 2, '₹349 appears in multiple categories');
  assert.ok(plan349.rawNotes.some(n => /gemini/i.test(n)), '₹349 has Google Gemini promotion notes');

  // Generate Top Recommendations on real Jio catalogue
  const { shortlist, coverage } = generateTopRecommendations(catalogue);
  assert.ok(shortlist.length >= 4, 'Must generate real shortlist on live catalogue');
  assert.strictEqual(coverage.categoriesCount, 17);

  // Test personalized Best for My Needs on real Jio catalogue
  const everydayResult = filterAndRankByNeeds(allUnique, {
    primaryUseCase: 'everyday',
    maxBudget: 800,
    need5G: true
  });
  assert.ok(everydayResult.winner, 'Must select winner for everyday 5G under ₹800');
  assert.ok(everydayResult.winner.price <= 800);
  assert.strictEqual(everydayResult.winner.isUnlimited5G, true);
});
