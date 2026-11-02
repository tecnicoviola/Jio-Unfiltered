/**
 * Native Card Renderer
 * Generates plan cards following Jio's exact DOM structure, current theme colors (#e7ebf8),
 * and functional recharge CTAs in a 2-column layout with rich plan information.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    let domExtractor = null;
    try {
      domExtractor = require('../extractors/domExtractor');
    } catch (e) {}
    module.exports = factory(domExtractor);
  } else {
    root.JioCardRenderer = factory(root.JioDomExtractor);
  }
})(typeof self !== 'undefined' ? self : this, function (domExtractor) {
  'use strict';

  function renderPlanCard(plan, options = {}) {
    if (!plan) return null;

    const { badgeText = '', rationale = '', showCategories = true, onSelectOriginalCategory = null } = options;
    const card = document.createElement('div');
    card.className = 'jio-card-wrapper';
    card.setAttribute('data-plan-id', plan.id || '');

    // 1. Calculate effective daily and monthly costs
    let dailyCostText = '—';
    let monthlyCostText = '';
    if (plan.validityDays && plan.validityDays > 0 && plan.price && plan.price > 0 && !plan.isBasePlanDependent) {
      const dailyCost = plan.price / plan.validityDays;
      dailyCostText = `₹${dailyCost.toFixed(2)}/day`;
      const monthlyCost = (dailyCost * 30).toFixed(0);
      monthlyCostText = `(₹${monthlyCost}/mo)`;
    }

    // 2. Value and Transparency display
    const valueDisplay = (plan.valueScore !== null && plan.valueScore !== undefined)
      ? String(plan.valueScore)
      : '—';
    const transparencyDisplay = (plan.transparencyScore !== null && plan.transparencyScore !== undefined)
      ? String(plan.transparencyScore)
      : '—';

    // 3. Compact insight text (priority: rationale if concise, otherwise generateCompactInsight)
    let insightText = '';
    if (rationale && !rationale.startsWith('Price:')) {
      insightText = rationale;
    } else if (domExtractor && typeof domExtractor.generateCompactInsight === 'function') {
      insightText = domExtractor.generateCompactInsight(plan);
    }
    if (!insightText && plan.validityDays) {
      insightText = `Standard ${plan.validityDays} days connectivity with calling allowances.`;
    }

    // 4. Validity & Data text
    const validityText = plan.validityText || (plan.validityDays ? `${plan.validityDays} Days` : '—');
    let dataText = '';
    if (plan.isUnlimited5G && plan.dailyDataGB > 0) {
      dataText = `Unlimited 5G + ${plan.dailyDataGB} GB/day`;
    } else if (plan.dailyDataGB > 0) {
      dataText = `${plan.dailyDataGB} GB/day`;
    } else if (plan.totalDataGB > 0) {
      dataText = `${plan.totalDataGB} GB`;
    } else {
      dataText = '—';
    }

    const fiveGSubHtml = (plan.isUnlimited5G && !dataText.includes('Unlimited 5G'))
      ? `<span class="jio-stat-sub">Unlimited 5G</span>`
      : '';

    // 5. Calls & SMS
    const isDataOnly = (plan.voice === 'N/A' || plan.voice === 'NA') ||
      ((plan.categories || []).concat(plan.subcategories || [])).some(c => /addon|data pack|voucher|booster|no voice|feature phone addon/i.test(c)) ||
      (plan.rawNotes && plan.rawNotes.some(n => /does not include voice|no voice/i.test(n)));

    const callsVal = isDataOnly ? 'N/A' : (plan.voice === 'NA' ? 'N/A' : (plan.voice || 'Unlimited'));
    const smsVal = isDataOnly ? 'N/A' : (plan.sms === 'NA' ? 'N/A' : (plan.sms || '100 SMS/Day'));

    // 6. Header Badge
    const badgeHtml = badgeText
      ? `<span class="jio-card-rec-badge">${escapeHtml(badgeText)}</span>`
      : `<span class="jio-card-rec-badge jio-badge-placeholder"></span>`;

    // 7. Subscriptions (Standardized 1-line row with +N more overflow)
    let subscriptionsContent = '<span class="jio-empty-pill">—</span>';
    if (plan.subscriptions && plan.subscriptions.length > 0) {
      const maxVisibleSubs = 2;
      const visibleSubs = plan.subscriptions.slice(0, maxVisibleSubs);
      const remainingSubs = plan.subscriptions.length - maxVisibleSubs;
      const pillsHtml = visibleSubs.map(s => `<span class="jio-sub-pill">${escapeHtml(s.title || s)}</span>`).join('');
      const moreHtml = remainingSubs > 0
        ? `<button type="button" class="jio-sub-pill jio-pill-more" title="${escapeHtml(plan.subscriptions.map(s => s.title || s).join(', '))}">+${remainingSubs} more</button>`
        : '';
      subscriptionsContent = pillsHtml + moreHtml;
    }
    const subscriptionsHtml = `
      <div class="jio-card-meta-row jio-card-subs-row">
        <span class="jio-section-label">Subscriptions</span>
        <div class="jio-pill-cluster">
          ${subscriptionsContent}
        </div>
      </div>
    `;

    // 8. Categories (Show all categories, consistent 2-line layout across all cards)
    let categoriesContent = '<span class="jio-empty-pill">—</span>';
    if (showCategories && plan.categories && plan.categories.length > 0) {
      categoriesContent = plan.categories
        .map(c => `<button type="button" class="jio-cat-pill" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join('');
    }
    const categoriesHtml = `
      <div class="jio-card-meta-row jio-card-avail-row">
        <span class="jio-section-label">Available in</span>
        <div class="jio-pill-cluster jio-avail-cluster">
          ${categoriesContent}
        </div>
      </div>
    `;

    card.innerHTML = `
      <div class="jio-rec-card-body">
        <!-- Top: Badge on Left, Scores & Chevron on Right -->
        <div class="jio-card-top-row">
          <div class="jio-card-badge-col">
            ${badgeHtml}
          </div>
          <div class="jio-card-scores-col">
            <span class="jio-native-pill jio-native-pill-value">VALUE ${escapeHtml(valueDisplay)}</span>
            <span class="jio-native-pill jio-native-pill-transparency">TRANSPARENCY ${escapeHtml(transparencyDisplay)}</span>
            <button type="button" class="jio-card-chevron-btn" title="View condition details and evidence" aria-label="Open plan details">
              <svg viewBox="0 0 24 24" fill="none" class="jio-card-chevron-svg">
                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Price Section -->
        <div class="jio-card-price-row">
          <div class="jio-price-left">
            <span class="jio-card-price">₹${plan.price}</span>
            <div class="jio-card-rates-group">
              <span class="jio-card-daily-cost">${escapeHtml(dailyCostText)}</span>
              ${monthlyCostText ? `<span class="jio-card-monthly-cost">${escapeHtml(monthlyCostText)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Subtle Divider -->
        <hr class="jio-card-divider" />

        <!-- 4-Column Specs Grid -->
        <div class="jio-card-specs-grid">
          <div class="jio-spec-col">
            <span class="jio-stat-label">Validity</span>
            <span class="jio-stat-val">${escapeHtml(validityText)}</span>
          </div>
          <div class="jio-spec-col">
            <span class="jio-stat-label">Data</span>
            <span class="jio-stat-val">${escapeHtml(dataText)}</span>
            ${fiveGSubHtml}
          </div>
          <div class="jio-spec-col">
            <span class="jio-stat-label">Calls</span>
            <span class="jio-stat-val">${escapeHtml(callsVal)}</span>
          </div>
          <div class="jio-spec-col">
            <span class="jio-stat-label">SMS</span>
            <span class="jio-stat-val">${escapeHtml(smsVal)}</span>
          </div>
        </div>

        <!-- Subscriptions -->
        ${subscriptionsHtml}

        <!-- Insight / Rationale Box -->
        <div class="jio-card-rationale-box" title="Click to view details and evidence disclosures">
          <span class="jio-card-insight-text">${escapeHtml(insightText)}</span>
        </div>

        <!-- Available in Categories -->
        ${categoriesHtml}

        <!-- Bottom Action Buttons -->
        <div class="jio-card-actions-row">
          <button type="button" class="jio-card-buy-btn" data-plan-price="${plan.price}" data-plan-id="${plan.id || ''}">
            Buy
          </button>
          <button type="button" class="jio-card-btn-evidence" title="View condition details and evidence disclosures">
            Learn more
          </button>
        </div>
      </div>
    `;

    // Event Wireup
    const chevronTrigger = card.querySelector('.jio-card-chevron-btn');
    const evidenceTrigger = card.querySelector('.jio-card-btn-evidence');
    const insightTrigger = card.querySelector('.jio-card-rationale-box');
    const openModal = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window !== 'undefined' && window.JioEvidenceModal) {
        window.JioEvidenceModal.show(plan);
      }
    };

    if (chevronTrigger) chevronTrigger.addEventListener('click', openModal);
    if (evidenceTrigger) evidenceTrigger.addEventListener('click', openModal);
    if (insightTrigger) insightTrigger.addEventListener('click', openModal);

    const subMoreBtn = card.querySelector('.jio-pill-more');
    if (subMoreBtn) subMoreBtn.addEventListener('click', openModal);

    // Category redirection wireup
    const catPills = card.querySelectorAll('.jio-cat-pill');
    catPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pill.classList.contains('jio-cat-more')) {
          openModal(e);
          return;
        }
        const catName = pill.getAttribute('data-category');
        if (typeof onSelectOriginalCategory === 'function') {
          onSelectOriginalCategory(catName, plan);
        } else if (typeof window !== 'undefined' && window.JioIntelligence && window.JioIntelligence.jumpToNativeCategory) {
          window.JioIntelligence.jumpToNativeCategory(catName, plan);
        }
      });
    });

    // Recharge action: trigger Jio's native checkout flow
    const buyBtn = card.querySelector('.jio-card-buy-btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const existingNativeBtn = document.querySelector(`.Details_planCard__nJXQV [data-plan-price="${plan.price}"] button, [data-jio-enhanced="true"] button`);
        if (existingNativeBtn && existingNativeBtn.click) {
          existingNativeBtn.click();
        } else {
          window.location.href = `https://www.jio.com/selfcare/recharge/mobility/`;
        }
      });
    }

    return card;
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
    renderPlanCard
  };
});
