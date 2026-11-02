/**
 * DOM Extractor & Card Enhancer
 * Scans rendered plan cards on the live Jio page, harmonizes them with the catalogue,
 * declutters marketing banners, and attaches score indicators and recommendation badges.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { normalizeFromDomCard, parseRupeeAmount } = require('./normalizer');
    const { scorePlan } = require('../scoring/categoryScorer');
    module.exports = factory(normalizeFromDomCard, parseRupeeAmount, scorePlan);
  } else {
    root.JioDomExtractor = factory(
      root.JioNormalizer.normalizeFromDomCard,
      root.JioNormalizer.parseRupeeAmount,
      root.JioCategoryScorer.scorePlan
    );
  }
})(typeof self !== 'undefined' ? self : this, function (normalizeFromDomCard, parseRupeeAmount, scorePlan) {
  'use strict';

  const CARD_SELECTORS = [
    '.planDetailsCard_container__2gpFj',
    '.Details_planCard__nJXQV',
    'div[class*="Details_planCard__"]',
    'div[class*="planDetailsCard_container__"]'
  ];

  function findRenderedCards(container = document) {
    const selector = CARD_SELECTORS.join(', ');
    return Array.from(container.querySelectorAll(selector));
  }

  function getActiveCategoryName() {
    const selectedBtn = document.querySelector('.desktop_selected__2iKEU');
    if (selectedBtn) {
      return selectedBtn.textContent.trim();
    }
    const heading = document.querySelector('.Filter04_category__S_DXu, #headingCategory h1');
    if (heading) {
      return heading.textContent.trim();
    }
    return 'Popular Plans';
  }

  function getCardPrice(cardElement) {
    if (!cardElement) return null;
    const planTextElem = cardElement.querySelector('.PlanName_planText__3mOKr, [class*="PlanName_planText"]');
    if (planTextElem) {
      const digits = planTextElem.textContent.replace(/[^\d]/g, '');
      if (digits) return parseInt(digits, 10);
    }
    const match = cardElement.textContent.match(/₹\s*([0-9,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }
    return null;
  }

  function declutterOriginalCards(root = document) {
    if (!root) return;

    // 1. Hide ONLY the top promotional marketing tag/banner elements (e.g., Canva, Gemini banners)
    // NEVER target card containers like .Details_detailsCont or .Details_tagDataCont!
    const promoTagSelectors = [
      '.Details_planListTagStyle__VojM4',
      '[class*="Details_planListTagStyle__"]',
      '[class*="Tag_animationCont"]',
      '[class*="Tag_customModalTagData"]',
      '[class*="Tag_customTagcss"]',
      'div[class*="ImageBadge"]'
    ];
    const promoElements = root.querySelectorAll(promoTagSelectors.join(', '));
    promoElements.forEach(el => {
      // Safety guard: NEVER hide the plan card or any of its main structural wrappers!
      if (
        el.classList.contains('Details_detailsCont__2FffM') ||
        el.classList.contains('Details_planCard__nJXQV') ||
        el.classList.contains('Details_planCardBody__T_1ab') ||
        el.classList.contains('Details_bodywrap__2dZcm') ||
        el.classList.contains('Details_bodyCont__aDv-j') ||
        el.classList.contains('Details_bodyContAuto__3zhbd') ||
        el.classList.contains('Details_bodyhead__3zU8V')
      ) {
        return;
      }
      const tagHeader = el.closest('[class*="Details_planListTagStyle"], [class*="Tag_animationCont"]') || el;
      if (
        tagHeader &&
        !tagHeader.classList.contains('Details_detailsCont__2FffM') &&
        !tagHeader.classList.contains('Details_planCard__nJXQV') &&
        !tagHeader.classList.contains('Details_planCardBody__T_1ab') &&
        !tagHeader.classList.contains('Details_bodywrap__2dZcm')
      ) {
        tagHeader.style.setProperty('display', 'none', 'important');
      }
    });

    // 2. Hide ALL third-party OTT subscription clutter on native cards ("+2 more OTT", icons)
    const subSelectors = [
      '[class*="Details_subscriptionStyle"]',
      '[class*="Subscriptions_subscription"]',
      '[class*="Subscriptions_mainCont"]',
      '[class*="Subscriptions_imagesCont"]',
      '[class*="Subscriptions_imgs"]',
      '.Details_subscriptionCon__l5NXn'
    ];
    const subs = root.querySelectorAll(subSelectors.join(', '));
    subs.forEach(s => {
      s.style.setProperty('display', 'none', 'important');
    });

    // 3. Hide any leaf text nodes specifically showing "+... more OTT"
    const textLeaves = root.querySelectorAll('.Details_planCardBody__T_1ab span, .Details_planCardBody__T_1ab p, .Details_planCardBody__T_1ab div');
    textLeaves.forEach(el => {
      if (el.children.length === 0 && /\+\d+\s*more\s*OTT/i.test(el.textContent.trim())) {
        const subItem = el.closest('[class*="Subscriptions_"], [class*="Details_subscriptionStyle"]') || el;
        if (!subItem.classList.contains('Details_planCardBody__T_1ab') &&
          !subItem.classList.contains('Details_bodyCont__aDv-j') &&
          !subItem.classList.contains('Details_bodyContAuto__3zhbd')) {
          subItem.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // 4. Hide promo badge images
    const badgeImages = root.querySelectorAll('img[class*="ImageBadge"], [class*="ImageBadge"] img, img[alt*="gemini" i], img[alt*="canva" i], img[alt*="kuku" i], img[alt*="fancode" i]');
    badgeImages.forEach(img => {
      const container = img.closest('[class*="ImageBadge"], [class*="Details_planListTagStyle"], [class*="Subscriptions_"], [class*="Details_subscriptionStyle"]') || img;
      if (!container.classList.contains('Details_detailsCont__2FffM') &&
        !container.classList.contains('Details_planCard__nJXQV') &&
        !container.classList.contains('Details_planCardBody__T_1ab')) {
        container.style.setProperty('display', 'none', 'important');
      }
    });

    // 5. Enforce visibility on card wrappers (unhide in case they were previously hidden)
    const cardContainers = root.querySelectorAll('.Details_detailsCont__2FffM, [class*="Details_detailsCont"], .Details_planCard__nJXQV, .Details_planCardBody__T_1ab, .Details_bodywrap__2dZcm, .Details_bodyCont__aDv-j, .Details_bodyContAuto__3zhbd');
    cardContainers.forEach(card => {
      if (card.style.display === 'none') {
        card.style.removeProperty('display');
      }
    });

    // 6. Eradicate ALL gradient animations, promotional gradient overlays, and theme backgrounds
    const gradientAnims = root.querySelectorAll('.gradientColorAnim, [class*="gradientColorAnim"]');
    gradientAnims.forEach(el => el.remove());

    // Outer wrappers must remain completely transparent with NO square outlines or nested frames
    const outerWrappers = root.querySelectorAll(
      '.Details_detailsCont__2FffM, [class*="Details_detailsCont"], .Details_planCard__nJXQV, [class*="Details_planCard"], .Details_bodywrap__2dZcm, [class*="Details_bodywrap"]'
    );
    outerWrappers.forEach(w => {
      w.classList.remove('Details_goldTheme__1MrGj', 'Details_blueTheme__d8OH9', 'Details_gradientColorAfter__2rJoO');
      w.style.setProperty('background', 'transparent', 'important');
      w.style.setProperty('background-color', 'transparent', 'important');
      w.style.setProperty('background-image', 'none', 'important');
      w.style.setProperty('border', 'none', 'important');
      w.style.setProperty('box-shadow', 'none', 'important');
      w.style.setProperty('outline', 'none', 'important');
    });

    // The single rounded card body gets var(--color-primary-20) #e7ebf8
    const cardBodies = root.querySelectorAll('.Details_planCardBody__T_1ab, [class*="Details_planCardBody"]');
    cardBodies.forEach(body => {
      body.classList.remove('Details_goldTheme__1MrGj', 'Details_blueTheme__d8OH9', 'Details_gradientColorAfter__2rJoO');
      body.style.setProperty('background', '#e7ebf8', 'important');
      body.style.setProperty('background-color', '#e7ebf8', 'important');
      body.style.setProperty('background-image', 'none', 'important');
      body.style.setProperty('border', '1px solid #dce5f8', 'important');
      body.style.setProperty('border-radius', '1rem', 'important');
      body.style.setProperty('box-shadow', 'none', 'important');
      body.style.setProperty('outline', 'none', 'important');
    });

    // 7. Uniform primary blue Buy button (var(--color-primary-50) #0f3cc9)
    const buyBtns = root.querySelectorAll('.Details_detailsCont__2FffM .primary.j-button, .Details_btnCont__2WMwu button, .Details_planCard__nJXQV .primary.j-button');
    buyBtns.forEach(btn => {
      btn.style.setProperty('background-color', '#0f3cc9', 'important');
      btn.style.setProperty('color', '#ffffff', 'important');
      btn.style.setProperty('border-radius', '24px', 'important');
      btn.style.setProperty('border', '0', 'important');
    });

    // 8. Uniform primary blue Chevron
    const chevrons = root.querySelectorAll('.Details_moreBtnIcon__1ljMD, .Details_moreBtnIcon__1ljMD svg, .Details_moreBtnIcon__1ljMD .j-icon');
    chevrons.forEach(chev => {
      chev.style.setProperty('color', '#0f3cc9', 'important');
      chev.style.setProperty('fill', '#0f3cc9', 'important');
    });
  }

  function generateCompactInsight(plan) {
    if (!plan) return '';

    // 1. Long validity annual plans (>= 300 days)
    if (plan.validityDays >= 300) {
      return 'Best value for long-term usage with consistent data benefits.';
    }

    // 2. High daily data (2.5GB/day or more) + Unlimited 5G
    if (plan.isUnlimited5G && plan.dailyDataGB >= 2.5 && plan.validityDays < 70) {
      return 'Good balance of data and validity for everyday usage.';
    }

    // 3. Extended validity quarterly plans (70 to 90 days)
    if (plan.dailyDataGB > 0 && plan.validityDays >= 70 && plan.validityDays < 300) {
      return 'Quarterly plan offering predictable daily data and extended validity.';
    }

    // 4. Balanced everyday plans (24 to 69 days with daily quota)
    if (plan.dailyDataGB > 0 && plan.validityDays >= 24) {
      return 'Good balance of data and validity for everyday usage.';
    }

    // 4. Data add-on packs
    if (plan.isDataAddon || (plan.categories && plan.categories.includes('Data Packs')) || (!plan.dailyDataGB && plan.totalDataGB > 0)) {
      if (plan.isBasePlanDependent || !plan.validityDays) {
        return 'Data add-on requiring an active base recharge to function.';
      }
      return `Provides ${plan.totalDataGB} GB total data for supplementing your usage.`;
    }

    // 5. Pure top-up / monetary balance
    if ((plan.categories && plan.categories.includes('Top-up Voucher')) || (!plan.dailyDataGB && !plan.totalDataGB && (!plan.validityDays || plan.validityDays >= 365))) {
      return 'Suitable for long-term use with flexible benefits.';
    }

    // 6. Low-cost SIM validity maintenance
    if (plan.validityDays >= 24 && plan.dailyDataGB === 0 && plan.totalDataGB <= 3) {
      return 'Cost-effective plan for maintaining active SIM validity.';
    }

    // 7. Bundled digital entertainment / OTT
    if (plan.subscriptions && plan.subscriptions.length > 2) {
      return 'Bundles digital streaming entertainment with active connectivity.';
    }

    // 8. General plan with validity
    if (plan.validityDays) {
      return `Provides ${plan.validityDays} days connectivity with standard calling allowances.`;
    }

    return '';
  }

  function injectNativeCompactInfo(cardElement, plan) {
    if (!cardElement) return;

    const cardBody = cardElement.querySelector('.Details_planCardBody__T_1ab, [class*="Details_planCardBody"]') || cardElement;

    // Check if already injected
    let addon = cardBody.querySelector('.jio-native-card-addon');
    if (!addon) {
      addon = document.createElement('div');
      addon.className = 'jio-native-card-addon';

      // Insert right above the Buy button container
      const buyCont = cardBody.querySelector('.Details_btnCont__2WMwu, button.j-button') || null;
      if (buyCont && buyCont.parentNode) {
        buyCont.insertAdjacentElement('beforebegin', addon);
      } else {
        cardBody.appendChild(addon);
      }
    }

    // 1. Calculate effective daily cost (compact format without verbose 'Effective daily cost' label)
    let dailyCostText = '—';
    if (plan && plan.validityDays && plan.validityDays > 0 && plan.price && plan.price > 0 && !plan.isBasePlanDependent) {
      const dailyCost = plan.price / plan.validityDays;
      dailyCostText = `₹${dailyCost.toFixed(2)}/day`;
    }

    // 2. Value Score and Transparency Score displays
    const valueDisplay = (plan && plan.valueScore !== null && plan.valueScore !== undefined)
      ? String(plan.valueScore)
      : '—';
    const transparencyDisplay = (plan && plan.transparencyScore !== null && plan.transparencyScore !== undefined)
      ? String(plan.transparencyScore)
      : '—';

    // 3. Short Insight (clean unboxed typography, clamped to 1-2 lines)
    const insightText = generateCompactInsight(plan);

    addon.innerHTML = `
      <hr class="jio-native-divider" />
      <div class="jio-card-cost-row">
        <span class="jio-card-daily-cost">${escapeHtml(dailyCostText)}</span>
      </div>
      <div class="jio-card-badges-row">
        <span class="jio-native-pill jio-native-pill-value">VALUE ${escapeHtml(valueDisplay)}</span>
        <span class="jio-native-pill jio-native-pill-transparency">TRANSPARENCY ${escapeHtml(transparencyDisplay)}</span>
      </div>
      <div class="jio-native-insight-text" title="Click to view details and evidence disclosures">
        ${escapeHtml(insightText)}
      </div>
    `;

    // Connect insight click to evidence modal
    const insightElem = addon.querySelector('.jio-native-insight-text');
    if (insightElem && plan) {
      insightElem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window !== 'undefined' && window.JioEvidenceModal) {
          window.JioEvidenceModal.show(plan);
        }
      });
    }
  }

  function enhanceCard(cardElement, catalogueInstance) {
    if (!cardElement) return null;

    // Always declutter card and its parent wrapper first
    const cardWrapper = cardElement.closest('.Details_detailsCont__2FffM, [class*="Details_detailsCont"]') || cardElement.parentElement || cardElement;
    declutterOriginalCards(cardWrapper);

    // Re-enhance if not yet enhanced or if previous enhancement was incomplete (placeholder score)
    const isAlreadyEnhanced = cardElement.hasAttribute('data-jio-enhanced');
    if (isAlreadyEnhanced) {
      const valPill = cardElement.querySelector('.jio-native-pill-value');
      if (valPill && !valPill.textContent.includes('—')) {
        return null;
      }
    }
    cardElement.setAttribute('data-jio-enhanced', 'true');

    // 1. Identify price from card
    const price = getCardPrice(cardElement);
    if (!price) return null;

    // 2. Identify corresponding plan from catalogue
    let matchedPlan = null;
    const activeCategory = getActiveCategoryName();

    if (catalogueInstance) {
      const candidates = catalogueInstance.getAllPlans().filter(p => p.price === price);
      if (candidates.length === 1) {
        matchedPlan = candidates[0];
      } else if (candidates.length > 1) {
        // Match by validity or active category
        const cardText = cardElement.textContent || '';
        matchedPlan = candidates.find(c => c.validityDays && cardText.includes(String(c.validityDays))) ||
          candidates.find(c => c.categories && c.categories.includes(activeCategory)) ||
          candidates[0];
      }
    }

    if (!matchedPlan) {
      matchedPlan = normalizeFromDomCard(cardElement, activeCategory);
      if (matchedPlan) {
        scorePlan(matchedPlan);
        if (catalogueInstance) catalogueInstance.addPlan(matchedPlan, activeCategory);
      }
    }

    // Inject compact value information & insight panel onto original category cards (matching Image 2)
    injectNativeCompactInfo(cardElement, matchedPlan);

    return matchedPlan;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    CARD_SELECTORS,
    findRenderedCards,
    getActiveCategoryName,
    getCardPrice,
    declutterOriginalCards,
    enhanceCard,
    injectNativeCompactInfo,
    generateCompactInsight
  };
});
