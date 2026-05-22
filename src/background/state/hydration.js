/**
 * Load persisted state into memory and prune stale tab references.
 */
var togglePlayHydrationPromise = null;

async function hydrateState() {
  var state = togglePlayBackgroundState;

  try {
    var local = await loadLocalPreferences();
    state.isEnabled = local.isEnabled;
    state.exclusiveModeEnabled = local.exclusiveModeEnabled;

    var pairs = await loadSessionPairs();
    // Avoid a hydration race wiping pairs added before storage finished writing.
    if (pairs.size > 0 || state.pairs.size === 0) {
      state.pairs = pairs;
    }

    await pruneInvalidPairs();
    await loadPersistedLogs();
    togglePlayLog('State hydrated — pairs:', state.pairs.size, 'enabled:', state.isEnabled, 'exclusive:', state.exclusiveModeEnabled);
  } catch (err) {
    togglePlayError('Failed to hydrate state:', err);
  }

  state.hydrated = true;
}

function ensureHydrated() {
  if (togglePlayBackgroundState.hydrated) {
    return Promise.resolve();
  }
  if (!togglePlayHydrationPromise) {
    togglePlayHydrationPromise = hydrateState();
  }
  return togglePlayHydrationPromise;
}

async function pruneInvalidPairs() {
  var state = togglePlayBackgroundState;
  var tabIds = Array.from(state.pairs.keys());
  var removed = false;

  for (var i = 0; i < tabIds.length; i++) {
    var tabId = TogglePlayStorageSerializers.normalizeTabId(tabIds[i]);
    try {
      var tab = await chrome.tabs.get(tabId);
      var pairInfo = state.pairs.get(tabId);
      if (TogglePlayPlatforms.getSourceType(tab.url) === null) {
        state.pairs.delete(tabId);
        removed = true;
        continue;
      }
      if (pairInfo && pairInfo.url !== tab.url) {
        pairInfo.url = tab.url;
        pairInfo.title = tab.title;
        pairInfo.sourceType = TogglePlayPlatforms.getSourceType(tab.url);
      }
    } catch (err) {
      state.pairs.delete(tabId);
      removed = true;
    }
  }

  if (removed) {
    await saveSessionPairs(state.pairs);
    togglePlayLog('Pruned invalid pairs; remaining:', state.pairs.size);
  }
}
