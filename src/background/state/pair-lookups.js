/**
 * In-memory pair map lookups (numeric tab IDs).
 */
function getPairForTab(tabId) {
  var id = TogglePlayStorageSerializers.normalizeTabId(tabId);
  return togglePlayBackgroundState.pairs.get(id);
}

function hasPairForTab(tabId) {
  return togglePlayBackgroundState.pairs.has(
    TogglePlayStorageSerializers.normalizeTabId(tabId)
  );
}
