/**
 * Top Recommendations Engine
 * Produces a deterministic, cross-category shortlist based on the normalized catalogue:
 *  - Best Overall Value
 *  - Best Lower-Cost Alternative
 *  - Best Long-Validity Option
 *  - Best Data Value
 *  - Best Value Without OTT Bundles
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioTopRecommendations = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function generateTopRecommendations(plansCatalogue) {
    if (!plansCatalogue) return { shortlist: [], coverage: {} };

    const allPlans = plansCatalogue.getAllPlans().filter(p => p.price && p.valueScore !== null);
    const coverage = plansCatalogue.getCoverageStats();

    if (allPlans.length === 0) {
      return { shortlist: [], coverage };
    }

    // Sort eligible standard plans by Value Score descending
    const standardPlans = allPlans.filter(p => p.validityDays && p.validityDays >= 14 && p.dailyDataGB > 0);
    standardPlans.sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    const recommendations = [];
    const usedPlanIds = new Set();

    // 1. Best Overall Value (#1 Overall)
    if (standardPlans.length > 0) {
      const bestOverall = standardPlans[0];
      usedPlanIds.add(bestOverall.id);
      recommendations.push({
        type: 'BEST_OVERALL',
        badge: '#1 Overall',
        plan: bestOverall,
        rationale: `Best overall value for long-term use. Delivers ${bestOverall.dailyDataGB} GB/day for ${bestOverall.validityText} at an effective daily cost of ₹${bestOverall.effectiveDailyCost}.`
      });
    }

    // 2. Best Lower-Cost Alternative
    const lowerCostCandidates = standardPlans
      .filter(p => p.price <= 300 && !usedPlanIds.has(p.id))
      .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    if (lowerCostCandidates.length > 0) {
      const bestLowerCost = lowerCostCandidates[0];
      usedPlanIds.add(bestLowerCost.id);
      const hasCalling = bestLowerCost.voice && bestLowerCost.voice !== 'N/A' && bestLowerCost.voice !== 'NA';
      recommendations.push({
        type: 'BEST_LOWER_COST',
        badge: 'Best Lower-Cost',
        plan: bestLowerCost,
        rationale: `Best budget option at ₹${bestLowerCost.price} (${bestLowerCost.validityText}). Provides ${bestLowerCost.dailyDataGB > 0 ? bestLowerCost.dailyDataGB + ' GB/day' : bestLowerCost.totalDataGB + ' GB'}${hasCalling ? ' with unlimited calling' : ''} at low upfront cost.`
      });
    }

    // 3. Best Long-Validity Option
    const longValCandidates = standardPlans
      .filter(p => p.validityDays >= 84 && !usedPlanIds.has(p.id))
      .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    if (longValCandidates.length > 0) {
      const bestLongVal = longValCandidates[0];
      usedPlanIds.add(bestLongVal.id);
      recommendations.push({
        type: 'BEST_LONG_VALIDITY',
        badge: 'Long Validity',
        plan: bestLongVal,
        rationale: `Locks in rate for ${bestLongVal.validityText} at ₹${bestLongVal.effectiveDailyCost}/day (₹${bestLongVal.effective30DayCost}/month). Requires only ${bestLongVal.validityDays >= 365 ? '1 recharge/year' : '4 recharges/year'}, avoiding 28-day cycle overhead.`
      });
    }

    // 4. Best Data Value
    const highDataCandidates = standardPlans
      .filter(p => p.dailyDataGB >= 2.5 && !usedPlanIds.has(p.id))
      .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    if (highDataCandidates.length > 0) {
      const bestData = highDataCandidates[0];
      usedPlanIds.add(bestData.id);
      recommendations.push({
        type: 'BEST_DATA_VALUE',
        badge: 'Best Data Value',
        plan: bestData,
        rationale: `Good data value with ${bestData.dailyDataGB} GB/day and ${bestData.isUnlimited5G ? 'Unlimited 5G' : '4G high-speed'} for heavy usage without midday slowdowns.`
      });
    }

    // 5. Best Value Without OTT Bundles
    const noOttCandidates = standardPlans
      .filter(p => (!p.subscriptions || p.subscriptions.every(s => ['JioTV', 'JioCinema', 'JioAICloud', 'JioCloud', 'JioSecurity'].includes(s.title))) && !usedPlanIds.has(p.id))
      .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    if (noOttCandidates.length > 0) {
      const bestNoOtt = noOttCandidates[0];
      usedPlanIds.add(bestNoOtt.id);
      recommendations.push({
        type: 'BEST_NO_OTT',
        badge: 'Value Without OTT',
        plan: bestNoOtt,
        rationale: `Direct connectivity plan without extra cost for bundled OTT subscriptions (Netflix/Hotstar/Prime).`
      });
    }

    // 6. Best for Secondary SIM (low cost, moderate data, high validity ratio)
    const secondaryCandidates = allPlans
      .filter(p => p.price <= 350 && p.validityDays >= 28 && !usedPlanIds.has(p.id))
      .sort((a, b) => (a.effectiveDailyCost || 999) - (b.effectiveDailyCost || 999));

    if (secondaryCandidates.length > 0) {
      const bestSecondary = secondaryCandidates[0];
      usedPlanIds.add(bestSecondary.id);
      recommendations.push({
        type: 'BEST_SECONDARY_SIM',
        badge: 'Best for Secondary SIM',
        plan: bestSecondary,
        rationale: `Suitable for secondary SIM with enough data for occasional use and OTPs, at a lower monthly cost.`
      });
    }

    // Apply synchronized recommendation badge markers to the plans
    for (const rec of recommendations) {
      if (!rec.plan.recommendationBadges.includes(rec.badge)) {
        rec.plan.recommendationBadges.push(rec.badge);
      }
    }

    return {
      shortlist: recommendations,
      coverage
    };
  }

  return {
    generateTopRecommendations
  };
});
