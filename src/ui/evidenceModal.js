/**
 * Evidence and Condition Inspection Modal
 * Renders an accessible, native-styled dialog to examine factual claims,
 * regulatory sources, renewal assumptions, and offer conditions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { getEvidenceForPlan } = require('../evidence/evidenceStore');
    module.exports = factory(getEvidenceForPlan);
  } else {
    root.JioEvidenceModal = factory(root.JioEvidenceStore.getEvidenceForPlan);
  }
})(typeof self !== 'undefined' ? self : this, function (getEvidenceForPlan) {
  'use strict';

  let activeModal = null;

  function createModalElement(plan, customEvidenceList = null) {
    const evidenceList = customEvidenceList !== null ? customEvidenceList : getEvidenceForPlan(plan);
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'jio-modal-overlay';
    modalOverlay.setAttribute('role', 'dialog');
    modalOverlay.setAttribute('aria-modal', 'true');
    modalOverlay.setAttribute('aria-labelledby', 'jio-evidence-title');

    const starsHtml = (plan.rawStar && plan.rawStar.length > 0)
      ? `<div class="jio-modal-section">
          <h4>Official Condition Details (Asterisk Terms)</h4>
          <ul class="jio-modal-list">
            ${plan.rawStar.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>`
      : '';

    const promoHtml = (plan.promotions && plan.promotions.length > 0)
      ? `<div class="jio-modal-section">
          <h4>Promotional Offer Conditions</h4>
          <ul class="jio-modal-list">
            ${plan.promotions.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>`
      : '';

    const evidenceHtml = (evidenceList && evidenceList.length > 0)
      ? `<div class="jio-modal-section">
          <h4>Authoritative Sources & Regulatory Backing</h4>
          <div class="jio-evidence-cards">
            ${evidenceList.map(ev => {
              const linkHtml = (ev.url && typeof ev.url === 'string' && ev.url.startsWith('https://'))
                ? `<a href="${escapeHtml(ev.url)}" target="_blank" rel="noopener noreferrer" class="jio-evidence-link" title="${escapeHtml(ev.sourceTitle || ev.publisher)}">Official Reference &rarr;</a>`
                : `<span class="jio-evidence-unverified-tag">Source Citation Unavailable</span>`;

              const sourceTitleHtml = ev.sourceTitle
                ? `<div class="jio-evidence-source"><span class="jio-evidence-source-label">Source Document:</span> <span class="jio-evidence-source-val">${escapeHtml(ev.sourceTitle)}</span></div>`
                : '';

              const excerptHtml = ev.excerpt
                ? `<blockquote class="jio-evidence-excerpt">&ldquo;${escapeHtml(ev.excerpt)}&rdquo;</blockquote>`
                : '';

              return `
                <div class="jio-evidence-card">
                  <div class="jio-evidence-header">
                    <span class="jio-evidence-badge ${ev.class ? ev.class.toLowerCase() : 'unverified'}">${formatEvidenceClass(ev.class)}</span>
                    <span class="jio-evidence-publisher">${escapeHtml(ev.publisher || 'Unknown Publisher')}</span>
                  </div>
                  <h5 class="jio-evidence-item-title">${escapeHtml(ev.title)}</h5>
                  ${sourceTitleHtml}
                  <p class="jio-evidence-summary">${escapeHtml(ev.summary)}</p>
                  ${excerptHtml}
                  <div class="jio-evidence-footer">
                    <span class="jio-evidence-date">Verified on: ${escapeHtml(ev.dateChecked || '2026-10-28')}</span>
                    ${linkHtml}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>`
      : '<p class="jio-modal-empty">No external regulatory conditions recorded for this standard tariff.</p>';

    const dailyCostVal = (plan.effectiveDailyCost != null) ? plan.effectiveDailyCost
      : (plan.dailyCost != null) ? plan.dailyCost
      : (plan.price && plan.validityDays && plan.validityDays > 0) ? Number((plan.price / plan.validityDays).toFixed(2))
      : null;

    const monthlyCostVal = (plan.effective30DayCost != null) ? plan.effective30DayCost
      : (plan.standardMonthlyCost != null) ? plan.standardMonthlyCost
      : (dailyCostVal != null) ? Number((dailyCostVal * 30).toFixed(2))
      : null;

    const annualCostVal = (plan.effectiveAnnualCost != null) ? plan.effectiveAnnualCost
      : (dailyCostVal != null) ? Number((dailyCostVal * 365).toFixed(2))
      : null;

    modalOverlay.innerHTML = `
      <div class="jio-modal-dialog">
        <div class="jio-modal-header">
          <div class="jio-modal-header-text">
            <h3 id="jio-evidence-title">Plan Transparency & Evidence: ₹${plan.price} (${plan.validityText || (plan.validityDays ? plan.validityDays + ' Days' : '')})</h3>
            <p class="jio-modal-subtitle">Comprehensive regulatory audits, promotional conditions, and authoritative citations.</p>
          </div>
          <button type="button" class="jio-modal-close" aria-label="Close dialog" title="Close dialog">&times;</button>
        </div>

        <div class="jio-modal-content">
          <!-- Baseline Normalization Summary -->
          <div class="jio-modal-section">
            <h4>Billing & Normalized Rate Baseline</h4>
            <div class="jio-norm-grid">
              <div class="jio-norm-item">
                <span class="jio-norm-label">Daily Equivalent Cost</span>
                <span class="jio-norm-val">${dailyCostVal ? '₹' + dailyCostVal + '/day' : '—'}</span>
              </div>
              <div class="jio-norm-item">
                <span class="jio-norm-label">Standard 30-Day Cost</span>
                <span class="jio-norm-val">${monthlyCostVal ? '₹' + monthlyCostVal + '/mo' : '—'}</span>
              </div>
              <div class="jio-norm-item">
                <span class="jio-norm-label">Estimated Annual Cost</span>
                <span class="jio-norm-val">${annualCostVal ? '₹' + annualCostVal : '—'}</span>
              </div>
            </div>
            <p class="jio-norm-note">
              *Annual estimate assumes continuous consecutive renewals without rate hikes. 28-day vouchers require ~13 renewal cycles per year.
            </p>
          </div>
          ${starsHtml}
          ${promoHtml}
          ${evidenceHtml}
        </div>
      </div>
    `;

    return modalOverlay;
  }

  function show(plan) {
    close();

    const modalOverlay = createModalElement(plan);

    // Event handlers
    const closeBtn = modalOverlay.querySelector('.jio-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) close();
    });

    const extLinks = modalOverlay.querySelectorAll('.jio-evidence-link');
    extLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', keyHandler);
    modalOverlay._cleanupKey = () => document.removeEventListener('keydown', keyHandler);

    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(modalOverlay);
    }
    activeModal = modalOverlay;
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  }

  function close() {
    if (activeModal) {
      if (activeModal._cleanupKey) activeModal._cleanupKey();
      if (activeModal.parentNode) activeModal.parentNode.removeChild(activeModal);
      activeModal = null;
    }
  }

  function formatEvidenceClass(cls) {
    switch (cls) {
      case 'OFFICIALLY_VERIFIED': return 'Officially Verified';
      case 'REGULATORY_SOURCE': return 'TRAI / Regulatory';
      case 'COMMUNITY_REPORTED': return 'Community Reported';
      case 'CONFLICTING_EVIDENCE':
      case 'CONFLICTING': return 'Conflicting Evidence';
      case 'UNVERIFIED':
      default: return 'Unverified';
    }
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
    show,
    close,
    createModalElement,
    formatEvidenceClass
  };
});
