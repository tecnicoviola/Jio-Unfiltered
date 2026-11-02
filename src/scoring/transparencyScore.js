/**
 * Transparency Scoring Engine
 * Computes an independent Transparency Score (0–100) reflecting
 * information clarity, condition disclosures, and verifiability.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { getEvidenceForPlan } = require('../evidence/evidenceStore');
    module.exports = factory(getEvidenceForPlan);
  } else {
    root.JioTransparencyScorer = factory(root.JioEvidenceStore.getEvidenceForPlan);
  }
})(typeof self !== 'undefined' ? self : this, function (getEvidenceForPlan) {
  'use strict';

  function computeTransparencyScore(plan) {
    if (!plan) {
      return { score: 0, breakdown: {}, coverage: 'Unknown' };
    }

    let priceValidityPoints = 0;
    let dataClarityPoints = 0;
    let termsClarityPoints = 0;
    let conditionDisclosurePoints = 0;
    let sourceVerificationPoints = 0;

    // 1. Price & Validity Clarity (Max 20)
    if (plan.price && plan.price > 0) priceValidityPoints += 10;
    if (plan.validityDays && plan.validityDays > 0) {
      priceValidityPoints += 10;
    } else if (plan.isBasePlanDependent) {
      // Clearly marked as base plan dependent
      priceValidityPoints += 8;
    }

    // 2. Data Clarity (Daily vs Total Quota) (Max 20)
    if (plan.dailyDataGB > 0 && plan.totalDataGB > 0) {
      // Both daily rate and total pool explicitly specified
      dataClarityPoints += 20;
    } else if (plan.totalDataGB > 0 || plan.dailyDataGB > 0) {
      dataClarityPoints += 15;
    } else if (plan.categories.includes('Top-up Voucher') || plan.categories.includes('Value')) {
      // Voice-only or monetary vouchers without data
      dataClarityPoints += 20;
    }

    // 3. Post-Quota & Throttle Disclosures (Max 20)
    if (plan.postQuotaSpeed || (plan.rawStar && plan.rawStar.some(s => /64\s*kbps/i.test(s)))) {
      termsClarityPoints += 20; // 64 Kbps throttle explicitly stated
    } else if (plan.categories.includes('Data Packs') && plan.isBasePlanDependent) {
      termsClarityPoints += 15;
    } else {
      termsClarityPoints += 10;
    }

    // 4. Offer Eligibility & Activation Continuity Conditions (Max 20)
    // If the plan has bundled promo offers (Gemini, Canva, Hotstar), are the rules documented?
    const hasSpecialOffers = (plan.rawNotes && plan.rawNotes.length > 0) || (plan.promotions && plan.promotions.length > 0);
    const hasStarRules = plan.rawStar && plan.rawStar.length > 0;
    if (hasSpecialOffers) {
      if (hasStarRules) {
        conditionDisclosurePoints = 20; // Offer conditions explicitly explained
      } else {
        conditionDisclosurePoints = 10; // Promotional claim without full conditions
      }
    } else {
      // Standard plan without promotional traps
      conditionDisclosurePoints = 20;
    }

    // 5. Verifiable Evidence & Authoritative Sources (Max 20)
    const evidenceItems = getEvidenceForPlan(plan);
    if (evidenceItems && evidenceItems.length >= 2) {
      sourceVerificationPoints = 20;
    } else if (evidenceItems && evidenceItems.length === 1) {
      sourceVerificationPoints = 15;
    } else {
      sourceVerificationPoints = 10;
    }

    const total = Math.min(100, Math.max(0, priceValidityPoints + dataClarityPoints + termsClarityPoints + conditionDisclosurePoints + sourceVerificationPoints));

    let coverageRating = 'Adequate';
    if (total >= 85) coverageRating = 'Comprehensive';
    else if (total < 70) coverageRating = 'Partial / Unverified Conditions';

    return {
      score: total,
      coverage: coverageRating,
      breakdown: {
        priceValidity: priceValidityPoints,
        dataClarity: dataClarityPoints,
        throttleTerms: termsClarityPoints,
        conditionDisclosure: conditionDisclosurePoints,
        sourceVerification: sourceVerificationPoints
      },
      evidenceCount: evidenceItems.length,
      evidenceList: evidenceItems
    };
  }

  return {
    computeTransparencyScore
  };
});
