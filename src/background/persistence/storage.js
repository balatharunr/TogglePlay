/**
 * chrome.storage.local (preferences) + chrome.storage.session (tab pairs).
 */
async function loadLocalPreferences() {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  var data = await chrome.storage.local.get([
    keys.ENABLED,
    keys.SYNC_MODE
  ]);

  return {
    isEnabled: data[keys.ENABLED] !== false,
    syncMode: data[keys.SYNC_MODE] || TogglePlayConfig.DEFAULT_SYNC_MODE
  };
}

async function saveLocalPreferences(partial) {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  var payload = {};

  if (partial.isEnabled !== undefined) {
    payload[keys.ENABLED] = partial.isEnabled;
  }
  if (partial.syncMode !== undefined) {
    payload[keys.SYNC_MODE] = partial.syncMode;
  }

  if (Object.keys(payload).length > 0) {
    await chrome.storage.local.set(payload);
  }
}

async function loadSessionPairs() {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  var data = await chrome.storage.session.get([keys.PAIRS_SESSION]);
  var entries = data[keys.PAIRS_SESSION];
  return TogglePlayStorageSerializers.entriesToMap(entries);
}

async function saveSessionPairs(pairsMap) {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  await chrome.storage.session.set({
    [keys.PAIRS_SESSION]: TogglePlayStorageSerializers.mapToEntries(pairsMap)
  });
}

async function persistBackgroundState(fields) {
  var state = togglePlayBackgroundState;
  var tasks = [];

  if (fields.isEnabled !== undefined) {
    state.isEnabled = fields.isEnabled;
    tasks.push(saveLocalPreferences({ isEnabled: fields.isEnabled }));
  }

  if (fields.syncMode !== undefined) {
    state.syncMode = fields.syncMode;
    tasks.push(saveLocalPreferences({ syncMode: fields.syncMode }));
  }

  if (fields.pairs !== undefined) {
    tasks.push(saveSessionPairs(state.pairs));
  }

  await Promise.all(tasks);
}
