const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

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
          if (sel.includes('.jio-card-price')) return { textContent: '349' };
          if (sel.includes('.jio-card-daily-cost')) return { textContent: '₹12.46/day' };
          if (sel.includes('.jio-card-btn-evidence')) return { textContent: 'Learn more', addEventListener: () => {} };
          return null;
        },
        querySelectorAll: () => [],
        appendChild: (c) => el.children.push(c)
      };
      return el;
    }
  };
}

const { EVIDENCE_CLASSES, VERIFIED_KNOWLEDGE_BASE, getEvidenceForPlan } = require('../src/evidence/evidenceStore');
const { renderPlanCard } = require('../src/ui/cardRenderer');
const evidenceModal = require('../src/ui/evidenceModal');

test('Evidence System — Every entry contains a valid absolute HTTPS URL', (t) => {
  assert.ok(VERIFIED_KNOWLEDGE_BASE.length > 0, 'Knowledge base must not be empty');
  for (const entry of VERIFIED_KNOWLEDGE_BASE) {
    assert.ok(entry.url, `Entry ${entry.id} must have a URL`);
    assert.ok(entry.url.startsWith('https://'), `URL for ${entry.id} must be an absolute HTTPS URL: ${entry.url}`);
    assert.doesNotMatch(entry.url, /undefined|null|placeholder|example\.com/i, `URL for ${entry.id} must not be a placeholder`);
    // Validate standard URL format
    const parsed = new URL(entry.url);
    assert.ok(parsed.hostname, `URL for ${entry.id} must have a valid hostname`);
  }
});

test('Evidence System — Strict status classifications and truthfulness', (t) => {
  const validStatuses = new Set([
    'OFFICIALLY_VERIFIED',
    'REGULATORY_SOURCE',
    'COMMUNITY_REPORTED',
    'CONFLICTING_EVIDENCE',
    'UNVERIFIED'
  ]);

  for (const entry of VERIFIED_KNOWLEDGE_BASE) {
    assert.ok(validStatuses.has(entry.class), `Entry ${entry.id} has invalid status ${entry.class}`);
    assert.ok(entry.sourceTitle && entry.sourceTitle.trim().length > 5, `Entry ${entry.id} must have an accurate source title`);
    assert.ok(entry.publisher && entry.publisher.trim().length > 3, `Entry ${entry.id} must have an authoritative publisher`);
    assert.ok(entry.title && entry.title.trim().length > 5, `Entry ${entry.id} must have a claim title`);
    assert.ok(entry.summary && entry.summary.trim().length > 15, `Entry ${entry.id} must have an explanatory summary`);

    // Ensure community reported / informal rules are NOT marked as OFFICIALLY_VERIFIED
    if (entry.id.includes('renewal-continuity') || entry.publisher.includes('Community')) {
      assert.notStrictEqual(entry.class, 'OFFICIALLY_VERIFIED', `Informal community report ${entry.id} must not be OFFICIALLY_VERIFIED`);
      assert.strictEqual(entry.class, 'COMMUNITY_REPORTED', `Informal community report ${entry.id} must be COMMUNITY_REPORTED`);
    }

    // Ensure regulatory sources are correctly categorized
    if (entry.id.startsWith('trai-')) {
      assert.strictEqual(entry.class, 'REGULATORY_SOURCE', `TRAI directive ${entry.id} must be REGULATORY_SOURCE`);
    }
  }
});

test('Evidence System — Accurate claims and excerpts for 5G, Gemini, and Hotstar', (t) => {
  const g5Entry = VERIFIED_KNOWLEDGE_BASE.find(e => e.id === 'true-5g-unlimited-eligibility');
  assert.ok(g5Entry, '5G entry must exist');
  assert.ok(g5Entry.url.includes('do-i-get-unlimited-5g-in-my-prepaid-mobile-plan'), '5G entry points to official Jio 5G FAQ');
  assert.ok(g5Entry.summary.includes('₹349'), 'Specifies ₹349 entry point');
  assert.ok(g5Entry.summary.includes('2 GB/day'), 'Specifies 2 GB/day threshold');

  const geminiEntry = VERIFIED_KNOWLEDGE_BASE.find(e => e.id === 'gemini-pro-continuity-condition');
  assert.ok(geminiEntry, 'Gemini entry must exist');
  assert.ok(geminiEntry.url.includes('jio-google-gemini-terms-and-conditions'), 'Points to dedicated Gemini T&C');
  assert.ok(geminiEntry.summary.includes('consecutive continuous recharges'), 'Explains continuity condition');

  const hotstarEntry = VERIFIED_KNOWLEDGE_BASE.find(e => e.id === 'jiohotstar-prepaid-terms');
  assert.ok(hotstarEntry, 'JioHotstar entry must exist');
  assert.ok(hotstarEntry.url.includes('jiohotstar-offer-t-c-for-prepaid-customers'), 'Points to dedicated Hotstar offer terms');
});

test('Evidence System — Missing URL produces safe unverified tag, never a broken link', (t) => {
  const customList = [
    {
      id: 'unverified-claim',
      class: 'UNVERIFIED',
      title: 'Unverified Claim Without URL',
      sourceTitle: 'Unknown Source',
      publisher: 'Unverified',
      url: null,
      dateChecked: '2026-10-28',
      summary: 'Testing fallback rendering when no verified URL exists.'
    }
  ];

  const modalEl = evidenceModal.createModalElement({ price: 199, validityText: '28 Days' }, customList);
  const html = modalEl.innerHTML;

  assert.ok(!html.includes('href="null"'), 'Must never render href="null"');
  assert.ok(!html.includes('href=""'), 'Must never render empty href');
  assert.ok(html.includes('Source Citation Unavailable'), 'Renders clear unverified state instead of fake link');
  assert.ok(!html.includes('Official Reference &rarr;'), 'Must NOT render clickable Official Reference when URL is absent');
});

test('UI — Card action button displays "Learn more" (replacing "View Evidence & T&C")', (t) => {
  const plan = {
    price: 349,
    validityDays: 28,
    validityText: '28 Days',
    dailyDataGB: 2.0
  };

  const card = renderPlanCard(plan);
  const cardHtml = card.innerHTML;

  assert.ok(cardHtml.includes('Learn more'), 'CTA button must display "Learn more"');
  assert.ok(!cardHtml.includes('View Evidence & T&C'), 'Must NOT contain "View Evidence & T&C"');
});

test('UI Styles — Hover lift effect is completely removed from recommendation cards', (t) => {
  const css = fs.readFileSync('src/styles/extension.css', 'utf8');

  // Ensure no .jio-rec-card-body:hover rule exists
  assert.ok(!css.includes('.jio-rec-card-body:hover'), 'Must NOT have .jio-rec-card-body:hover selector in CSS');

  // Verify badges for all 5 evidence statuses are styled
  assert.ok(css.includes('.jio-evidence-badge.officially_verified'), 'Styles for officially_verified badge must exist');
  assert.ok(css.includes('.jio-evidence-badge.regulatory_source'), 'Styles for regulatory_source badge must exist');
  assert.ok(css.includes('.jio-evidence-badge.community_reported'), 'Styles for community_reported badge must exist');
  assert.ok(css.includes('.jio-evidence-badge.conflicting_evidence'), 'Styles for conflicting_evidence badge must exist');
  assert.ok(css.includes('.jio-evidence-badge.unverified'), 'Styles for unverified badge must exist');
});
