import { TAB_GROUP_ID_NONE } from './defaults.js';

/**
 * Pure predicate — no side effects, no storage access.
 *
 * @param {object} tab           - chrome.tabs.Tab
 * @param {number} now           - Date.now()
 * @param {object} settings      - from getSettings()
 * @param {object} keepOverrides - { [url]: true }
 * @param {object} activationTs  - { [tabId]: timestampMs }
 * @returns {{ eligible: boolean, reason: string }}
 */
export function isEligibleToClose(tab, now, settings, keepOverrides = {}, activationTs = {}) {
  if (!settings.enabled) return { eligible: false, reason: 'extension disabled' };

  if (tab.active)   return { eligible: false, reason: 'tab is active' };
  if (tab.pinned)   return { eligible: false, reason: 'tab is pinned' };
  if (tab.groupId !== TAB_GROUP_ID_NONE) return { eligible: false, reason: 'tab is in a group' };
  if (settings.respectAudible && tab.audible) return { eligible: false, reason: 'tab is audible' };

  if (tab.url && keepOverrides[tab.url]) return { eligible: false, reason: 'keep override set' };

  const referenceTs = getReferencetimestamp(tab, settings, activationTs);
  if (referenceTs === null) return { eligible: false, reason: 'no timestamp available' };

  const elapsed = now - referenceTs;
  if (elapsed < settings.ttlMs) {
    return { eligible: false, reason: `not stale yet (${Math.round(elapsed / 60000)}m / ${Math.round(settings.ttlMs / 60000)}m)` };
  }

  return { eligible: true, reason: 'stale' };
}

function getReferencetimestamp(tab, settings, activationTs) {
  if (settings.measureMode === 'age') {
    // Chrome doesn't expose createdAt on the tab object; fall back to lastAccessed
    return tab.lastAccessed ?? null;
  }

  // idle mode: use max(lastAccessed, our own tracked activation)
  const ownTs = activationTs[tab.id] ?? null;
  const apiTs = tab.lastAccessed ?? null;

  if (ownTs !== null && apiTs !== null) return Math.max(ownTs, apiTs);
  return ownTs ?? apiTs;
}
