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
