import { ALARM_NAME, ALARM_PERIOD_MINUTES, TAB_GROUP_ID_NONE, EJECT_GRACE_MS } from './defaults.js';
import { getSettings, getKeepOverrides, getActivationTimestamps, recordActivation, removeActivationTimestamp, pushArchive } from './storage.js';
import { isEligibleToClose } from './eligibility.js';
import { shouldEjectLateGrouping } from './eject.js';

// ── Alarm setup ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) sweep();
});

// ── TTL sweep ────────────────────────────────────────────────────────────────

async function sweep() {
  const [settings, keepOverrides, activationTs] = await Promise.all([
    getSettings(),
    getKeepOverrides(),
    getActivationTimestamps(),
  ]);

  if (!settings.enabled) return;

  const tabs = await chrome.tabs.query({});
  const now = Date.now();

  for (const tab of tabs) {
    const { eligible } = isEligibleToClose(tab, now, settings, keepOverrides, activationTs);
    if (!eligible) continue;

    await pushArchive(
      { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl, closedAt: now },
      settings.archiveCap,
    );
    await removeActivationTimestamp(tab.id);
    chrome.tabs.remove(tab.id).catch(() => {}); // tab may already be gone
  }
}

// ── Activation tracking ──────────────────────────────────────────────────────

// Track the previously active tab per window so we can detect Edge split tabs.
// Split tabs (Option+Cmd+N) are created at prevActiveTab.index + 1; regular
// new tabs (Cmd+T) are created at the end of the strip.
const lastActiveTabInfo = new Map(); // windowId -> { tabId, index }

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  recordActivation(tabId).catch(console.error);
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) lastActiveTabInfo.set(windowId, { tabId, index: tab.index });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeActivationTimestamp(tabId).catch(console.error);
});

// ── Group eject ──────────────────────────────────────────────────────────────

// Tabs just created, mapped to the deadline after which a late grouping is
// considered deliberate (user drag) rather than the browser's auto-grouping
// race. tabId -> ejectUntilMs.
const pendingEject = new Map();

chrome.tabs.onCreated.addListener(async (tab) => {
  // Capture before any await — onActivated for the new tab may fire concurrently.
  const prevActive = lastActiveTabInfo.get(tab.windowId);

  const settings = await getSettings();
  if (!settings.enabled) return;

  const hasOpener = tab.openerTabId != null;
  const shouldEject = hasOpener ? settings.ejectLinkTabs : settings.ejectNewTabs;
  if (!shouldEject) return;

  if (tab.groupId !== TAB_GROUP_ID_NONE) {
    eject(tab.id);
  } else {
    // Skip moving tabs that look like Edge split tabs. Split tabs are created
    // at prevActiveTab.index + 1; moving them breaks Edge's left/right layout.
    // Regular new tabs (Cmd+T) open at the end of the strip, so their index
    // won't equal prevActive.index + 1 (unless the active tab was already last,
    // in which case the tab is already at the end and skipping the move is fine).
    const looksLikeSplitTab = !hasOpener && prevActive && tab.index === prevActive.index + 1;

    if (!looksLikeSplitTab) {
      chrome.tabs.move(tab.id, { index: -1 }).catch(() => {});
    }
    // Also watch for late grouping, but only briefly — this catches the
    // browser's async auto-grouping race, not a deliberate drag-in later.
    pendingEject.set(tab.id, Date.now() + EJECT_GRACE_MS);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!pendingEject.has(tabId)) return;
  if (changeInfo.groupId == null) return;

  const ejectUntil = pendingEject.get(tabId);
  pendingEject.delete(tabId);

  // Only eject if this grouping happened inside the post-creation grace window.
  // A later grouping is a deliberate user drag and must be left alone.
  if (!shouldEjectLateGrouping({ now: Date.now(), ejectUntil, newGroupId: changeInfo.groupId })) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  // Re-fetch the tab to check openerTabId
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;

  const hasOpener = tab.openerTabId != null;
  const shouldEject = hasOpener ? settings.ejectLinkTabs : settings.ejectNewTabs;
  if (shouldEject) eject(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pendingEject.delete(tabId);
});

function eject(tabId) {
  chrome.tabs.ungroup(tabId)
    .then(() => chrome.tabs.move(tabId, { index: -1 }))
    .catch(() => {});
}

// ── Message handler (from popup / options) ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SWEEP_NOW') {
    sweep().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async
  }
});
