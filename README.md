# Arc Tabs

A Chrome/Edge (Chromium) extension that replicates two Arc browser behaviors:

1. **TTL auto-close** — stale tabs that haven't been viewed in a configurable time are automatically closed (with restore support).
2. **Group eject** — new tabs and link-opened tabs are automatically removed from tab groups, so they land ungrouped (Arc-style).

---

## Load unpacked (development)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this directory (`chrome-extensions/`).
4. The extension icon appears in the toolbar.

---

## Behaviors & toggles

### TTL auto-close

| Setting | Default | Description |
|---|---|---|
| Enable extension | On | Master switch |
| Close tabs idle for | 24 hours | Preset: 12h / 24h / 7d / 30d / Custom |
| Measure staleness by | Idle since last viewed | Alternative: Age since opened |
| Skip audible tabs | On | Never close tabs playing audio |

**Eligibility rules (all must be true to close):**
- Tab is not active
- Tab is not pinned
- Tab is not in a group
- Tab is not audible (if "Skip audible" is on)
- No "keep" override set for this URL
- Idle/age exceeds the threshold

**Per-tab keep override:** Click the extension icon while viewing any tab → check "Keep — exclude from auto-close". Persisted by URL, survives tab-id churn.

**Archive:** Before closing, the tab is saved (`url`, `title`, `favIcon`, `closedAt`) in a capped local archive (default 200 entries). Popup shows the archive with one-click **Restore** and **Clear all**.

### Group eject

| Setting | Default | Description |
|---|---|---|
| Open new tabs outside groups | On | Ejects Ctrl+T / ⌘T tabs from any group |
| Open link-clicked tabs outside groups | On | Ejects tabs opened via link clicks from any group |

Handles the Chromium timing race where `groupId` arrives after `onCreated`.

---

## Architecture

```
manifest.json          MV3 manifest
src/
  background.js        Service worker — alarms, sweep, eject, activation tracking
  eligibility.js       Pure isEligibleToClose() predicate (no side effects)
  storage.js           chrome.storage wrappers (sync for settings, local for state)
  defaults.js          DEFAULT_SETTINGS, constants
  options.html/css/js  Settings page
  popup.html/css/js    Action popup — keep override + archive
icons/
  icon16/48/128.png
test/
  eligibility.test.js  Unit tests for the eligibility predicate
```

### Service worker notes (MV3)

- Uses `chrome.alarms` (every 2 min) for the TTL sweep — safe across worker restarts.
- Activation timestamps are persisted to `chrome.storage.local` on every `tabs.onActivated`, so they survive service-worker teardowns.
- The `pendingEject` Set is in-memory only. Tabs that get grouped after a worker restart may not be ejected until the next `onUpdated` event for that tab (a known MV3 limitation; the visual impact is minimal).

---

## Running tests

```sh
node test/eligibility.test.js
# or
npm test
```

No external dependencies — pure Node.js ESM.
