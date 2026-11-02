/**
 * API Extractor
 * Fetches the complete official plan catalogue directly from Jio's same-origin endpoint
 * when operating inside the target page.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { normalizeFromRawApi } = require('./normalizer');
    const { scorePlan } = require('../scoring/categoryScorer');
    module.exports = factory(normalizeFromRawApi, scorePlan);
  } else {
    root.JioApiExtractor = factory(
      root.JioNormalizer.normalizeFromRawApi,
      root.JioCategoryScorer.scorePlan
    );
  }
})(typeof self !== 'undefined' ? self : this, function (normalizeFromRawApi, scorePlan) {
  'use strict';

  async function fetchFullCatalogue(catalogueInstance) {
    const endpoint = '/api/jio-mdmdata-service/mdmdata/recharge/plans?productType=MOBILITY&billingType=1';
    
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[Jio Unfiltered] API returned HTTP ${response.status}`);
        return false;
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.planCategories)) {
        return false;
      }

      for (const cat of data.planCategories) {
        const catName = cat.type || 'Other';
        if (Array.isArray(cat.subCategories)) {
          for (const sub of cat.subCategories) {
            const subName = sub.type || '';
            if (Array.isArray(sub.plans)) {
              for (const rawPlan of sub.plans) {
                const plan = normalizeFromRawApi(rawPlan, catName, subName);
                scorePlan(plan);
                catalogueInstance.addPlan(plan, catName, subName);
              }
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.warn('[Jio Unfiltered] Error querying same-origin API:', err);
      return false;
    }
  }

  return {
    fetchFullCatalogue
  };
});
