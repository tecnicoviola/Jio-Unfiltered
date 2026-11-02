/**
 * Normalized Plan Model
 * Represents a Jio prepaid plan across all categories with consistent typing,
 * cost normalization, and evidence-backed attributes.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioPlanModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class NormalizedPlan {
    constructor(data = {}) {
      this.id = data.id ? String(data.id) : null;
      this.voucherId = data.voucherId ? String(data.voucherId) : (this.id || null);
      this.key = data.key || null;
      this.name = data.name || (data.price ? `₹${data.price}` : '');
      this.planName = data.planName || '';
      this.price = typeof data.price === 'number' ? data.price : parseFloat(data.price) || 0;
      
      // Validity
      this.validityDays = typeof data.validityDays === 'number' ? data.validityDays : (parseInt(data.validityDays, 10) || null);
      this.validityText = data.validityText || (this.validityDays ? `${this.validityDays} Days` : 'N/A');
      this.isCalendarMonth = Boolean(data.isCalendarMonth);
      this.isBasePlanDependent = Boolean(data.isBasePlanDependent);

      // Data allowance
      this.dailyDataGB = typeof data.dailyDataGB === 'number' ? data.dailyDataGB : (parseFloat(data.dailyDataGB) || 0);
      this.totalDataGB = typeof data.totalDataGB === 'number' ? data.totalDataGB : (parseFloat(data.totalDataGB) || 0);
      this.isUnlimited5G = Boolean(data.isUnlimited5G);
      this.postQuotaSpeed = data.postQuotaSpeed || '64 Kbps';

      // Category membership
      this.categories = Array.isArray(data.categories) ? [...new Set(data.categories)] : (data.category ? [data.category] : []);
      this.subcategories = Array.isArray(data.subcategories) ? [...new Set(data.subcategories)] : (data.subcategory ? [data.subcategory] : []);

      // Calling & SMS
      const allCats = this.categories.concat(this.subcategories);
      const catCheckStr = allCats.join(' ').toLowerCase();
      const planNameCheckStr = ((data.planName || '') + ' ' + (data.name || '')).toLowerCase();
      const hasNoVoiceNotes = Array.isArray(data.rawNotes) && data.rawNotes.some(n => /no voice|does not include voice/i.test(n));
      const isDataOnly = catCheckStr.includes('addon') || catCheckStr.includes('add-on') ||
        catCheckStr.includes('data voucher') || catCheckStr.includes('data pack') ||
        catCheckStr.includes('data booster') || catCheckStr.includes('no voice') ||
        catCheckStr.includes('feature phone addon') || catCheckStr.includes('true 5g upgrade') ||
        planNameCheckStr.includes('data voucher') || planNameCheckStr.includes('data booster') ||
        hasNoVoiceNotes;

      if (data.voice) {
        const v = String(data.voice).trim();
        this.voice = (v.toUpperCase() === 'NA' || v.toUpperCase() === 'N/A') ? 'N/A' : v;
      } else if (isDataOnly) {
        this.voice = 'N/A';
      } else {
        this.voice = 'Unlimited';
      }

      if (data.sms) {
        const s = String(data.sms).trim();
        this.sms = (s.toUpperCase() === 'NA' || s.toUpperCase() === 'N/A') ? 'N/A' : s;
      } else if (isDataOnly) {
        this.sms = 'N/A';
      } else {
        this.sms = data.smsPerDay ? `${data.smsPerDay} SMS/Day` : (data.totalSMS ? `${data.totalSMS} SMS` : '100 SMS/Day');
      }

      // Bundled benefits
      this.subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
      this.rawNotes = Array.isArray(data.rawNotes) ? data.rawNotes : [];
      this.rawStar = Array.isArray(data.rawStar) ? data.rawStar : [];
      this.promotions = Array.isArray(data.promotions) ? data.promotions : [];

      // Calculated Costs
      this.calculateNormalizedCosts();

      // Scores & Recommendations
      this.valueScore = data.valueScore || null;
      this.transparencyScore = data.transparencyScore || null;
      this.scoreBreakdown = data.scoreBreakdown || null;
      this.transparencyBreakdown = data.transparencyBreakdown || null;
      this.recommendationBadges = Array.isArray(data.recommendationBadges) ? data.recommendationBadges : [];
      this.evidenceList = Array.isArray(data.evidenceList) ? data.evidenceList : [];
    }

    calculateNormalizedCosts() {
      if (this.validityDays && this.validityDays > 0 && this.price > 0) {
        this.effectiveDailyCost = Number((this.price / this.validityDays).toFixed(2));
        this.effective30DayCost = Number(((this.price / this.validityDays) * 30).toFixed(2));
        this.effectiveAnnualCost = Number(((this.price / this.validityDays) * 365).toFixed(2));
      } else {
        this.effectiveDailyCost = null;
        this.effective30DayCost = null;
        this.effectiveAnnualCost = null;
      }
    }

    addCategory(category, subcategory = null) {
      if (category && !this.categories.includes(category)) {
        this.categories.push(category);
      }
      if (subcategory && !this.subcategories.includes(subcategory)) {
        this.subcategories.push(subcategory);
      }
    }
  }

  return {
    NormalizedPlan
  };
});
