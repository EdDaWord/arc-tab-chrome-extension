// Node-compatible test runner (no external deps needed)
// Run with: node --experimental-vm-modules test/eligibility.test.js
// Or: node test/eligibility.test.js  (uses dynamic import)

import { isEligibleToClose } from '../src/eligibility.js';

const TAB_GROUP_ID_NONE = -1;
const NOW = 1_000_000_000_000; // fixed "now" for determinism
const TTL = 24 * 60 * 60 * 1000; // 24h

const BASE_SETTINGS = {
  enabled: true,
  ttlMs: TTL,
  measureMode: 'idle',
  respectAudible: true,
};

function tab(overrides = {}) {
  return {
    id: 1,
    url: 'https://example.com',
    title: 'Example',
    favIconUrl: '',
    active: false,
    pinned: false,
    audible: false,
    groupId: TAB_GROUP_ID_NONE,
    lastAccessed: NOW - TTL - 1000, // just past the threshold
    ...overrides,
  };
}

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    fail++;
  }
}

function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toContain(substr) {
      if (!String(val).includes(substr)) throw new Error(`Expected "${val}" to contain "${substr}"`);
    },
  };
}

console.log('\n── isEligibleToClose ──');

test('closes a stale ungrouped inactive tab', () => {
  const { eligible } = isEligibleToClose(tab(), NOW, BASE_SETTINGS);
  expect(eligible).toBe(true);
});

test('skips active tab', () => {
  const { eligible, reason } = isEligibleToClose(tab({ active: true }), NOW, BASE_SETTINGS);
  expect(eligible).toBe(false);
  expect(reason).toContain('active');
});

test('skips pinned tab', () => {
  const { eligible, reason } = isEligibleToClose(tab({ pinned: true }), NOW, BASE_SETTINGS);
  expect(eligible).toBe(false);
  expect(reason).toContain('pinned');
});

test('skips tab in group', () => {
  const { eligible, reason } = isEligibleToClose(tab({ groupId: 42 }), NOW, BASE_SETTINGS);
  expect(eligible).toBe(false);
  expect(reason).toContain('group');
});

test('skips audible tab when respectAudible=true', () => {
  const { eligible } = isEligibleToClose(tab({ audible: true }), NOW, BASE_SETTINGS);
  expect(eligible).toBe(false);
});

test('closes audible tab when respectAudible=false', () => {
  const { eligible } = isEligibleToClose(
    tab({ audible: true }),
    NOW,
    { ...BASE_SETTINGS, respectAudible: false },
  );
  expect(eligible).toBe(true);
});

test('skips tab with keep override', () => {
  const { eligible } = isEligibleToClose(
    tab(),
    NOW,
    BASE_SETTINGS,
    { 'https://example.com': true },
  );
  expect(eligible).toBe(false);
});

test('skips tab not yet stale', () => {
  const freshTab = tab({ lastAccessed: NOW - TTL + 60_000 }); // 1 min before threshold
  const { eligible } = isEligibleToClose(freshTab, NOW, BASE_SETTINGS);
  expect(eligible).toBe(false);
});

test('skips everything when extension disabled', () => {
  const { eligible } = isEligibleToClose(tab(), NOW, { ...BASE_SETTINGS, enabled: false });
  expect(eligible).toBe(false);
});

test('idle mode: uses max of lastAccessed and own tracking timestamp', () => {
  const recentActivation = NOW - 1000; // 1s ago — tab is fresh
  const { eligible } = isEligibleToClose(
    tab({ lastAccessed: NOW - TTL - 1000 }), // looks stale by API
    NOW,
    BASE_SETTINGS,
    {},
    { 1: recentActivation },
  );
  expect(eligible).toBe(false); // own timestamp says fresh
});

test('idle mode: uses lastAccessed when own timestamp is older', () => {
  const oldActivation = NOW - TTL - 2000; // even older than lastAccessed
  const { eligible } = isEligibleToClose(
    tab({ lastAccessed: NOW - TTL - 1000 }),
    NOW,
    BASE_SETTINGS,
    {},
    { 1: oldActivation },
  );
  expect(eligible).toBe(true); // both say stale
});

test('age mode: uses lastAccessed as proxy for creation time', () => {
  const freshCreated = tab({ lastAccessed: NOW - TTL + 60_000 });
  const { eligible } = isEligibleToClose(
    freshCreated,
    NOW,
    { ...BASE_SETTINGS, measureMode: 'age' },
  );
  expect(eligible).toBe(false);
});

test('age mode: closes tab past TTL', () => {
  const old = tab({ lastAccessed: NOW - TTL - 1 });
  const { eligible } = isEligibleToClose(
    old,
    NOW,
    { ...BASE_SETTINGS, measureMode: 'age' },
  );
  expect(eligible).toBe(true);
});

test('no timestamp available returns ineligible', () => {
  const noTs = tab({ lastAccessed: undefined });
  const { eligible } = isEligibleToClose(noTs, NOW, BASE_SETTINGS, {}, {});
  expect(eligible).toBe(false);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
