/**
 * chrome.storage.local (preferences) + chrome.storage.session (tab pairs).
 */
async function loadLocalPreferences() {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  var data = await chrome.storage.local.get([
    keys.ENABLED,
    keys.EXCLUSIVE_MODE,
    keys.SYNC_MODE
  ]);

  // Pairing always mirrors unless the user explicitly enables exclusive in settings.
  var exclusiveModeEnabled = data[keys.EXCLUSIVE_MODE] === true;

  return {
    isEnabled: data[keys.ENABLED] !== false,
    exclusiveModeEnabled: exclusiveModeEnabled === true
  };
}

async function saveLocalPreferences(partial) {
  var keys = TogglePlayConfig.STORAGE_KEYS;
  var payload = {};

  if (partial.isEnabled !== undefined) {
    payload[keys.ENABLED] = partial.isEnabled;
  }
  if (partial.exclusiveModeEnabled !== undefined) {
    payload[keys.EXCLUSIVE_MODE] = partial.exclusiveModeEnabled;
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

  if (fields.exclusiveModeEnabled !== undefined) {
    state.exclusiveModeEnabled = fields.exclusiveModeEnabled;
    tasks.push(saveLocalPreferences({ exclusiveModeEnabled: fields.exclusiveModeEnabled }));
  }

  if (fields.pairs !== undefined) {
    tasks.push(saveSessionPairs(state.pairs));
  }

  await Promise.all(tasks);
}
