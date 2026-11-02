/**
 * Category-Specific Scoring and Comparison Engine
 * Adapts evaluation criteria based on the category of the plan.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { computeStandardValueScore, computeDataPackScore } = require('./valueScore');
    const { computeTransparencyScore } = require('./transparencyScore');
    module.exports = factory(computeStandardValueScore, computeDataPackScore, computeTransparencyScore);
  } else {
    root.JioCategoryScorer = factory(
      root.JioValueScorer.computeStandardValueScore,
      root.JioValueScorer.computeDataPackScore,
      root.JioTransparencyScorer.computeTransparencyScore
    );
  }
})(typeof self !== 'undefined' ? self : this, function (computeStandardValueScore, computeDataPackScore, computeTransparencyScore) {
  'use strict';

  function scorePlan(plan, userPreferences = {}) {
    if (!plan) return null;

    // 1. Transparency Score is universal
    const transparencyResult = computeTransparencyScore(plan);
    plan.transparencyScore = transparencyResult.score;
    plan.transparencyBreakdown = transparencyResult.breakdown;
    plan.evidenceList = transparencyResult.evidenceList;

    // 2. Value Score depends on category
    const categories = plan.categories || [];
    const isDataPack = categories.includes('Data Packs') || categories.includes('4G Feature Phone Addon');
    const isTopUp = categories.includes('Top-up Voucher');
    const isIR = categories.includes('International Roaming') || categories.includes('ISD') || categories.includes('In-Flight Packs') || categories.includes('IR Wi-Fi Calling');
    const isAnnual = categories.includes('Annual Plans');

    if (isDataPack && !plan.dailyDataGB) {
      const dataPackResult = computeDataPackScore(plan);
      plan.valueScore = dataPackResult.score;
      plan.scoreBreakdown = dataPackResult.breakdown;
      plan.scoreExplanation = dataPackResult.reason;
      plan.scoreCategoryType = 'data_addon';
    } else if (isTopUp) {
      // Top-up vouchers provide pure talktime balance without service validity
      plan.valueScore = null; // No service validity, display talktime ratio instead of 0-100 score
      plan.scoreBreakdown = { talktimeValue: plan.price, validityExtension: 'None (Requires active plan)' };
      plan.scoreExplanation = 'Pure monetary balance voucher. Does not extend service validity or un-throttle data.';
      plan.scoreCategoryType = 'topup_voucher';
    } else if (isIR) {
      // International roaming comparisons
      const std = computeStandardValueScore(plan, userPreferences);
      plan.valueScore = std.score;
      plan.scoreBreakdown = std.breakdown;
      plan.scoreExplanation = `International pack: ${plan.validityText}. Price: ₹${plan.price}.`;
      plan.scoreCategoryType = 'international_roaming';
    } else if (isAnnual) {
      // Annual plans
      const std = computeStandardValueScore(plan, userPreferences);
      plan.valueScore = std.score;
      plan.scoreBreakdown = std.breakdown;
      plan.scoreExplanation = `Annual commitment locks in daily rate of ₹${plan.effectiveDailyCost}/day (₹${plan.effective30DayCost}/month) for 365 days.`;
      plan.scoreCategoryType = 'annual_plan';
    } else {
      // Standard service-validity recharge plans
      const std = computeStandardValueScore(plan, userPreferences);
      plan.valueScore = std.score;
      plan.scoreBreakdown = std.breakdown;
      plan.scoreExplanation = std.reason;
      plan.scoreCategoryType = 'standard_plan';
    }

    return plan;
  }

  function scoreAllPlans(plans, userPreferences = {}) {
    if (!Array.isArray(plans)) return [];
    return plans.map(p => scorePlan(p, userPreferences));
  }

  return {
    scorePlan,
    scoreAllPlans
  };
});
