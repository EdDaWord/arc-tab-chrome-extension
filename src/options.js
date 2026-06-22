import { getSettings, saveSettings } from './storage.js';

const $ = (id) => document.getElementById(id);

const PRESETS = [43200000, 86400000, 604800000, 2592000000];

async function load() {
  const s = await getSettings();

  $('enabled').checked       = s.enabled;
  $('measureMode').value     = s.measureMode;
  $('respectAudible').checked = s.respectAudible;
  $('ejectNewTabs').checked  = s.ejectNewTabs;
  $('ejectLinkTabs').checked = s.ejectLinkTabs;
  $('archiveCap').value      = s.archiveCap;

  if (PRESETS.includes(s.ttlMs)) {
    $('ttlPreset').value = String(s.ttlMs);
    $('customRow').style.display = 'none';
  } else {
    $('ttlPreset').value = 'custom';
    $('customRow').style.display = 'flex';
    // Pick the largest unit that divides evenly, down to seconds
    if (s.ttlMs % 86400000 === 0) {
      $('customValue').value = s.ttlMs / 86400000;
      $('customUnit').value = '86400000';
    } else if (s.ttlMs % 3600000 === 0) {
      $('customValue').value = s.ttlMs / 3600000;
      $('customUnit').value = '3600000';
    } else {
      $('customValue').value = Math.round(s.ttlMs / 1000);
      $('customUnit').value = '1000';
    }
  }
}

$('ttlPreset').addEventListener('change', () => {
  $('customRow').style.display = $('ttlPreset').value === 'custom' ? 'flex' : 'none';
});

$('save').addEventListener('click', async () => {
  let ttlMs;
  if ($('ttlPreset').value === 'custom') {
    const val  = parseFloat($('customValue').value) || 1;
    const unit = parseInt($('customUnit').value, 10);
    ttlMs = val * unit;
  } else {
    ttlMs = parseInt($('ttlPreset').value, 10);
  }

  await saveSettings({
    enabled:        $('enabled').checked,
    ttlMs,
    measureMode:    $('measureMode').value,
    respectAudible: $('respectAudible').checked,
    ejectNewTabs:   $('ejectNewTabs').checked,
    ejectLinkTabs:  $('ejectLinkTabs').checked,
    archiveCap:     parseInt($('archiveCap').value, 10) || 200,
  });

  const status = $('status');
  status.textContent = 'Saved!';
  setTimeout(() => { status.textContent = ''; }, 2000);
});

load();
