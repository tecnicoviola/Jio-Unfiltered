/**
 * Stable Plan Identity and Deduplication Engine
 * Ensures plans appearing across multiple categories are recognized accurately
 * without merging disparate plans or losing category relationships.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioDeduplicator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function generateFingerprint(plan) {
    if (!plan) return '';
    const price = plan.price || 0;
    const validity = plan.validityDays || 0;
    const dailyData = plan.dailyDataGB || 0;
    const totalData = plan.totalDataGB || 0;
    const is5G = plan.isUnlimited5G ? '5g' : 'no5g';
    const isCal = plan.isCalendarMonth ? 'cal' : 'std';
    return `fp_${price}_${validity}_${dailyData}_${totalData}_${is5G}_${isCal}`;
  }

  function getPlanPrimaryId(plan) {
    if (!plan) return null;
    // Jio stable numeric ID
    if (plan.id && !String(plan.id).startsWith('fp_')) {
      return String(plan.id);
    }
    if (plan.voucherId && !String(plan.voucherId).startsWith('fp_')) {
      return String(plan.voucherId);
    }
    // Fallback composite fingerprint
    return generateFingerprint(plan);
  }

  function arePlansIdentical(planA, planB) {
    if (!planA || !planB) return false;
    
    // If both have official Jio IDs, compare IDs
    const idA = planA.id && !String(planA.id).startsWith('fp_') ? String(planA.id) : null;
    const idB = planB.id && !String(planB.id).startsWith('fp_') ? String(planB.id) : null;
    if (idA && idB) {
      return idA === idB;
    }

    // Material attribute comparison
    const priceSame = planA.price === planB.price;
    const validitySame = planA.validityDays === planB.validityDays && planA.isCalendarMonth === planB.isCalendarMonth;
    const dataSame = planA.dailyDataGB === planB.dailyDataGB && planA.totalDataGB === planB.totalDataGB;
    const fiveGSame = Boolean(planA.isUnlimited5G) === Boolean(planB.isUnlimited5G);
    
    return priceSame && validitySame && dataSame && fiveGSame;
  }

  class PlanCatalogue {
    constructor() {
      this.plansMap = new Map(); // key -> NormalizedPlan
      this.categoryMap = new Map(); // categoryName -> Set of plan keys
      this.categoriesInspected = new Set();
      this.totalRawCardsParsed = 0;
    }

    addPlan(plan, categoryName = null, subcategoryName = null) {
      if (!plan || !plan.price) return null;
      this.totalRawCardsParsed++;

      const key = getPlanPrimaryId(plan);
      if (!key) return null;

      if (categoryName) {
        this.categoriesInspected.add(categoryName);
      }

      if (this.plansMap.has(key)) {
        // Merge into existing plan record
        const existing = this.plansMap.get(key);
        if (categoryName) existing.addCategory(categoryName, subcategoryName);

        // Merge raw notes / stars if existing had fewer details
        if (plan.rawNotes && plan.rawNotes.length > (existing.rawNotes ? existing.rawNotes.length : 0)) {
          existing.rawNotes = plan.rawNotes;
        }
        if (plan.rawStar && plan.rawStar.length > (existing.rawStar ? existing.rawStar.length : 0)) {
          existing.rawStar = plan.rawStar;
        }
        if (plan.subscriptions && plan.subscriptions.length > (existing.subscriptions ? existing.subscriptions.length : 0)) {
          existing.subscriptions = plan.subscriptions;
        }
        if (plan.isUnlimited5G) existing.isUnlimited5G = true;

        if (categoryName) {
          if (!this.categoryMap.has(categoryName)) this.categoryMap.set(categoryName, new Set());
          this.categoryMap.get(categoryName).add(key);
        }
        return existing;
      } else {
        if (categoryName) plan.addCategory(categoryName, subcategoryName);
        this.plansMap.set(key, plan);

        if (categoryName) {
          if (!this.categoryMap.has(categoryName)) this.categoryMap.set(categoryName, new Set());
          this.categoryMap.get(categoryName).add(key);
        }
        return plan;
      }
    }

    getPlan(key) {
      return this.plansMap.get(key) || null;
    }

    getAllPlans() {
      return Array.from(this.plansMap.values());
    }

    getPlansForCategory(categoryName) {
      const keys = this.categoryMap.get(categoryName);
      if (!keys) return [];
      return Array.from(keys).map(k => this.plansMap.get(k)).filter(Boolean);
    }

    getCoverageStats() {
      return {
        uniquePlansCount: this.plansMap.size,
        totalRawCardsCount: this.totalRawCardsParsed,
        categoriesCount: this.categoriesInspected.size,
        categoriesList: Array.from(this.categoriesInspected)
      };
    }

    clear() {
      this.plansMap.clear();
      this.categoryMap.clear();
      this.categoriesInspected.clear();
      this.totalRawCardsParsed = 0;
    }
  }

  return {
    generateFingerprint,
    getPlanPrimaryId,
    arePlansIdentical,
    PlanCatalogue
  };
});
