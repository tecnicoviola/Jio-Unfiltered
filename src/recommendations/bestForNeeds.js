/**
 * Best for My Needs Engine
 * Personalized recommendation system based on user constraints and prioritized preferences.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioBestForNeeds = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function filterAndRankByNeeds(allPlans, preferences = {}) {
    if (!Array.isArray(allPlans) || allPlans.length === 0) {
      return {
        winner: null,
        alternatives: [],
        totalEligible: 0,
        explanation: 'No plans available in catalogue.'
      };
    }

    const {
      primaryUseCase = 'everyday',
      maxBudget = null,
      preferredValidity = null,
      minDailyDataGB = null,
      need5G = false,
      interestInOTT = false,
      preferLowerUpfront = false
    } = preferences;

    // STEP 1: Hard Constraints (strict filtering)
    let eligible = allPlans.filter(p => {
      // 1. Budget constraint
      if (maxBudget !== null && maxBudget > 0 && p.price > maxBudget) {
        return false;
      }

      // 2. 5G Requirement
      if (need5G && !p.isUnlimited5G) {
        return false;
      }

      // 3. Minimum Daily Data Requirement
      if (minDailyDataGB !== null && minDailyDataGB > 0) {
        if ((p.dailyDataGB || 0) < minDailyDataGB) {
          return false;
        }
      }

      // 4. Preferred Validity (if strict)
      if (preferredValidity && preferredValidity !== 'any') {
        const val = parseInt(preferredValidity, 10);
        if (val === 28 && p.validityDays > 30) return false;
        if (val === 84 && (p.validityDays < 84 || p.validityDays > 90)) return false;
        if (val === 365 && p.validityDays < 365) return false;
      }

      // 5. Use Case Specific Exclusions
      if (primaryUseCase === 'international_travel') {
        return p.categories && p.categories.includes('International Roaming');
      }

      if (primaryUseCase === 'secondary_sim') {
        // Exclude costly plans (> ₹500) from secondary SIM consideration
        if (p.price > 500) return false;
      }

      return true;
    });

    if (eligible.length === 0) {
      return {
        winner: null,
        alternatives: [],
        totalEligible: 0,
        unmetReason: `No Jio plan met all strict constraints (Budget <= ₹${maxBudget || 'any'}, 5G: ${need5G ? 'Required' : 'Optional'}, Min Data: ${minDailyDataGB ? minDailyDataGB + ' GB/day' : 'Any'}). Try adjusting your budget or data requirement.`
      };
    }

    // STEP 2: Soft Scoring & Ranking based on Use Case
    eligible.forEach(plan => {
      let score = plan.valueScore || 50;

      // Use Case specific weight boosts
      switch (primaryUseCase) {
        case 'secondary_sim':
          // Prioritize lowest total price and longest validity for OTP reception
          score += (500 - plan.price) / 10;
          if (plan.validityDays && plan.validityDays >= 84) score += 15;
          break;

        case 'heavy_data':
          score += (plan.dailyDataGB || 0) * 10;
          if (plan.isUnlimited5G) score += 15;
          break;

        case 'ott_entertainment':
          const ottCount = (plan.subscriptions || []).filter(s =>
            /netflix|hotstar|prime|sonyliv|zee5|fancode|jiosaavn/i.test(s.title)
          ).length;
          score += ottCount * 12;
          break;

        case 'long_validity':
          if (plan.validityDays >= 365) score += 25;
          else if (plan.validityDays >= 84) score += 15;
          // Prefer lowest effective monthly cost
          if (plan.effective30DayCost) {
            score += Math.max(0, (400 - plan.effective30DayCost) / 10);
          }
          break;

        case 'everyday':
        default:
          if (preferLowerUpfront) {
            score += (1000 - Math.min(1000, plan.price)) / 20;
          } else {
            if (plan.validityDays >= 84) score += 10;
          }
          if (interestInOTT && (plan.subscriptions || []).length > 2) {
            score += 10;
          }
          break;
      }

      plan._rankScore = score;
    });

    eligible.sort((a, b) => b._rankScore - a._rankScore);

    const winner = eligible[0];
    const alternatives = eligible.slice(1, 4);

    // Apply synchronized Best for Needs badge
    if (winner && !winner.recommendationBadges.includes('BEST FOR YOUR NEEDS · #1')) {
      winner.recommendationBadges.push('BEST FOR YOUR NEEDS · #1');
    }

    let winnerRationale = '';
    switch (primaryUseCase) {
      case 'secondary_sim':
        winnerRationale = `Selected for minimal cost (₹${winner.price}) to keep your SIM active for OTPs and essential calls without paying for unused daily data.`;
        break;
      case 'heavy_data':
        winnerRationale = `Delivers ${winner.dailyDataGB} GB/day high-speed quota ${winner.isUnlimited5G ? 'plus Unlimited 5G' : ''} at ₹${winner.effectiveDailyCost}/day.`;
        break;
      case 'ott_entertainment':
        const ottNames = (winner.subscriptions || []).map(s => s.title).join(', ');
        winnerRationale = `Includes subscriptions (${ottNames || 'Jio Apps'}) paired with ${winner.dailyDataGB} GB/day streaming data.`;
        break;
      case 'long_validity':
        winnerRationale = `Locks in rate for ${winner.validityText} at an effective rate of ₹${winner.effective30DayCost}/month, eliminating monthly recharge maintenance.`;
        break;
      default:
        winnerRationale = `Optimal balance of daily data (${winner.dailyDataGB > 0 ? winner.dailyDataGB + ' GB/day' : winner.totalDataGB + ' GB'}), ${winner.validityText} validity, and overall cost efficiency.`;
        break;
    }

    return {
      winner,
      winnerRationale,
      alternatives,
      totalEligible: eligible.length,
      appliedPreferences: preferences
    };
  }

  return {
    filterAndRankByNeeds
  };
});
