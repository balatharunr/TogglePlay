/**
 * Clean up pairs when tabs close or navigate away from media URLs.
 */
function registerTabLifecycleListeners() {
  chrome.tabs.onRemoved.addListener(function (tabId) {
    removePairsInvolvingTab(tabId);
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    // Only react to url changes (which happen when navigation starts).
    if (!changeInfo.url) {
      return;
    }
    // If the new URL is not on a supported platform, remove the pair.
    if (TogglePlayPlatforms.getSourceType(changeInfo.url) === null) {
      removePairsInvolvingTab(tabId);
    }
  });
}

async function removePairsInvolvingTab(tabId) {
  var state = togglePlayBackgroundState;
  tabId = TogglePlayStorageSerializers.normalizeTabId(tabId);
  if (!hasPairForTab(tabId)) {
    return;
  }

  var pairInfo = getPairForTab(tabId);
  var partnerIds = [];

  if (pairInfo && pairInfo.pairedWith) {
    pairInfo.pairedWith.forEach(function (partner) {
      partnerIds.push(TogglePlayStorageSerializers.normalizeTabId(partner.tabId));
    });
  }

  state.pairs.delete(tabId);
  partnerIds.forEach(function (partnerId) {
    state.pairs.delete(partnerId);
  });

  await saveSessionPairs(state.pairs);
  togglePlayLog('Removed pair(s) involving closed or invalid tab', tabId);
}
