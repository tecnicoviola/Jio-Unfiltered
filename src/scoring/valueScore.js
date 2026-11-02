/**
 * Value Scoring Engine
 * Computes deterministic, explainable Value Scores (0–100) based on
 * normalized costs, data benefits, validity economics, and user match.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioValueScorer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Configurable baseline reference values for Indian telecom market (2025/2026)
  const BENCHMARKS = {
    // Median daily cost for typical 1.5GB - 2GB/day unlimited plans (~₹10 to ₹15/day)
    EXCELLENT_DAILY_COST: 9.0, // e.g. ₹240/mo or annual plan ₹3599/365 ≈ ₹9.8/day
    POOR_DAILY_COST: 22.0,    // e.g. short validity or premium single-use
    // Median data per day
    BENCHMARK_DAILY_DATA_GB: 2.0,
    // Benchmark cost per GB for data packs (~₹5 to ₹15/GB)
    EXCELLENT_COST_PER_GB: 6.0,
    POOR_COST_PER_GB: 20.0
  };

  /**
   * Calculate general-purpose Value Score for standard prepaid mobile plans.
   * Weightings:
   *  - Effective Cost: 30%
   *  - Validity & Renewal Stability: 20%
   *  - Data & Usable Benefits: 30%
   *  - Match / Usability: 20%
   */
  function computeStandardValueScore(plan, userPreferences = {}) {
    if (!plan || !plan.price || !plan.validityDays) {
      return { score: null, breakdown: null, reason: 'Missing price or validity data' };
    }

    const dailyCost = plan.effectiveDailyCost;
    if (!dailyCost || dailyCost <= 0) {
      return { score: null, breakdown: null, reason: 'Invalid cost calculation' };
    }

    // 1. Cost Efficiency Score (0 to 30 points)
    // Lower daily cost = higher score
    let costScore;
    if (dailyCost <= BENCHMARKS.EXCELLENT_DAILY_COST) {
      costScore = 30;
    } else if (dailyCost >= BENCHMARKS.POOR_DAILY_COST) {
      costScore = 5;
    } else {
      const ratio = (BENCHMARKS.POOR_DAILY_COST - dailyCost) / (BENCHMARKS.POOR_DAILY_COST - BENCHMARKS.EXCELLENT_DAILY_COST);
      costScore = 5 + (ratio * 25);
    }

    // 2. Validity & Renewal Stability (0 to 20 points)
    // Long-validity (84d, 365d) provides inflation protection and fewer recharge cycles.
    // 30d/calendar-month has zero 13-recharge cycle penalty.
    let validityScore = 10;
    if (plan.validityDays >= 365) {
      validityScore = 20; // 1 recharge/year, rate locked
    } else if (plan.validityDays >= 84) {
      validityScore = 17; // 4 recharges/year
    } else if (plan.isCalendarMonth || plan.validityDays === 30) {
      validityScore = 15; // exactly 12 recharges/year
    } else if (plan.validityDays === 28) {
      validityScore = 12; // 13 recharges/year (slight renewal overhead)
    } else if (plan.validityDays >= 14) {
      validityScore = 8;
    } else {
      validityScore = 5;
    }

    // 3. Data & Usable Benefits (0 to 30 points)
    let dataScore = 10;
    if (plan.dailyDataGB >= 3.0) {
      dataScore = 26;
    } else if (plan.dailyDataGB >= 2.5) {
      dataScore = 24;
    } else if (plan.dailyDataGB >= 2.0) {
      dataScore = 22;
    } else if (plan.dailyDataGB >= 1.5) {
      dataScore = 18;
    } else if (plan.dailyDataGB >= 1.0) {
      dataScore = 14;
    } else if (plan.totalDataGB > 0) {
      // Bulk data pool without daily limits
      dataScore = Math.min(22, 10 + (plan.totalDataGB / 5));
    }

    // Unlimited 5G benefit bonus (up to +4 points, capped at 30)
    if (plan.isUnlimited5G) {
      dataScore = Math.min(30, dataScore + 4);
    }

    // 4. Requirement Match / Bonus Usability (0 to 20 points)
    let matchScore = 15; // default neutral match
    if (userPreferences.primaryUseCase) {
      // Custom match adjustments
      if (userPreferences.primaryUseCase === 'secondary_sim') {
        // Lower total price is prioritized over high data
        matchScore = plan.price <= 250 ? 20 : (plan.price <= 500 ? 12 : 5);
      } else if (userPreferences.primaryUseCase === 'heavy_data') {
        matchScore = (plan.dailyDataGB >= 2.0 || plan.isUnlimited5G) ? 20 : 8;
      } else if (userPreferences.primaryUseCase === 'ott_entertainment') {
        const hasMajorOTT = plan.subscriptions.some(s => /netflix|hotstar|prime|sonyliv|zee5/i.test(s.title));
        matchScore = hasMajorOTT ? 20 : 8;
      } else if (userPreferences.primaryUseCase === 'long_validity') {
        matchScore = plan.validityDays >= 84 ? 20 : 7;
      }
    }

    const total = Math.min(100, Math.max(0, Math.round(costScore + validityScore + dataScore + matchScore)));

    return {
      score: total,
      breakdown: {
        costEfficiency: Number(costScore.toFixed(1)),
        validityStability: Number(validityScore.toFixed(1)),
        dataAllowance: Number(dataScore.toFixed(1)),
        matchScore: Number(matchScore.toFixed(1))
      },
      reason: `Effective cost ₹${dailyCost}/day (${Math.round(costScore)}/30), ${plan.validityText} validity (${Math.round(validityScore)}/20), ${plan.dailyDataGB > 0 ? plan.dailyDataGB + ' GB/day' : plan.totalDataGB + ' GB total'} (${Math.round(dataScore)}/30).`
    };
  }

  /**
   * Data Add-On Scorer:
   * Scores data add-on packs based on cost per GB and validity.
   */
  function computeDataPackScore(plan) {
    if (!plan || !plan.price || !plan.totalDataGB || plan.totalDataGB <= 0) {
      return { score: null, breakdown: null, reason: 'Total GB is required for data pack scoring' };
    }

    const costPerGB = plan.price / plan.totalDataGB;
    let score;
    if (costPerGB <= BENCHMARKS.EXCELLENT_COST_PER_GB) {
      score = 90;
    } else if (costPerGB >= BENCHMARKS.POOR_COST_PER_GB) {
      score = 45;
    } else {
      const ratio = (BENCHMARKS.POOR_COST_PER_GB - costPerGB) / (BENCHMARKS.POOR_COST_PER_GB - BENCHMARKS.EXCELLENT_COST_PER_GB);
      score = 45 + Math.round(ratio * 45);
    }

    // Bonus if standalone validity vs active base plan dependency
    if (!plan.isBasePlanDependent && plan.validityDays) {
      score = Math.min(98, score + 5);
    }

    return {
      score,
      breakdown: {
        costPerGB: Number(costPerGB.toFixed(2)),
        totalDataGB: plan.totalDataGB,
        basePlanDependent: plan.isBasePlanDependent
      },
      reason: `Cost: ₹${costPerGB.toFixed(1)}/GB. Total ${plan.totalDataGB} GB. ${plan.isBasePlanDependent ? 'Expires with active base plan' : 'Independent validity: ' + plan.validityText}.`
    };
  }

  return {
    BENCHMARKS,
    computeStandardValueScore,
    computeDataPackScore
  };
});
