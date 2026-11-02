/**
 * Top Recommendations View
 * Renders the cross-category shortlist interface using the unified 3-column
 * recommendation card layout directly below the native heading container.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const { generateTopRecommendations } = require('../recommendations/topRecommendations');
    const { renderPlanCard } = require('./cardRenderer');
    module.exports = factory(generateTopRecommendations, renderPlanCard);
  } else {
    root.JioTopRecommendationsView = factory(
      root.JioTopRecommendations.generateTopRecommendations,
      root.JioCardRenderer.renderPlanCard
    );
  }
})(typeof self !== 'undefined' ? self : this, function (generateTopRecommendations, renderPlanCard) {
  'use strict';

  function renderView(catalogueInstance, onSelectOriginalCategory = null) {
    const container = document.createElement('div');
    container.className = 'jio-recommendations-container';

    const { shortlist } = generateTopRecommendations(catalogueInstance);

    container.innerHTML = `
      <div class="Filter04_headingCategory__1ceRj jio-view-header-row">
        <h1 class="Filter04_category__S_DXu j-text j-text-heading-xs jio-clean-heading" style="font-size: 1.5rem !important; font-weight: 900 !important; letter-spacing: -0.72px !important; line-height: 1.1666666667 !important;">Top Recommendations</h1>
      </div>
      <div class="jio-cards-grid"></div>
    `;

    const grid = container.querySelector('.jio-cards-grid');

    if (!shortlist || shortlist.length === 0) {
      grid.innerHTML = `
        <div class="jio-empty-state">
          <p>Scanning plan catalogue... If plans do not appear shortly, browse an original category in the sidebar to populate the parser.</p>
        </div>
      `;
      return container;
    }

    shortlist.forEach(item => {
      const card = renderPlanCard(item.plan, {
        badgeText: item.badge,
        rationale: item.rationale,
        onSelectOriginalCategory
      });
      if (card) {
        grid.appendChild(card);
      }
    });

    return container;
  }

  return {
    renderView
  };
});
