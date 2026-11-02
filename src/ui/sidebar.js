/**
 * Sidebar Navigation Integration
 * Injects exactly two seamless navigation entries directly above 'Popular Plans':
 *  1. Top Recommendations
 *  2. Best for My Needs
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.JioSidebar = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let currentActiveTab = null; // 'top_recommendations' | 'best_for_needs' | null (native)
  let activeCallback = null;
  let isDelegationAttached = false;

  function injectNavigationEntries(onTabSelect) {
    activeCallback = onTabSelect;

    // Locate desktop sidebar container
    const sidebarList = document.querySelector('.desktop_listContainer__3tvIZ, .Filter04_roundedBoder__1kXFj div');
    if (!sidebarList) return false;

    // Attach global capture-phase listener once to catch any native category click
    if (!isDelegationAttached) {
      document.addEventListener('click', handleGlobalCategoryClick, true);
      isDelegationAttached = true;
    }

    // Check if already injected
    let btnTopRec = document.getElementById('jio-nav-top-recommendations');
    let btnBestNeeds = document.getElementById('jio-nav-best-needs');

    if (!btnTopRec) {
      btnTopRec = document.createElement('button');
      btnTopRec.id = 'jio-nav-top-recommendations';
      btnTopRec.type = 'button';
      btnTopRec.className = 'desktop_btnCss__1HAJ3 jio-extension-nav-item';
      btnTopRec.innerHTML = `<span>Top Recommendations</span>`;
      btnTopRec.setAttribute('aria-label', 'View top value recommendations');

      btnTopRec.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab('top_recommendations', activeCallback);
      });
    }

    if (!btnBestNeeds) {
      btnBestNeeds = document.createElement('button');
      btnBestNeeds.id = 'jio-nav-best-needs';
      btnBestNeeds.type = 'button';
      btnBestNeeds.className = 'desktop_btnCss__1HAJ3 jio-extension-nav-item';
      btnBestNeeds.innerHTML = `<span>Best for My Needs</span>`;
      btnBestNeeds.setAttribute('aria-label', 'Find best plan tailored to your needs');

      btnBestNeeds.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveTab('best_for_needs', activeCallback);
      });
    }

    // Ensure they are prepended in the correct order above the first native item
    if (sidebarList.firstChild !== btnTopRec) {
      sidebarList.insertBefore(btnBestNeeds, sidebarList.firstChild);
      sidebarList.insertBefore(btnTopRec, sidebarList.firstChild);
    }

    // Enforce border-radius rules:
    // 1. Top Recommendations has rounded top corners
    btnTopRec.style.setProperty('border-top-left-radius', '0.75rem', 'important');
    btnTopRec.style.setProperty('border-top-right-radius', '0.75rem', 'important');
    btnTopRec.style.setProperty('border-bottom-left-radius', '0', 'important');
    btnTopRec.style.setProperty('border-bottom-right-radius', '0', 'important');

    // 2. Best for My Needs is completely rectangular
    btnBestNeeds.style.setProperty('border-radius', '0', 'important');

    // 3. Fix Popular Plans curved edge: all subsequent items must have SHARP square corners (border-radius: 0)
    const allButtons = sidebarList.querySelectorAll('.desktop_btnCss__1HAJ3');
    for (let i = 2; i < allButtons.length - 1; i++) {
      allButtons[i].style.setProperty('border-radius', '0', 'important');
    }

    // Reapply active class if tab is currently active
    if (currentActiveTab === 'top_recommendations') {
      btnTopRec.classList.add('desktop_selected__2iKEU', 'jio-active-nav');
      btnBestNeeds.classList.remove('desktop_selected__2iKEU', 'jio-active-nav');
    } else if (currentActiveTab === 'best_for_needs') {
      btnBestNeeds.classList.add('desktop_selected__2iKEU', 'jio-active-nav');
      btnTopRec.classList.remove('desktop_selected__2iKEU', 'jio-active-nav');
    } else {
      // Extension tabs not active: ensure the active native button has desktop_selected__2iKEU
      const hasSelectedNative = sidebarList.querySelector('.desktop_btnCss__1HAJ3:not(.jio-extension-nav-item).desktop_selected__2iKEU');
      if (!hasSelectedNative) {
        // Fallback: highlight the first native category (Popular Plans)
        const firstNativeBtn = sidebarList.querySelector('.desktop_btnCss__1HAJ3:not(.jio-extension-nav-item)');
        if (firstNativeBtn) {
          firstNativeBtn.classList.add('desktop_selected__2iKEU');
        }
      }
    }

    return true;
  }

  function handleGlobalCategoryClick(e) {
    const target = e.target;
    if (!target) return;

    // Check if clicked button is an original Jio native category button
    const nativeBtn = target.closest('.desktop_btnCss__1HAJ3:not(.jio-extension-nav-item)');
    if (nativeBtn) {
      clearExtensionActiveState();
      clearAllSidebarSelected();
      nativeBtn.classList.add('desktop_selected__2iKEU');

      if (activeCallback) {
        activeCallback(null, nativeBtn.textContent.trim());
      }
    }
  }

  function setActiveTab(tabKey, callback) {
    currentActiveTab = tabKey;
    clearAllSidebarSelected();

    const topRecBtn = document.getElementById('jio-nav-top-recommendations');
    const bestNeedsBtn = document.getElementById('jio-nav-best-needs');

    if (tabKey === 'top_recommendations' && topRecBtn) {
      topRecBtn.classList.add('desktop_selected__2iKEU', 'jio-active-nav');
    } else if (tabKey === 'best_for_needs' && bestNeedsBtn) {
      bestNeedsBtn.classList.add('desktop_selected__2iKEU', 'jio-active-nav');
    }

    if (callback) {
      callback(tabKey);
    }
  }

  function clearAllSidebarSelected() {
    const allBtns = document.querySelectorAll('.desktop_btnCss__1HAJ3');
    allBtns.forEach(btn => {
      btn.classList.remove('desktop_selected__2iKEU', 'jio-active-nav');
    });
  }

  function clearExtensionActiveState() {
    currentActiveTab = null;
    const topRecBtn = document.getElementById('jio-nav-top-recommendations');
    const bestNeedsBtn = document.getElementById('jio-nav-best-needs');
    if (topRecBtn) topRecBtn.classList.remove('desktop_selected__2iKEU', 'jio-active-nav');
    if (bestNeedsBtn) bestNeedsBtn.classList.remove('desktop_selected__2iKEU', 'jio-active-nav');
  }

  function getCurrentTab() {
    return currentActiveTab;
  }

  return {
    injectNavigationEntries,
    setActiveTab,
    clearExtensionActiveState,
    getCurrentTab
  };
});
