/**
 * Best for My Needs View
 * Renders the personalized preferences UI and instant recommendations.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { filterAndRankByNeeds } = require('../recommendations/bestForNeeds');
    const { renderPlanCard } = require('./cardRenderer');
    module.exports = factory(filterAndRankByNeeds, renderPlanCard);
  } else {
    root.JioBestForNeedsView = factory(
      root.JioBestForNeeds.filterAndRankByNeeds,
      root.JioCardRenderer.renderPlanCard
    );
  }
})(typeof self !== 'undefined' ? self : this, function (filterAndRankByNeeds, renderPlanCard) {
  'use strict';

  const PRIMARY_STORAGE_KEY = 'jio_unfiltered_user_prefs';
  const LEGACY_STORAGE_KEY = 'jio_intelligence_user_prefs';

  function loadStoredPreferences() {
    try {
      const stored = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : getDefaultPreferences();
    } catch (e) {
      return getDefaultPreferences();
    }
  }

  function saveStoredPreferences(prefs) {
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function getDefaultPreferences() {
    return {
      primaryUseCase: 'everyday',
      maxBudget: null,
      preferredValidity: 'any',
      minDailyDataGB: null,
      need5G: false,
      interestInOTT: false,
      preferLowerUpfront: false
    };
  }

  function renderView(catalogueInstance, onSelectOriginalCategory = null) {
    const container = document.createElement('div');
    container.className = 'jio-needs-view-container';

    let currentPrefs = loadStoredPreferences();

    container.innerHTML = `
      <div class="Filter04_headingCategory__1ceRj jio-view-header-row">
        <h1 class="Filter04_category__S_DXu j-text j-text-heading-xs jio-clean-heading" style="font-size: 1.5rem !important; font-weight: 900 !important; letter-spacing: -0.72px !important; line-height: 1.1666666667 !important;">Best for My Needs</h1>
      </div>

      <!-- Preferences Controls Form -->
      <div class="jio-preferences-card">
        <div class="jio-prefs-row">
          <label class="jio-pref-label" for="jio-pref-usecase">
            Primary Use Case
            <span class="jio-pref-hint">What is this Jio connection primarily used for?</span>
          </label>
          <select id="jio-pref-usecase" class="jio-select-input">
            <option value="everyday">Everyday Calls & Balanced Data</option>
            <option value="secondary_sim">Secondary SIM (OTPs & Occasional Calls)</option>
            <option value="heavy_data">Heavy Data (Gaming / Hotspot / Streaming)</option>
            <option value="ott_entertainment">OTT & Entertainment Bundles</option>
            <option value="long_validity">Long Validity & Annual Recharges</option>
            <option value="international_travel">International Roaming & Travel</option>
          </select>
        </div>

        <div class="jio-prefs-grid">
          <!-- Budget -->
          <div class="jio-pref-field">
            <label class="jio-field-label" for="jio-pref-budget">Max Budget (₹)</label>
            <input type="number" id="jio-pref-budget" class="jio-text-input" placeholder="e.g. 500" min="50" step="50" value="${currentPrefs.maxBudget || ''}" />
          </div>

          <!-- Validity -->
          <div class="jio-pref-field">
            <label class="jio-field-label" for="jio-pref-validity">Preferred Validity</label>
            <select id="jio-pref-validity" class="jio-select-input">
              <option value="any">Any Validity</option>
              <option value="28">1 Month (~28-30 Days)</option>
              <option value="84">3 Months (~84-90 Days)</option>
              <option value="365">1 Year (365 Days)</option>
            </select>
          </div>

          <!-- Dynamic: Daily Data Requirement -->
          <div class="jio-pref-field" id="jio-data-field-wrapper">
            <label class="jio-field-label" for="jio-pref-data">Minimum High-Speed Data</label>
            <select id="jio-pref-data" class="jio-select-input">
              <option value="0">Any / No Minimum</option>
              <option value="1.5">1.5 GB / Day</option>
              <option value="2.0">2.0 GB / Day</option>
              <option value="2.5">2.5 GB / Day or more</option>
            </select>
          </div>
        </div>

        <!-- Checkbox Options -->
        <div class="jio-prefs-checkboxes" id="jio-checkboxes-wrapper">
          <label class="jio-checkbox-label" id="jio-5g-wrapper">
            <input type="checkbox" id="jio-pref-5g" ${currentPrefs.need5G ? 'checked' : ''} />
            <span>Require Unlimited 5G (Must be active on ₹349+ plan with 5G coverage)</span>
          </label>
          <label class="jio-checkbox-label" id="jio-ott-wrapper">
            <input type="checkbox" id="jio-pref-ott" ${currentPrefs.interestInOTT ? 'checked' : ''} />
            <span>Interested in bundled OTT subscriptions (Hotstar / Netflix / Prime Lite)</span>
          </label>
        </div>

        <div class="jio-prefs-actions">
          <button type="button" id="jio-apply-prefs-btn" class="jio-btn-primary">Find Best Plan</button>
          <button type="button" id="jio-reset-prefs-btn" class="jio-btn-secondary">Reset</button>
        </div>
      </div>

      <!-- Results Container -->
      <div id="jio-needs-results" class="jio-needs-results-container"></div>
    `;

    // Populate initial values
    const useCaseSelect = container.querySelector('#jio-pref-usecase');
    const validitySelect = container.querySelector('#jio-pref-validity');
    const dataSelect = container.querySelector('#jio-pref-data');
    const budgetInput = container.querySelector('#jio-pref-budget');
    const fiveGCheck = container.querySelector('#jio-pref-5g');
    const ottCheck = container.querySelector('#jio-pref-ott');

    useCaseSelect.value = currentPrefs.primaryUseCase || 'everyday';
    validitySelect.value = currentPrefs.preferredValidity || 'any';
    dataSelect.value = currentPrefs.minDailyDataGB ? String(currentPrefs.minDailyDataGB) : '0';

    // Toggle conditional questions based on selected use case
    function updateFieldVisibility() {
      const selectedCase = useCaseSelect.value;
      const dataWrapper = container.querySelector('#jio-data-field-wrapper');
      const ottWrapper = container.querySelector('#jio-ott-wrapper');
      const fiveGWrapper = container.querySelector('#jio-5g-wrapper');

      if (selectedCase === 'secondary_sim' || selectedCase === 'international_travel') {
        dataWrapper.style.display = 'none';
        ottWrapper.style.display = 'none';
        fiveGWrapper.style.display = 'none';
      } else {
        dataWrapper.style.display = 'block';
        ottWrapper.style.display = 'block';
        fiveGWrapper.style.display = 'block';
      }
    }

    useCaseSelect.addEventListener('change', updateFieldVisibility);
    updateFieldVisibility();

    // Rerun recommendations
    function runRecommendations() {
      const budgetVal = budgetInput.value ? parseFloat(budgetInput.value) : null;
      const dataVal = parseFloat(dataSelect.value) || null;

      currentPrefs = {
        primaryUseCase: useCaseSelect.value,
        maxBudget: budgetVal,
        preferredValidity: validitySelect.value,
        minDailyDataGB: dataVal,
        need5G: fiveGCheck.checked,
        interestInOTT: ottCheck.checked
      };

      saveStoredPreferences(currentPrefs);

      const allPlans = catalogueInstance.getAllPlans();
      const result = filterAndRankByNeeds(allPlans, currentPrefs);
      renderResults(result);
    }

    function renderResults(result) {
      const resultsContainer = container.querySelector('#jio-needs-results');
      resultsContainer.innerHTML = '';

      if (result.unmetReason || !result.winner) {
        resultsContainer.innerHTML = `
          <div class="jio-unmet-constraints-box">
            <div class="jio-unmet-content">
              <h4>No Plan Satisfies All Hard Constraints</h4>
              <p>${escapeHtml(result.unmetReason || 'No eligible plan found matching your exact filter.')}</p>
              <p class="jio-unmet-tip">Tip: Jio plans with Unlimited 5G start at ₹349. Try raising your budget or selecting "Any Validity".</p>
            </div>
          </div>
        `;
        return;
      }

      // Display results using the spacious single-card layout
      const section = document.createElement('div');
      section.className = 'jio-results-section';
      section.innerHTML = `
        <h2 class="j-text-heading-xs j-typography h5 jio-winner-title">Recommended for You</h2>
        <div class="jio-cards-grid" id="jio-needs-grid"></div>
      `;

      const grid = section.querySelector('#jio-needs-grid');

      function wirePills(card, targetPlan) {
        if (!card) return;
        const pills = card.querySelectorAll('.jio-cat-pill');
        pills.forEach(pill => {
          pill.style.cursor = 'pointer';
          pill.title = `Jump to ${pill.textContent} category and view this plan`;
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onSelectOriginalCategory) {
              onSelectOriginalCategory(pill.textContent.trim(), targetPlan);
            }
          });
        });
      }

      // 1. Winner Card
      const winnerCard = renderPlanCard(result.winner, {
        badgeText: 'Best for Your Needs',
        rationale: result.winnerRationale,
        showCategories: true,
        onSelectOriginalCategory
      });
      if (winnerCard) {
        wirePills(winnerCard, result.winner);
        grid.appendChild(winnerCard);
      }

      // 2. Alternative Cards
      if (result.alternatives && result.alternatives.length > 0) {
        result.alternatives.slice(0, 3).forEach((altPlan, idx) => {
          const altCard = renderPlanCard(altPlan, {
            badgeText: `Alternative #${idx + 1}`,
            showCategories: true,
            onSelectOriginalCategory
          });
          if (altCard) {
            wirePills(altCard, altPlan);
            grid.appendChild(altCard);
          }
        });
      }

      resultsContainer.appendChild(section);
    }

    // Bind action buttons
    container.querySelector('#jio-apply-prefs-btn').addEventListener('click', runRecommendations);
    container.querySelector('#jio-reset-prefs-btn').addEventListener('click', () => {
      localStorage.removeItem(PRIMARY_STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      currentPrefs = getDefaultPreferences();
      useCaseSelect.value = currentPrefs.primaryUseCase;
      validitySelect.value = currentPrefs.preferredValidity;
      dataSelect.value = '0';
      budgetInput.value = '';
      fiveGCheck.checked = false;
      ottCheck.checked = false;
      updateFieldVisibility();
      runRecommendations();
    });

    // Run initial calculation
    setTimeout(runRecommendations, 50);

    return container;
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
    renderView
  };
});
