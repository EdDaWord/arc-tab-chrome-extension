import { getKeepOverrides, setKeepOverride, getArchive, clearArchive } from './storage.js';

const $ = (id) => document.getElementById(id);

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

async function init() {
  // Open options page
  $('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Current tab keep-override
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    $('tabFavicon').src = tab.favIconUrl || '';
    $('tabTitle').textContent = tab.title || tab.url || '';

    const overrides = await getKeepOverrides();
    $('keepTab').checked = !!(tab.url && overrides[tab.url]);

    $('keepTab').addEventListener('change', async (e) => {
      if (tab.url) await setKeepOverride(tab.url, e.target.checked);
    });
  }

  // Archive
  await renderArchive();

  $('clearArchive').addEventListener('click', async () => {
    await clearArchive();
    await renderArchive();
  });
}

async function renderArchive() {
  const archive = await getArchive();
  const list = $('archiveList');
  const empty = $('emptyState');

  list.innerHTML = '';

  if (archive.length === 0) {
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';

  for (const entry of archive) {
    const li = document.createElement('li');
    li.className = 'archive-item';

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = entry.favIconUrl || '';
    favicon.onerror = () => { favicon.style.display = 'none'; };

    const meta = document.createElement('div');
    meta.className = 'archive-meta';

    const titleEl = document.createElement('div');
    titleEl.className = 'archive-title';
    titleEl.textContent = entry.title || entry.url || '(unknown)';
    titleEl.title = entry.url || '';

    const timeEl = document.createElement('div');
    timeEl.className = 'archive-time';
    timeEl.textContent = timeAgo(entry.closedAt);

    meta.append(titleEl, timeEl);

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'restore-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: entry.url, active: false });
    });

    li.append(favicon, meta, restoreBtn);
    list.appendChild(li);
  }
}

init().catch(console.error);
