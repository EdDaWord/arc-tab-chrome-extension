// Node-compatible test runner (no external deps needed)
// Run with: node test/eject.test.js

import { shouldEjectLateGrouping } from '../src/eject.js';

const TAB_GROUP_ID_NONE = -1;
const NOW = 1_000_000_000_000; // fixed "now" for determinism
const GRACE = 5000;

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
  };
}

console.log('\n── shouldEjectLateGrouping ──');

// The core race we DO want to handle: browser auto-groups a fresh tab a beat
// after creation, still inside the grace window.
test('ejects when grouped inside the grace window (auto-grouping race)', () => {
  const ejectUntil = NOW + GRACE;
  const result = shouldEjectLateGrouping({ now: NOW + 1000, ejectUntil, newGroupId: 42 });
  expect(result).toBe(true);
});

// THE regression this whole change exists to prevent: a tab dragged into a
// group long after creation must NOT be ejected "over time".
test('does NOT eject when grouped after the grace window (deliberate drag)', () => {
  const ejectUntil = NOW + GRACE;
  const result = shouldEjectLateGrouping({ now: NOW + GRACE + 1, ejectUntil, newGroupId: 42 });
  expect(result).toBe(false);
});

test('does NOT eject a tab grouped hours later', () => {
  const ejectUntil = NOW + GRACE;
  const hoursLater = NOW + 3 * 60 * 60 * 1000;
  const result = shouldEjectLateGrouping({ now: hoursLater, ejectUntil, newGroupId: 42 });
  expect(result).toBe(false);
});

// Boundary: exactly at the deadline is still within grace (we use > to expire).
test('ejects exactly at the deadline (boundary is inclusive)', () => {
  const ejectUntil = NOW + GRACE;
  const result = shouldEjectLateGrouping({ now: ejectUntil, ejectUntil, newGroupId: 42 });
  expect(result).toBe(true);
});

test('does NOT eject a tab we were not watching (no deadline)', () => {
  const result = shouldEjectLateGrouping({ now: NOW, ejectUntil: null, newGroupId: 42 });
  expect(result).toBe(false);
});

test('does NOT eject when the change is an ungroup (groupId === NONE)', () => {
  const ejectUntil = NOW + GRACE;
  const result = shouldEjectLateGrouping({ now: NOW + 100, ejectUntil, newGroupId: TAB_GROUP_ID_NONE });
  expect(result).toBe(false);
});

test('does NOT eject when the update is not a grouping change (groupId null)', () => {
  const ejectUntil = NOW + GRACE;
  const result = shouldEjectLateGrouping({ now: NOW + 100, ejectUntil, newGroupId: null });
  expect(result).toBe(false);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
