import { TAB_GROUP_ID_NONE } from './defaults.js';

/**
 * Pure predicate — decides whether a tab that was just observed getting a
 * groupId should be ejected from that group.
 *
 * The intent: automatic ejection only applies to the browser's async
 * auto-grouping race right after a tab is created. If the tab acquires a group
 * *after* the grace window, that's a deliberate user action (dragging it into a
 * group) and must be left alone.
 *
 * @param {object} args
 * @param {number}      args.now         - Date.now()
 * @param {number|null} args.ejectUntil  - deadline set at tab creation; null if the tab was never a fresh eject candidate
 * @param {number}      args.newGroupId  - the groupId the tab just acquired (changeInfo.groupId)
 * @returns {boolean}
 */
export function shouldEjectLateGrouping({ now, ejectUntil, newGroupId }) {
  if (ejectUntil == null) return false;              // not a freshly-created tab we're watching
  if (newGroupId == null) return false;              // not a grouping change
  if (newGroupId === TAB_GROUP_ID_NONE) return false; // it was ungrouped, nothing to eject
  if (now > ejectUntil) return false;                // past grace window → deliberate grouping
  return true;
}
