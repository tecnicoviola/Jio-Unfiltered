const test = require('node:test');
const assert = require('node:assert');

// Mock JSDOM / browser globals
if (typeof document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        innerHTML: '',
        children: [],
        attributes: {},
        style: {
          setProperty: () => {},
          removeProperty: () => {}
        },
        setAttribute: (k, v) => { el.attributes[k] = v; },
        getAttribute: (k) => el.attributes[k] || null,
        hasAttribute: (k) => k in el.attributes,
        removeAttribute: (k) => { delete el.attributes[k]; },
        querySelector: (sel) => {
          // simple selector simulation
          if (sel.includes('.jio-card-price')) return { textContent: '349' };
          if (sel.includes('.jio-card-daily-cost')) return { textContent: '₹12.46/day' };
          if (sel.includes('.jio-native-pill-value')) return { textContent: 'VALUE 85' };
          if (sel.includes('.jio-native-pill-transparency')) return { textContent: 'TRANSPARENCY 90' };
          if (sel.includes('.jio-card-buy-btn')) return { textContent: 'Buy', addEventListener: () => {} };
          if (sel.includes('.jio-card-chevron-btn')) return { addEventListener: () => {} };
          if (sel.includes('.jio-card-insight-text')) return { textContent: 'Balanced everyday plan.', addEventListener: () => {} };
          return null;
        },
        querySelectorAll: () => [],
        appendChild: (c) => el.children.push(c)
      };
      return el;
    }
  };
}

const { renderPlanCard } = require('../src/ui/cardRenderer');

test('Recommendation Cards — Correct structure, elements, and tokens', (t) => {
  const plan = {
    id: 'test-101',
    price: 349,
    validityDays: 28,
    validityText: '28 Days',
    dailyDataGB: 2.0,
    totalDataGB: 56.0,
    valueScore: 85,
    transparencyScore: 90
  };

  const card = renderPlanCard(plan, { badgeText: 'BEST VALUE', rationale: 'Optimal everyday connectivity.' });
  assert.ok(card, 'Card must be created');
  assert.ok(card.innerHTML.includes('BEST VALUE'), 'Badge text rendered');
  assert.ok(card.innerHTML.includes('₹349') || card.innerHTML.includes('349'), 'Price rendered');
  assert.ok(card.innerHTML.includes('28 Days'), 'Validity rendered');
  assert.ok(card.innerHTML.includes('2 GB/day'), 'Data rendered');
  assert.ok(card.innerHTML.includes('₹12.46/day'), 'Compact daily cost calculated');
  assert.ok(card.innerHTML.includes('VALUE 85'), 'Value score badge rendered');
  assert.ok(card.innerHTML.includes('TRANSPARENCY 90'), 'Transparency score badge rendered');
  assert.ok(card.innerHTML.includes('Optimal everyday connectivity.'), 'Insight text rendered');
  assert.ok(card.innerHTML.includes('jio-card-buy-btn'), 'Buy button rendered');
  assert.ok(card.innerHTML.includes('jio-card-chevron-btn'), 'Chevron button rendered');
  assert.ok(card.innerHTML.includes('jio-card-divider'), 'Subtle divider rendered');
});

test('Recommendation Cards — Graceful handling of missing or incomplete data', (t) => {
  const emptyPlan = {
    price: 0,
    validityDays: null,
    dailyDataGB: 0,
    totalDataGB: 0,
    valueScore: null,
    transparencyScore: null
  };

  const card = renderPlanCard(emptyPlan);
  assert.ok(card, 'Card rendered without errors');
  assert.ok(card.innerHTML.includes('—'), 'Renders neutral dash for missing daily cost and scores');
  assert.ok(card.innerHTML.includes('VALUE —'), 'Renders neutral dash for missing value score');
  assert.ok(card.innerHTML.includes('TRANSPARENCY —'), 'Renders neutral dash for missing transparency score');
  assert.ok(card.innerHTML.includes('jio-card-subs-row'), 'Always renders subscriptions row for vertical consistency');
  assert.ok(card.innerHTML.includes('jio-card-avail-row'), 'Always renders available in row for vertical consistency');
});

test('Recommendation Cards — Data-only pack calls and SMS are N/A (No Misinformation)', (t) => {
  const dataOnlyPlan = {
    id: 'jp-182',
    name: '₹182',
    price: 182,
    validityDays: 28,
    validityText: '28 Days',
    dailyDataGB: 2,
    totalDataGB: 56,
    voice: 'N/A',
    sms: 'N/A',
    categories: ['4G Feature Phone Addon'],
    subcategories: ['JioPhone Data Voucher']
  };

  const card = renderPlanCard(dataOnlyPlan);
  assert.ok(card.innerHTML.includes('<span class="jio-stat-label">Calls</span>\n            <span class="jio-stat-val">N/A</span>') || card.innerHTML.includes('>Calls</span>') && card.innerHTML.includes('>N/A</span>'), 'Calls must display N/A for data-only packs');
  assert.ok(!card.innerHTML.includes('>Unlimited</span>'), 'Must NOT display Unlimited for data-only packs');
});

test('Recommendation Cards — Subscriptions overflow capped to 2 with +N more', (t) => {
  const multiSubPlan = {
    price: 2000,
    validityDays: 365,
    subscriptions: [
      { title: 'YouTube Premium' },
      { title: 'Amazon Prime Lite' },
      { title: 'JioHotstar' },
      { title: 'Sony LIV' },
      { title: 'ZEE5' }
    ]
  };

  const card = renderPlanCard(multiSubPlan);
  assert.ok(card.innerHTML.includes('+3 more'), 'Capped to 2 visible subscriptions and +3 more button');
});

test('Styles — Redirection Highlight uses primary Jio color and 1.2s duration', (t) => {
  const fs = require('fs');
  const css = fs.readFileSync('src/styles/extension.css', 'utf8');
  assert.ok(!css.includes('#0a2885'), 'Must NOT contain darker variant #0a2885');
  assert.ok(css.includes('jioCardHighlightGlow 1.2s'), 'Redirect highlight duration must be 1.2s');
});

test('Recommendation Cards — All available-in categories provided in two-line cluster', (t) => {
  const multiCatPlan = {
    price: 3599,
    validityDays: 365,
    categories: ['Popular Plans', 'True 5G Unlimited Plans', 'Annual Plans']
  };

  const card = renderPlanCard(multiCatPlan, { showCategories: true });
  assert.ok(card.innerHTML.includes('Popular Plans'), 'Includes first category');
  assert.ok(card.innerHTML.includes('True 5G Unlimited Plans'), 'Includes second category');
  assert.ok(card.innerHTML.includes('Annual Plans'), 'Includes third category without +X cropping');
  assert.ok(!card.innerHTML.includes('jio-cat-more'), 'Does not truncate with +N more');
  assert.ok(card.innerHTML.includes('jio-avail-cluster'), 'Uses 2-line wrapped available cluster');
});

test('Manifest & Startup — Baseline plans catalogue included in manifest for zero-delay startup', (t) => {
  const fs = require('fs');
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.includes('src/data/baselinePlans.js'), 'Must include baselinePlans.js in manifest content_scripts');
});


