/**
 * Evidence and Source System
 * Provides verifiable evidence classes, citations, regulatory references,
 * and terms analysis for claims made by the extension.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioEvidenceStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EVIDENCE_CLASSES = {
    OFFICIALLY_VERIFIED: 'OFFICIALLY_VERIFIED',
    REGULATORY_SOURCE: 'REGULATORY_SOURCE',
    COMMUNITY_REPORTED: 'COMMUNITY_REPORTED',
    CONFLICTING_EVIDENCE: 'CONFLICTING_EVIDENCE',
    CONFLICTING: 'CONFLICTING_EVIDENCE',
    UNVERIFIED: 'UNVERIFIED',
    UNKNOWN: 'UNVERIFIED'
  };

  const VERIFIED_KNOWLEDGE_BASE = [
    {
      id: 'true-5g-unlimited-eligibility',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Unlimited 5G Data Eligibility on Plans with 2 GB/Day or Higher (₹349+)',
      sourceTitle: 'Jio True 5G FAQ: Prepaid Unlimited 5G Plan Eligibility',
      publisher: 'Reliance Jio Official FAQ',
      url: 'https://www.jio.com/help/faq/mobile/jio-true-5g/new-unlimited-plans/do-i-get-unlimited-5g-in-my-prepaid-mobile-plan/',
      dateChecked: '2026-10-28',
      excerpt: 'Unlimited 5G data is provided on active prepaid plans with 2 GB/day and above data allowances (starting with ₹349). Plans below ₹349 or with 1.5 GB/day or less daily data are not eligible for unlimited 5G.',
      summary: 'Subscribers with a compatible 5G device in Jio True 5G coverage areas receive uncapped 5G data on active recharges providing at least 2 GB/day (starting at ₹349). Plans below ₹349 or with 1.5 GB/day or less do not include unlimited 5G.',
      appliesTo: (plan) => Boolean(plan.isUnlimited5G || plan.dailyDataGB >= 2 || plan.price >= 349)
    },
    {
      id: 'gemini-pro-continuity-condition',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Google Gemini Pro 18-Month Offer Continuity Condition',
      sourceTitle: 'Jio Google Gemini Terms & Conditions',
      publisher: 'Reliance Jio Official Offer Terms',
      url: 'https://www.jio.com/jcms/en-in/jio-google-gemini-terms-and-conditions/',
      dateChecked: '2026-10-28',
      excerpt: 'To continue using Google Gemini offer benefits user must continuously be active on an unlimited 5G plan of ₹349 and above, throughout the offer period.',
      summary: 'Access to the bundled Google Gemini Pro subscription (worth ₹35,100 for 18 months) requires consecutive continuous recharges on eligible Unlimited 5G plans (₹349 and above). A lapse in active plan validity or downgrade voids promotional access.',
      appliesTo: (plan) => Boolean((plan.rawNotes && plan.rawNotes.some(n => /gemini/i.test(n))) || (plan.promotions && plan.promotions.some(p => /gemini/i.test(p))))
    },
    {
      id: 'canva-pro-continuity-condition',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Canva Pro 12-Month Subscription Continuity Terms',
      sourceTitle: 'Jio Tariff Terms & Conditions / Special Promotional Notes',
      publisher: 'Reliance Jio Official Tariff Disclosures',
      url: 'https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/',
      dateChecked: '2026-10-28',
      excerpt: 'To continue using Canva Offer benefits user must continuously be active on an unlimited 5G plan of ₹399 and above, throughout the offer period.',
      summary: 'Bundled Canva Pro subscription benefits require continuous active recharges on qualifying plans of ₹399 or higher throughout the 12-month offer duration. Benefits must be claimed via MyJio.',
      appliesTo: (plan) => Boolean((plan.rawNotes && plan.rawNotes.some(n => /canva/i.test(n))) || (plan.subscriptions && plan.subscriptions.some(s => /canva/i.test(s.title || s))))
    },
    {
      id: 'jiohotstar-prepaid-terms',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Bundled JioHotstar Mobile Subscription Activation Terms',
      sourceTitle: 'JioHotstar Offer T&C for Prepaid Customers',
      publisher: 'Reliance Jio Official Terms & Conditions',
      url: 'https://www.jio.com/jcms/en-in/jiohotstar-offer-t-c-for-prepaid-customers/',
      dateChecked: '2026-10-28',
      excerpt: 'Subscription is activated by logging into JioHotstar using the registered Jio mobile number on which the recharge was performed. Benefits remain active for the validity period of the recharge.',
      summary: 'Bundled JioHotstar subscriptions are provisioned directly to the subscriber\'s registered Jio mobile number and activated by signing in on the Hotstar app or via MyJio. Subscriptions stay active for the recharge validity period.',
      appliesTo: (plan) => Boolean((plan.subscriptions && plan.subscriptions.some(s => /hotstar/i.test(s.title || s))) || (plan.rawNotes && plan.rawNotes.some(n => /hotstar/i.test(n))))
    },
    {
      id: 'jiohotstar-renewal-continuity',
      class: EVIDENCE_CLASSES.COMMUNITY_REPORTED,
      title: 'OTT Login Session Continuity on Consecutive Recharges',
      sourceTitle: 'Telecom User Community Reports',
      publisher: 'Community Observation Reports (Unverified by Official T&C)',
      url: 'https://www.jio.com/jcms/en-in/jiohotstar-offer-t-c-for-prepaid-customers/',
      dateChecked: '2026-10-28',
      excerpt: 'Users report an informal ~48-hour renewal window to maintain active device login tokens without signing in again.',
      summary: 'Multiple subscriber reports indicate that renewing within 48 hours of plan expiration maintains device login tokens and watchlist history on third-party OTT apps, whereas official operator terms formally state access expires at the end of plan validity.',
      appliesTo: (plan) => Boolean(plan.subscriptions && plan.subscriptions.some(s => /hotstar|disney|ott/i.test(s.title || s)))
    },
    {
      id: 'fup-post-quota-throttle',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Fair Usage Policy (FUP) & 64 Kbps Post-Quota Throttling',
      sourceTitle: 'Jio Prepaid Tariff Disclosures & Condition Details',
      publisher: 'Reliance Jio Official Tariff Disclosures',
      url: 'https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/',
      dateChecked: '2026-10-28',
      excerpt: 'Post daily high speed data quota exhaustion, speed reduced to 64 Kbps. High speed quota resets every 24 hours at 00:00 hours.',
      summary: 'When the allocated daily high-speed 4G/5G quota is depleted, unlimited internet connectivity continues at a throttled speed of 64 Kbps without additional data charges until the automatic daily quota reset at 00:00 midnight.',
      appliesTo: (plan) => Boolean(plan.dailyDataGB > 0)
    },
    {
      id: 'trai-30day-calendar-month-mandate',
      class: EVIDENCE_CLASSES.REGULATORY_SOURCE,
      title: 'TRAI Telecommunication Tariff (66th Amendment) Order, 2022',
      sourceTitle: 'TRAI Gazette Notification: 30-Day and Calendar Month Tariff Orders',
      publisher: 'Telecom Regulatory Authority of India (TRAI)',
      url: 'https://www.trai.gov.in/',
      dateChecked: '2026-10-28',
      excerpt: 'Every telecom service provider shall offer at least one plan voucher, one special tariff voucher and one combo voucher having validity of thirty days and renewal on the same date of every month.',
      summary: 'TRAI mandated that telecom operators provide 30-day and calendar-month vouchers to prevent consumer cost inflation from 28-day billing cycles, which force 13 recharges per year (365 / 28 ≈ 13.03) instead of 12. Monthly costs are normalized to a 30-day standard baseline.',
      appliesTo: (plan) => Boolean(plan.validityDays && [28, 56, 84, 30].includes(plan.validityDays))
    },
    {
      id: 'trai-sim-deactivation-90day-rule',
      class: EVIDENCE_CLASSES.REGULATORY_SOURCE,
      title: 'TRAI Regulation on Prepaid SIM Deactivation for Non-Usage',
      sourceTitle: 'TRAI Standards of Quality of Service & Consumer Protection Regulations',
      publisher: 'Telecom Regulatory Authority of India (TRAI)',
      url: 'https://www.trai.gov.in/',
      dateChecked: '2026-10-28',
      excerpt: 'No mobile service provider shall deactivate the cellular mobile telephone connection of a subscriber for non-usage for a period of less than ninety days.',
      summary: 'Under TRAI consumer protection directives, a prepaid mobile connection cannot be disconnected for non-usage for at least 90 days. If the account balance has at least ₹20, an automatic non-usage fee can extend validity by 30 days; otherwise, an SMS notice of 15 days is required prior to deactivation.',
      appliesTo: (plan) => Boolean(plan.categories && (plan.categories.includes('Value') || plan.categories.includes('Top-up Voucher') || plan.price <= 200))
    },
    {
      id: 'data-addon-base-plan-dependency',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Data Add-On / Booster Active Base Plan Requirement',
      sourceTitle: 'Jio Data Add-On Pack Product Disclosures',
      publisher: 'Reliance Jio Official Tariff Disclosures',
      url: 'https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/',
      dateChecked: '2026-10-28',
      excerpt: 'Data Add-On / Booster vouchers work only when the user has an active base prepaid plan with validity. Does not include voice or standalone validity.',
      summary: 'Data Add-On and Data Booster packs are supplementary vouchers that do not provide standalone SIM service validity or voice calling. They function strictly alongside an existing active base plan and expire when the base plan expires.',
      appliesTo: (plan) => Boolean(plan.isBasePlanDependent || (plan.categories && plan.categories.some(c => /data pack|addon|voucher|booster|feature phone addon/i.test(c)) && plan.voice === 'N/A'))
    },
    {
      id: 'jio-apps-suite-bundle-terms',
      class: EVIDENCE_CLASSES.OFFICIALLY_VERIFIED,
      title: 'Jio System Apps (JioTV & JioAICloud) Complimentary Access Terms',
      sourceTitle: 'Jio Prepaid Standard Plan Benefits',
      publisher: 'Reliance Jio Official Tariff Terms',
      url: 'https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/',
      dateChecked: '2026-10-28',
      excerpt: 'Complimentary subscription to Jio apps (JioTV, JioAICloud) is provided for the duration of active plan validity.',
      summary: 'Complimentary access to Jio apps (such as JioTV and JioAICloud storage) is bundled across standard smartphone recharges and remains accessible only while an eligible plan validity is active.',
      appliesTo: (plan) => Boolean(plan.subscriptions && plan.subscriptions.some(s => /jiotv|jioaicloud|jiocloud/i.test(s.title || s)))
    }
  ];

  function getEvidenceForPlan(plan) {
    if (!plan) return [];
    const results = [];

    for (const item of VERIFIED_KNOWLEDGE_BASE) {
      if (typeof item.appliesTo === 'function' && item.appliesTo(plan)) {
        results.push({
          id: item.id,
          class: item.class,
          title: item.title,
          sourceTitle: item.sourceTitle,
          publisher: item.publisher,
          url: item.url,
          dateChecked: item.dateChecked,
          summary: item.summary,
          excerpt: item.excerpt || ''
        });
      }
    }

    return results;
  }

  return {
    EVIDENCE_CLASSES,
    VERIFIED_KNOWLEDGE_BASE,
    getEvidenceForPlan
  };
});
