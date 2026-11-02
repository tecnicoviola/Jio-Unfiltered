/**
 * Jio Unfiltered — Content Script
 * Lifecycle manager, strictly scoped to https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/
 */

(function () {
  'use strict';

  // 1. STRICT SCOPE CHECK
  function isTargetPage() {
    try {
      const loc = window.location;
      if (loc.origin !== 'https://www.jio.com') return false;
      const cleanPath = loc.pathname.replace(/\/+$/, '');
      return cleanPath === '/selfcare/plans/mobility/prepaid-plans-list';
    } catch (e) {
      return false;
    }
  }

  if (!isTargetPage()) {
    return;
  }

  console.log('[Jio Unfiltered] Active on target page.');

  // Global catalogue instance
  const catalogue = new (window.JioDeduplicator.PlanCatalogue)();
  let mutationObserver = null;
  let extensionViewContainer = null;
  let enhanceDebounceTimer = null;

  function seedBaselinePlans() {
    if (window.JioBaselinePlans && Array.isArray(window.JioBaselinePlans)) {
      for (const item of window.JioBaselinePlans) {
        if (item && item.plan) {
          const plan = new (window.JioPlanModel.NormalizedPlan)(item.plan);
          catalogue.addPlan(plan, item.catName || '', item.subName || '');
        }
      }
      console.log(`[Jio Unfiltered] Seeded ${catalogue.getAllPlans().length} baseline plans immediately.`);
    }
  }

  // Initialize
  async function init() {
    // 0. Seed instantly from verified baseline dataset for zero-delay card enhancement
    seedBaselinePlans();

    // 1. Setup Sidebar Injection
    setupSidebar();

    // 2. Scan & Enhance any already rendered cards immediately
    enhanceAllRenderedCards();

    // 3. Fetch full catalogue in background via same-origin API
    if (window.JioApiExtractor && window.JioApiExtractor.fetchFullCatalogue) {
      window.JioApiExtractor.fetchFullCatalogue(catalogue).then(success => {
        if (success) {
          console.log(`[Jio Unfiltered] Loaded ${catalogue.getAllPlans().length} plans across ${catalogue.categoriesInspected.size} categories.`);
          refreshActiveView();
          enhanceAllRenderedCards();
        }
      });
    }

    // 4. Start targeted MutationObserver
    observeDOMChanges();

    // 5. URL navigation watcher (clean up if user navigates away via pushState)
    watchUrlChanges();
  }

  function setupSidebar() {
    window.JioSidebar.injectNavigationEntries(onNavigationTabSelect);
  }

  function onNavigationTabSelect(tabKey, nativeCategoryName = null) {
    const paddingContainer = document.querySelector('.Filter04_padding__1fe3M') ||
      document.querySelector('#sectionContainer > div') ||
      document.querySelector('#sectionContainer');

    if (!tabKey) {
      // User selected native category -> clean up extension active state
      document.body.classList.remove('jio-extension-tab-active');

      if (extensionViewContainer && extensionViewContainer.parentNode) {
        extensionViewContainer.parentNode.removeChild(extensionViewContainer);
        extensionViewContainer = null;
      }

      // Restore ALL native elements unconditionally
      if (paddingContainer) {
        Array.from(paddingContainer.children).forEach(child => {
          if (child.id !== 'jio-intelligence-view-container') {
            child.style.removeProperty('display');
          }
        });
      }
      const nativeContainers = document.querySelectorAll(
        '.Filter04_planContainer__2Dhku, #planContainer, .Details_detailsCont__2FffM, .Details_planCard__nJXQV, .Details_planCardBody__T_1ab, #headingCategory, .Filter04_headingCategory__1ceRj, .Filter04_filterTagBtns__3mOg0, .Filter04_mobscroll__TIhiB, .Filter04_planSelectBoxCon__2RGyn, .Filter04_overflowxCont__2O_fL'
      );
      nativeContainers.forEach(el => {
        el.style.removeProperty('display');
      });

      // Ensure the active native category button has desktop_selected__2iKEU
      const categoryToHighlight = nativeCategoryName || 'Popular Plans';
      const allButtons = document.querySelectorAll('.desktop_btnCss__1HAJ3:not(.jio-extension-nav-item)');
      let foundSelected = false;
      allButtons.forEach(btn => {
        if (btn.classList.contains('desktop_selected__2iKEU')) {
          foundSelected = true;
        }
      });
      if (!foundSelected) {
        for (const btn of allButtons) {
          if (btn.textContent.trim().toLowerCase() === categoryToHighlight.toLowerCase()) {
            btn.classList.add('desktop_selected__2iKEU');
            break;
          }
        }
      }

      setTimeout(enhanceAllRenderedCards, 100);
      return;
    }

    // Extension tab selected -> add class to body
    document.body.classList.add('jio-extension-tab-active');

    // Hide ALL native children in paddingContainer
    if (paddingContainer) {
      Array.from(paddingContainer.children).forEach(child => {
        if (child.id !== 'jio-intelligence-view-container') {
          child.style.setProperty('display', 'none', 'important');
        }
      });
    }

    const nativeContainers = document.querySelectorAll(
      '.Filter04_planContainer__2Dhku, #planContainer, #headingCategory, .Filter04_headingCategory__1ceRj, .Filter04_filterTagBtns__3mOg0, .Filter04_mobscroll__TIhiB, .Filter04_planSelectBoxCon__2RGyn, .Filter04_overflowxCont__2O_fL'
    );
    nativeContainers.forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });

    // Mount extensionViewContainer as first child of paddingContainer
    if (!extensionViewContainer || !extensionViewContainer.parentNode) {
      extensionViewContainer = document.createElement('div');
      extensionViewContainer.id = 'jio-intelligence-view-container';
      if (paddingContainer) {
        paddingContainer.insertBefore(extensionViewContainer, paddingContainer.firstChild);
      }
    } else if (paddingContainer && extensionViewContainer.previousElementSibling) {
      paddingContainer.insertBefore(extensionViewContainer, paddingContainer.firstChild);
    }

    extensionViewContainer.innerHTML = '';

    if (tabKey === 'top_recommendations') {
      const view = window.JioTopRecommendationsView.renderView(catalogue, jumpToNativeCategory);
      extensionViewContainer.appendChild(view);
    } else if (tabKey === 'best_for_needs') {
      const view = window.JioBestForNeedsView.renderView(catalogue, jumpToNativeCategory);
      extensionViewContainer.appendChild(view);
    }

    // DO NOT SCROLL - keep user viewport stationary as requested
  }


  function refreshActiveView() {
    const currentTab = window.JioSidebar.getCurrentTab();
    if (currentTab) {
      onNavigationTabSelect(currentTab);
    }
  }

  function jumpToNativeCategory(categoryName, planTarget = null) {
    if (!categoryName) return;

    // 1. Locate the native category button in the desktop sidebar with fuzzy match
    const allButtons = document.querySelectorAll('.desktop_btnCss__1HAJ3:not(.jio-extension-nav-item)');
    let targetBtn = null;
    const searchCat = categoryName.trim().toLowerCase();
    for (const btn of allButtons) {
      const btnText = btn.textContent.trim().toLowerCase();
      if (btnText === searchCat || btnText.includes(searchCat) || searchCat.includes(btnText)) {
        targetBtn = btn;
        break;
      }
    }

    // 2. Clear extension active state & update sidebar highlighting
    if (window.JioSidebar) {
      window.JioSidebar.clearExtensionActiveState();
    }
    const allSidebarBtns = document.querySelectorAll('.desktop_btnCss__1HAJ3');
    allSidebarBtns.forEach(b => b.classList.remove('desktop_selected__2iKEU', 'jio-active-nav'));
    if (targetBtn) {
      targetBtn.classList.add('desktop_selected__2iKEU');
    }

    // 3. Restore native category view
    onNavigationTabSelect(null, categoryName);

    // 4. Trigger synthetic click on native button so React picks up the event
    if (targetBtn) {
      targetBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      targetBtn.click();
    }

    // 5. Scroll to and highlight the plan card for 3.5 seconds
    if (planTarget) {
      highlightTargetPlanCard(planTarget);
    }
  }

  function highlightTargetPlanCard(planTarget) {
    const targetPrice = typeof planTarget === 'object' ? (planTarget.price || null) : Number(planTarget);
    const targetId = typeof planTarget === 'object' ? (planTarget.id || null) : null;
    let attempts = 0;
    const maxAttempts = 40; // check over ~4 seconds as React renders cards

    function tryFindAndHighlight() {
      attempts++;
      const cards = window.JioDomExtractor ? window.JioDomExtractor.findRenderedCards() : [];
      let foundCard = null;

      for (const card of cards) {
        if (targetId && (card.getAttribute('data-plan-id') === String(targetId) || card.id === String(targetId))) {
          foundCard = card;
          break;
        }
        if (window.JioDomExtractor && targetPrice) {
          const cardPrice = window.JioDomExtractor.getCardPrice(card);
          if (cardPrice === targetPrice) {
            foundCard = card;
            break;
          }
        }
      }

      if (foundCard) {
        // Scroll plan smoothly to center of viewport
        foundCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Trigger pulse glow animation
        foundCard.classList.remove('jio-card-redirect-highlight');
        void foundCard.offsetWidth; // force reflow
        foundCard.classList.add('jio-card-redirect-highlight');

        // Retain highlight for 1.2 seconds
        setTimeout(() => {
          foundCard.classList.remove('jio-card-redirect-highlight');
        }, 1200);
      } else if (attempts < maxAttempts) {
        setTimeout(tryFindAndHighlight, 100);
      }
    }

    setTimeout(tryFindAndHighlight, 100);
  }

  function enhanceAllRenderedCards() {
    if (window.JioDomExtractor) {
      // Always declutter original category cards across the document
      window.JioDomExtractor.declutterOriginalCards(document);

      const cards = window.JioDomExtractor.findRenderedCards();
      cards.forEach(card => {
        window.JioDomExtractor.enhanceCard(card, catalogue);
      });
    }
  }

  function observeDOMChanges() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      let shouldEnhance = false;
      let shouldCheckSidebar = false;

      for (const m of mutations) {
        if (m.target && m.target.classList) {
          if (
            m.target.classList.contains('jio-intelligence-card-addon') ||
            m.target.classList.contains('jio-extension-nav-item') ||
            m.target.id === 'jio-intelligence-view-container' ||
            (m.target.closest && m.target.closest('#jio-intelligence-view-container'))
          ) {
            continue;
          }
        }

        if (m.addedNodes && m.addedNodes.length > 0) {
          shouldEnhance = true;
          shouldCheckSidebar = true;
        }
      }

      if (shouldCheckSidebar) {
        setupSidebar();
      }

      if (shouldEnhance) {
        if (enhanceDebounceTimer) clearTimeout(enhanceDebounceTimer);
        enhanceDebounceTimer = setTimeout(() => {
          if (!window.JioSidebar || !window.JioSidebar.getCurrentTab()) {
            enhanceAllRenderedCards();
          }
        }, 80);
      }
    });

    const target = document.querySelector('.Filter04_container__djdxj, .selfcare') || document.body;
    mutationObserver.observe(target, {
      childList: true,
      subtree: true
    });
  }

  function watchUrlChanges() {
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        if (!isTargetPage()) {
          cleanup();
        }
      }
    }, 1000);
  }

  function cleanup() {
    console.log('[Jio Unfiltered] Navigated away. Cleaning up injected DOM.');
    if (enhanceDebounceTimer) {
      clearTimeout(enhanceDebounceTimer);
      enhanceDebounceTimer = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (extensionViewContainer && extensionViewContainer.parentNode) {
      extensionViewContainer.parentNode.removeChild(extensionViewContainer);
      extensionViewContainer = null;
    }
    const navItems = document.querySelectorAll('.jio-extension-nav-item');
    navItems.forEach(n => n.remove());
    const addons = document.querySelectorAll('.jio-intelligence-card-addon');
    addons.forEach(a => a.remove());
  }

  // Initialize on idle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
