/**
 * Clean up pairs when tabs close or navigate away from media URLs.
 */
function registerTabLifecycleListeners() {
  chrome.tabs.onRemoved.addListener(function (tabId) {
    removePairsInvolvingTab(tabId);
  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.url && tab.url && !TogglePlayPlatforms.isMediaUrl(tab.url)) {
      removePairsInvolvingTab(tabId);
    }
  });
}

async function removePairsInvolvingTab(tabId) {
  var state = togglePlayBackgroundState;
  if (!state.pairs.has(tabId)) {
    return;
  }

  var pairInfo = state.pairs.get(tabId);
  var partnerIds = [];

  if (pairInfo && pairInfo.pairedWith) {
    pairInfo.pairedWith.forEach(function (partner) {
      partnerIds.push(partner.tabId);
    });
  }

  state.pairs.delete(tabId);
  partnerIds.forEach(function (partnerId) {
    state.pairs.delete(partnerId);
  });

  await saveSessionPairs(state.pairs);
  togglePlayLog('Removed pair(s) involving closed or invalid tab', tabId);
}
