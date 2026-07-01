export const DEFAULT_SETTINGS = {
  enabled: true,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  measureMode: 'idle',         // 'idle' | 'age'
  ejectNewTabs: true,
  ejectLinkTabs: true,
  respectAudible: true,
  archiveCap: 200,
};

export const ALARM_NAME = 'arc-tabs-sweep';
export const ALARM_PERIOD_MINUTES = 2;
export const TAB_GROUP_ID_NONE = -1;

// How long after a tab is created we still treat "it got grouped" as the
// browser's async auto-grouping race (worth ejecting). Past this window, any
// grouping is a deliberate user action (e.g. dragging into a group) and is
// left untouched.
export const EJECT_GRACE_MS = 5000;
