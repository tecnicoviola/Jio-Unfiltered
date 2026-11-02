/**
 * Plan Normalizer
 * Pure functions to parse, sanitize, and normalize plan information from
 * both DOM extraction and API JSON payloads.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { NormalizedPlan } = require('../models/plan');
    module.exports = factory(NormalizedPlan);
  } else {
    root.JioNormalizer = factory(root.JioPlanModel.NormalizedPlan);
  }
})(typeof self !== 'undefined' ? self : this, function (NormalizedPlan) {
  'use strict';

  function parseRupeeAmount(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;
    // Strip ₹, commas, whitespace, and non-numeric characters except decimal
    const cleaned = String(text).replace(/[₹,\s]/g, '').trim();
    const match = cleaned.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function parseValidity(validityStr, planNameStr = '') {
    if (!validityStr && !planNameStr) {
      return { days: null, text: 'N/A', isCalendarMonth: false, isBasePlanDependent: false };
    }
    const str = `${validityStr || ''} ${planNameStr || ''}`.toLowerCase();

    // Base plan dependency
    if (str.includes('existing plan') || str.includes('active plan') || str.includes('base plan') || str.includes('validity of your active')) {
      return { days: null, text: 'Active Plan Validity', isCalendarMonth: false, isBasePlanDependent: true };
    }

    // Calendar month
    if (str.includes('calendar month') || str.includes('1 calendar month')) {
      return { days: 30, text: '1 Calendar Month', isCalendarMonth: true, isBasePlanDependent: false };
    }

    // Days match
    const dayMatch = str.match(/(\d+)\s*(?:days?|d\b)/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      return { days, text: `${days} Days`, isCalendarMonth: false, isBasePlanDependent: false };
    }

    // Months match (e.g., 1 Month = 28 or 30 days depending on wording)
    const monthMatch = str.match(/(\d+)\s*(?:month|months|m\b)/i);
    if (monthMatch) {
      const months = parseInt(monthMatch[1], 10);
      const days = months * 28; // Jio standard 1-month cycle is commonly 28 days
      return { days, text: `${days} Days (${months} Month${months > 1 ? 's' : ''})`, isCalendarMonth: false, isBasePlanDependent: false };
    }

    // Year match
    if (str.includes('365') || str.includes('1 year') || str.includes('annual')) {
      return { days: 365, text: '365 Days', isCalendarMonth: false, isBasePlanDependent: false };
    }

    return { days: null, text: validityStr || 'N/A', isCalendarMonth: false, isBasePlanDependent: false };
  }

  function parseDataAllowance(dataStr, validityDays = null, miscDetails = []) {
    let dailyDataGB = 0;
    let totalDataGB = 0;
    let isUnlimited5G = false;

    // Check detail table if available
    if (Array.isArray(miscDetails)) {
      for (const item of miscDetails) {
        const header = (item.header || '').toLowerCase();
        const val = (item.value || '').toLowerCase();
        if (header.includes('data at high speed') || header.includes('daily data')) {
          const m = val.match(/([\d\.]+)\s*gb\/day/);
          if (m) dailyDataGB = parseFloat(m[1]);
        }
        if (header.includes('total data')) {
          const m = val.match(/([\d\.]+)\s*gb/);
          if (m) totalDataGB = parseFloat(m[1]);
          const mbMatch = val.match(/([\d\.]+)\s*mb/);
          if (mbMatch) totalDataGB = parseFloat(mbMatch[1]) / 1024;
        }
      }
    }

    const fullStr = String(dataStr || '').toLowerCase();

    // Check for Unlimited 5G
    if (fullStr.includes('unlimited 5g') || fullStr.includes('true 5g')) {
      isUnlimited5G = true;
    }

    // Check daily data pattern: e.g. "2 GB/Day", "1.5 GB/day"
    if (dailyDataGB === 0) {
      const dailyMatch = fullStr.match(/([\d\.]+)\s*(?:gb|mb)\s*\/\s*day/i);
      if (dailyMatch) {
        dailyDataGB = parseFloat(dailyMatch[1]);
        if (fullStr.includes('mb/day')) {
          dailyDataGB = dailyDataGB / 1024;
        }
      }
    }

    // Check total data pattern (strip any /day so we don't confuse daily quota with total pool)
    if (totalDataGB === 0) {
      const withoutDaily = fullStr.replace(/[\d\.]+\s*(?:gb|mb)\s*\/\s*day/gi, '');
      const totalMatch = withoutDaily.match(/(\d+(?:\.\d+)?)\s*gb\b/i);
      if (totalMatch) {
        totalDataGB = parseFloat(totalMatch[1]);
      } else {
        const mbMatch = withoutDaily.match(/(\d+(?:\.\d+)?)\s*mb\b/i);
        if (mbMatch) {
          totalDataGB = parseFloat(mbMatch[1]) / 1024;
        }
      }
    }

    // If daily data is known but total data is 0, calculate total = daily * validityDays
    if (dailyDataGB > 0 && totalDataGB === 0 && validityDays) {
      totalDataGB = Number((dailyDataGB * validityDays).toFixed(1));
    }

    return {
      dailyDataGB: Number(dailyDataGB.toFixed(2)),
      totalDataGB: Number(totalDataGB.toFixed(2)),
      isUnlimited5G
    };
  }

  function normalizeFromRawApi(rawPlan, category = '', subcategory = '') {
    const price = parseRupeeAmount(rawPlan.amount || rawPlan.name);
    
    // Extract validity from misc.details or primeData
    let validityRaw = '';
    const details = (rawPlan.misc && Array.isArray(rawPlan.misc.details)) ? rawPlan.misc.details : [];
    const valDetail = details.find(d => (d.header || '').toLowerCase().includes('validity'));
    if (valDetail) {
      validityRaw = valDetail.value;
    } else if (rawPlan.primeData && rawPlan.primeData.offerBenefits3 && rawPlan.primeData.offerBenefits4) {
      validityRaw = `${rawPlan.primeData.offerBenefits3} ${rawPlan.primeData.offerBenefits4}`;
    }

    const validity = parseValidity(validityRaw, rawPlan.planName);

    // Extract data from details or primeData
    let dataStr = '';
    const dataDetail = details.find(d => (d.header || '').toLowerCase().includes('data'));
    if (dataDetail) {
      dataStr = `${dataDetail.header}: ${dataDetail.value}`;
    }
    if (rawPlan.primeData) {
      dataStr += ` ${rawPlan.primeData.offerBenefits1 || ''} ${rawPlan.primeData.offerBenefits2 || ''}`;
    }
    if (rawPlan.filterKeys && rawPlan.filterKeys.data) {
      dataStr += ` ${rawPlan.filterKeys.data}`;
    }

    const dataAllowance = parseDataAllowance(dataStr, validity.days, details);

    // Check stars/notes for Unlimited 5G
    const stars = (rawPlan.misc && Array.isArray(rawPlan.misc.star)) ? rawPlan.misc.star : [];
    const notes = (rawPlan.misc && Array.isArray(rawPlan.misc.notes)) ? rawPlan.misc.notes : [];
    const is5GInStar = stars.some(s => s.toLowerCase().includes('unlimited 5g'));
    if (is5GInStar) {
      dataAllowance.isUnlimited5G = true;
    }

    // Subscriptions
    const subscriptions = [];
    if (rawPlan.misc && Array.isArray(rawPlan.misc.subscriptions)) {
      for (const sub of rawPlan.misc.subscriptions) {
        if (sub.title) {
          subscriptions.push({
            title: sub.title,
            tier: sub.tier || 'Standard',
            image: sub.image || null
          });
        }
      }
    }

    // Promotions detection (distinguishing promotional claims from core benefits)
    const promotions = [];
    for (const note of notes) {
      const clean = note.replace(/<[^>]+>/g, '').trim();
      if (/gemini|canva|pro plan|worth\s*₹/i.test(clean)) {
        promotions.push(clean);
      }
    }

    const categories = [];
    if (category) categories.push(category);
    if (rawPlan.categoryLabel && !categories.includes(rawPlan.categoryLabel)) {
      categories.push(rawPlan.categoryLabel);
    }

    // Extract Voice and SMS benefits from details if available
    let voice = null;
    let sms = null;
    const voiceDetail = details.find(d => (d.header || '').toLowerCase().includes('voice'));
    if (voiceDetail && voiceDetail.value) {
      const v = voiceDetail.value.trim();
      voice = (v.toUpperCase() === 'NA' || v.toUpperCase() === 'N/A') ? 'N/A' : v;
    }
    const smsDetail = details.find(d => (d.header || '').toLowerCase().includes('sms'));
    if (smsDetail && smsDetail.value) {
      const s = smsDetail.value.trim();
      sms = (s.toUpperCase() === 'NA' || s.toUpperCase() === 'N/A') ? 'N/A' : s;
    }

    return new NormalizedPlan({
      id: rawPlan.id || rawPlan.voucherId || null,
      voucherId: rawPlan.voucherId || rawPlan.id || null,
      key: rawPlan.key || null,
      name: `₹${price}`,
      planName: rawPlan.planName || `₹${price} Plan`,
      price,
      validityDays: validity.days,
      validityText: validity.text,
      isCalendarMonth: validity.isCalendarMonth,
      isBasePlanDependent: validity.isBasePlanDependent,
      dailyDataGB: dataAllowance.dailyDataGB,
      totalDataGB: dataAllowance.totalDataGB,
      isUnlimited5G: dataAllowance.isUnlimited5G,
      voice,
      sms,
      categories,
      subcategories: subcategory ? [subcategory] : [],
      subscriptions,
      rawNotes: notes,
      rawStar: stars,
      promotions
    });
  }

  function normalizeFromDomCard(cardElement, category = '') {
    if (!cardElement) return null;

    // Price
    const rupeeElem = cardElement.querySelector('[class*="PlanName_rupee"], [class*="PlanName_planText"], .PlanName_rupee__JqPap');
    const priceText = rupeeElem ? rupeeElem.textContent : (cardElement.textContent.match(/₹\s*(\d+(?:,\d+)?)/) || [])[1];
    const price = parseRupeeAmount(priceText);
    if (!price) return null;

    // Validity
    let validityRaw = '';
    const validityElem = cardElement.querySelector('[class*="ValidityCol_"], [class*="offerBenefits"], .Details_validityDataCon__2gm9W');
    if (validityElem) {
      validityRaw = validityElem.textContent;
    }
    if (!validityRaw || !/\d/.test(validityRaw)) {
      const match = cardElement.textContent.match(/(\d+\s*(?:Days?|months?|calendar month))/i);
      if (match) validityRaw = match[1];
    }
    const validity = parseValidity(validityRaw);

    // Data
    let dataRaw = '';
    const dataElem = cardElement.querySelector('[class*="DataCol_"], [class*="storageFont"], [class*="planName3"], .Details_validityDataCon__2gm9W');
    if (dataElem) {
      dataRaw = dataElem.textContent;
    }
    if (!dataRaw || !/\d/.test(dataRaw)) {
      const match = cardElement.textContent.match(/(\d+(?:\.\d+)?\s*(?:GB|MB)(?:\s*\/\s*day)?)/i);
      if (match) dataRaw = match[1];
    }
    const dataAllowance = parseDataAllowance(dataRaw, validity.days);

    // Unlimited 5G check from badge or text
    const textAll = cardElement.textContent.toLowerCase();
    if (textAll.includes('unlimited 5g') || textAll.includes('5g + ai')) {
      dataAllowance.isUnlimited5G = true;
    }

    // Subscriptions icons/titles
    const subscriptions = [];
    const subIcons = cardElement.querySelectorAll('img[alt], .Details_planCardBody__T_1ab img');
    subIcons.forEach(img => {
      const alt = img.getAttribute('alt') || img.getAttribute('title') || '';
      if (alt && !['rupee', 'jio', 'arrow'].includes(alt.toLowerCase())) {
        subscriptions.push({ title: alt, tier: 'Standard' });
      }
    });

    // Extract promo banners for separation
    const promotions = [];
    const promoElem = cardElement.querySelector('.Details_tagDataCont__3dGH-') ||
      cardElement.querySelector('.Tag_customModalTagData__2bZOq');
    if (promoElem) {
      const pText = promoElem.textContent.trim();
      if (pText) promotions.push(pText);
    }

    // Create fingerprint if no id in DOM
    const fingerprint = `fp_${price}_${validity.days || 0}_${dataAllowance.dailyDataGB}_${dataAllowance.totalDataGB}`;

    return new NormalizedPlan({
      id: fingerprint,
      name: `₹${price}`,
      price,
      validityDays: validity.days,
      validityText: validity.text,
      isCalendarMonth: validity.isCalendarMonth,
      isBasePlanDependent: validity.isBasePlanDependent,
      dailyDataGB: dataAllowance.dailyDataGB,
      totalDataGB: dataAllowance.totalDataGB,
      isUnlimited5G: dataAllowance.isUnlimited5G,
      categories: category ? [category] : [],
      subscriptions,
      rawNotes: textAll.includes('no voice') || textAll.includes('does not include voice') ? ['This pack does not include voice or SMS benefits.'] : [],
      promotions
    });
  }

  return {
    parseRupeeAmount,
    parseValidity,
    parseDataAllowance,
    normalizeFromRawApi,
    normalizeFromDomCard
  };
});
