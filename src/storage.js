import { DEFAULT_SETTINGS } from './defaults.js';

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(patch) {
  await chrome.storage.sync.set(patch);
}

// keep-alive overrides: { [url]: true }
export async function getKeepOverrides() {
  const { keepOverrides = {} } = await chrome.storage.local.get('keepOverrides');
  return keepOverrides;
}

export async function setKeepOverride(url, kept) {
  const overrides = await getKeepOverrides();
  if (kept) {
    overrides[url] = true;
  } else {
    delete overrides[url];
  }
  await chrome.storage.local.set({ keepOverrides: overrides });
}

// activation timestamps: { [tabId]: timestampMs }
export async function getActivationTimestamps() {
  const { activationTimestamps = {} } = await chrome.storage.local.get('activationTimestamps');
  return activationTimestamps;
}

export async function recordActivation(tabId) {
  const ts = await getActivationTimestamps();
  ts[tabId] = Date.now();
  await chrome.storage.local.set({ activationTimestamps: ts });
}

export async function removeActivationTimestamp(tabId) {
  const ts = await getActivationTimestamps();
  delete ts[tabId];
  await chrome.storage.local.set({ activationTimestamps: ts });
}

// archive: Array<{ url, title, favIconUrl, closedAt }>
export async function getArchive() {
  const { archive = [] } = await chrome.storage.local.get('archive');
  return archive;
}

export async function pushArchive(entry, cap) {
  let archive = await getArchive();
  archive.unshift(entry);
  if (archive.length > cap) archive = archive.slice(0, cap);
  await chrome.storage.local.set({ archive });
}

export async function clearArchive() {
  await chrome.storage.local.set({ archive: [] });
}
